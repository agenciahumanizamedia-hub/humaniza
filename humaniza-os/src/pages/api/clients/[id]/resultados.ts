// GET   /api/clients/:id/resultados?de=AAAA-MM-DD&ate=AAAA-MM-DD — painel de desempenho do período.
//       Lê só o banco (dados sincronizados do Meta + Humaniza OS). Compara com o período anterior de
//       mesmo tamanho. Cliente: só períodos cuja análise foi aprovada e liberada pela equipe.
// GET   ...?relatorios=1 — períodos com análise liberada (para o cliente escolher).
// PATCH /api/clients/:id/resultados — equipe salva análise, sugestões aprovadas, números manuais e
//       se o período fica visível ao cliente.
import type { APIRoute } from "astro";
import { requireAccess, loadClientFor, HttpError, requireModule } from "../../../../server/access";
import { COLLECTIONS, find, findAll, create, replace, type Row } from "../../../../server/db";
import { logActivity } from "../../../../server/activity";
import { handle, json } from "../../../../server/http";
import { readJson, str } from "../../../../server/util";
import { getSyncState } from "../../../../server/sync";
import { getMetaSettings } from "../../../../server/meta";
import { aggregateIg, aggregateAds, suggest, daysBetween, SRC } from "../../../../server/insights";

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const shift = (d: string, n: number) => new Date(Date.parse(d + "T12:00:00Z") + n * 86400e3).toISOString().slice(0, 10);
const keyOf = (de: string, ate: string) => `${de}_${ate}`;

async function reportFor(clientId: string, periodKey: string) {
  return (await find(COLLECTIONS.reports, { clientId, periodKey }, { limit: 1 }))[0] ?? null;
}

const TYPE_MAP: Record<string, string[]> = { roteiro: ["Reels", "Vídeo"], carrossel: ["Carrossel"], estatico: ["Estático"] };

export const GET: APIRoute = handle(async (_req, { params, url }) => {
  const access = await requireAccess();
  requireModule(access, "resultados");
  const client = await loadClientFor(access, params.id!);
  const isClient = access.role === "client";

  if (url.searchParams.get("relatorios") === "1") {
    const rows = (await findAll(COLLECTIONS.reports, { clientId: client._id })).filter((r) => isClient ? r.published : true);
    return json(rows.map((r) => ({ periodKey: r.periodKey, published: !!r.published, publishedAt: r.publishedAt ?? "" })).sort((a, b) => b.periodKey.localeCompare(a.periodKey)));
  }

  const de = url.searchParams.get("de") ?? "";
  const ate = url.searchParams.get("ate") ?? "";
  if (!ISO.test(de) || !ISO.test(ate) || de > ate) throw new HttpError(400, "Período inválido.");
  if (daysBetween(de, ate).length > 370) throw new HttpError(400, "Escolha um período de até 1 ano.");
  const len = daysBetween(de, ate).length;
  const pde = shift(de, -len);
  const pate = shift(de, -1);
  const report = await reportFor(client._id, keyOf(de, ate));
  if (isClient && !report?.published) return json({ de, ate, published: false, message: "A Humaniza ainda está fechando a análise deste período." });

  const integ = client.integrations ?? {};
  const [metrics, contents, planner, sync, meta] = await Promise.all([
    findAll(COLLECTIONS.metrics, { clientId: client._id }),
    findAll(COLLECTIONS.contents, { clientId: client._id }),
    findAll(COLLECTIONS.planner, { clientId: client._id }),
    getSyncState(client._id),
    isClient ? Promise.resolve(null) : getMetaSettings(),
  ]);
  const bySrc = (s: string) => metrics.filter((m) => m.source === s);
  const igRows = { day: bySrc("ig_day"), profile: bySrc("ig_profile"), media: bySrc("ig_media") };
  const hasIg = !!integ.igUserId && (igRows.day.length > 0 || igRows.media.length > 0);
  const hasAds = !!integ.adAccountId && bySrc("ads_day").length > 0;
  const ig = hasIg ? aggregateIg(igRows.day, igRows.profile, igRows.media, de, ate) : null;
  const prevIg = hasIg ? aggregateIg(igRows.day, igRows.profile, igRows.media, pde, pate) : null;
  const ads = hasAds ? aggregateAds(bySrc("ads_day"), de, ate) : null;
  const prevAds = hasAds ? aggregateAds(bySrc("ads_day"), pde, pate) : null;

  // Entregas do Humaniza OS (status interno) x publicações confirmadas pelo Instagram
  const inPeriod = contents.filter((c) => !c.trashedAt && c.postDate && c.postDate >= de && c.postDate <= ate);
  const confirmed = new Set<string>();
  const deliveries = inPeriod.map((c) => {
    const match = ig?.posts.find((p: any) => p.date === c.postDate && (TYPE_MAP[c.type] ?? []).includes(p.type) && !confirmed.has(p.id));
    if (match) confirmed.add(match.id);
    return { _id: c._id, projectId: c.projectId, title: c.title ?? "", type: c.type, postDate: c.postDate, status: c.status ?? "", clientApproval: c.clientApproval ?? "", instagramId: match?.id ?? "" };
  });
  const STATUSES = ["Em criação", "Aguardando aprovação", "Ajustes", "Aprovado", "Em produção", "Agendado", "Postado"];
  const delivery = {
    total: deliveries.length,
    byType: ["roteiro", "carrossel", "estatico"].map((t) => ({ type: t, count: deliveries.filter((d) => d.type === t).length })),
    byStatus: STATUSES.map((s) => ({ status: s, count: deliveries.filter((d) => (d.clientApproval === "Ajustes" ? "Ajustes" : d.status) === s).length })).filter((x) => x.count),
    postedInternal: deliveries.filter((d) => d.status === "Postado").length,
    confirmedByInstagram: deliveries.filter((d) => d.instagramId).length,
    items: deliveries,
  };

  const today = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
  const upcoming = planner
    .filter((p) => !p.trashedAt && (p.endDate || p.date) >= today && p.date <= shift(today, 60) && (!isClient || p.visibleToClient))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 8)
    .map((p) => ({ _id: p._id, date: p.date, endDate: p.endDate ?? "", title: p.title, kind: p.kind, status: p.status, visibleToClient: !!p.visibleToClient }));

  const auto = isClient ? [] : suggest(ig, prevIg, ads, { planned: delivery.total, posted: delivery.postedInternal });
  const stripPosts = (x: any) => x && { ...x, posts: x.posts };
  return json({
    de, ate, previous: { de: pde, ate: pate },
    published: !!report?.published,
    sources: SRC,
    connections: {
      metaConnected: isClient ? undefined : !!meta?.data?.token,
      instagram: { linked: !!integ.igUserId, label: integ.igUsername ?? "", ...(isClient ? { state: sync.ig.state, lastSuccess: sync.ig.lastSuccess } : sync.ig) },
      ads: { linked: !!integ.adAccountId, label: integ.adAccountName ?? "", ...(isClient ? { state: sync.ads.state, lastSuccess: sync.ads.lastSuccess } : sync.ads) },
    },
    instagram: stripPosts(ig),
    previousInstagram: prevIg ? { totals: prevIg.totals, followers: prevIg.followers, coverage: prevIg.coverage, series: prevIg.series } : null,
    ads,
    previousAds: prevAds ? { totals: prevAds.totals, coverage: prevAds.coverage, series: prevAds.series } : null,
    delivery,
    upcoming,
    suggestions: auto,
    report: {
      analysis: report?.analysis ?? "",
      suggestions: (report?.suggestions ?? []).filter((s: any) => !isClient || s.approved),
      nextSteps: report?.nextSteps ?? [],
      manual: report?.manual ?? {},
      publishedAt: report?.publishedAt ?? "",
      updatedBy: isClient ? undefined : report?.updatedBy ?? "",
    },
  });
});

const PLATFORMS = ["tiktok", "youtube", "googleAds", "google", "site"];
const NUM_FIELDS = ["followers", "posts", "reach", "views", "interactions", "spend", "clicks", "leads", "sales"];

export const PATCH: APIRoute = handle(async (request, { params }) => {
  const access = await requireAccess(["admin", "team"]);
  requireModule(access, "resultados");
  const client = await loadClientFor(access, params.id!);
  const b = await readJson(request);
  const de = str(b.de, 10), ate = str(b.ate, 10);
  if (!ISO.test(de) || !ISO.test(ate)) throw new HttpError(400, "Período inválido.");
  const periodKey = keyOf(de, ate);
  const existing = await reportFor(client._id, periodKey);
  const row: Record<string, any> = existing ?? { clientId: client._id, month: de.slice(0, 7), periodKey, analysis: "", suggestions: [], nextSteps: [], manual: {}, published: false, publishedAt: "" };
  if ("analysis" in b) row.analysis = str(b.analysis, 8000);
  if (Array.isArray(b.suggestions))
    row.suggestions = b.suggestions.slice(0, 20).map((s: any) => ({
      id: str(s?.id, 40), kind: ["funcionou", "repetir", "melhorar", "teste"].includes(s?.kind) ? s.kind : "melhorar", text: str(s?.text, 600), approved: !!s?.approved, ai: !!s?.ai,
      evidence: Array.isArray(s?.evidence) ? s.evidence.slice(0, 5).map((e: any) => ({ label: str(e?.label, 120), value: str(e?.value, 120), source: str(e?.source, 80) })) : [],
    })).filter((s: any) => s.text);
  if (Array.isArray(b.nextSteps)) row.nextSteps = b.nextSteps.slice(0, 30).map((s: any) => ({ text: str(s?.text, 400), done: !!s?.done })).filter((s: any) => s.text);
  if (b.manual && typeof b.manual === "object") {
    const manual: Record<string, Record<string, number | string>> = {};
    for (const p of PLATFORMS) {
      const src = b.manual[p];
      if (!src || typeof src !== "object") continue;
      const out: Record<string, number | string> = {};
      for (const k of NUM_FIELDS) if (src[k] !== undefined && src[k] !== "" && Number.isFinite(Number(src[k]))) out[k] = Number(src[k]);
      if (Object.keys(out).length) manual[p] = out;
    }
    row.manual = manual;
  }
  if ("published" in b) {
    if (b.published && !String(row.analysis ?? "").trim() && !(row.suggestions ?? []).some((s: any) => s.approved))
      throw new HttpError(400, "Escreva a análise ou aprove pelo menos uma sugestão antes de liberar ao cliente.");
    if (b.published && !row.published) row.publishedAt = new Date().toISOString();
    row.published = !!b.published;
  }
  row.updatedBy = access.name;
  if (existing) await replace(COLLECTIONS.reports, row as Row);
  else await create(COLLECTIONS.reports, row);
  if (b.published && !existing?.published)
    await logActivity(access, {
      action: "report.published",
      description: `${access.name} liberou a análise de ${de.split("-").reverse().join("/")} a ${ate.split("-").reverse().join("/")} para ${client.name}.`,
      entityType: "report", entityId: client._id, clientId: client._id, visibleToClient: true,
    });
  return json({ ok: true });
});
