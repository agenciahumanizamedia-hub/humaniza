// GET   /api/clients/:id/resultados?mes=AAAA-MM&atualizar=1 — resultados do mês do cliente:
//       Instagram (orgânico), anúncios (Meta Ads), outras plataformas (manual), produção da agência,
//       análise automática, análise da agência e próximos passos.
//       Os números vêm do Meta na hora (com cache de 30 min; meses fechados, 24 h).
//       O cliente só vê o mês depois que a agência marcar "Mostrar ao cliente".
// PATCH /api/clients/:id/resultados — equipe/admin salvam análise, próximos passos, números manuais
//       e se o mês fica visível ao cliente.
import type { APIRoute } from "astro";
import { requireAccess, loadClientFor, HttpError, type Access } from "../../../../server/access";
import { COLLECTIONS, find, findAll, create, replace, type Row } from "../../../../server/db";
import { logActivity } from "../../../../server/activity";
import { handle, json } from "../../../../server/http";
import { readJson, str } from "../../../../server/util";
import { fetchInstagram, fetchAds, getMetaSettings } from "../../../../server/meta";
import { analyze } from "../../../../server/insights";

const isMonth = (m: string) => /^\d{4}-\d{2}$/.test(m);
const prevMonth = (m: string) => {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(Date.UTC(y, mo - 2, 1));
  return d.toISOString().slice(0, 7);
};

async function cached(clientId: string, month: string, source: string, force: boolean, load: () => Promise<any>) {
  const rows = await find(COLLECTIONS.metrics, { clientId, month, source }, { limit: 1 });
  const row = rows[0];
  const closed = month < new Date().toISOString().slice(0, 7);
  const maxAge = closed ? 24 * 3600e3 : 30 * 60e3;
  if (row && !force && Date.now() - new Date(row.fetchedAt).getTime() < maxAge) return { data: row.data, fetchedAt: row.fetchedAt, error: "" };
  try {
    const data = await load();
    const fetchedAt = new Date().toISOString();
    if (row) await replace(COLLECTIONS.metrics, { ...row, data, fetchedAt });
    else await create(COLLECTIONS.metrics, { clientId, month, source, data, fetchedAt });
    return { data, fetchedAt, error: "" };
  } catch (e) {
    // Sem conexão com o Meta: mostra o último dado guardado, avisando.
    return { data: row?.data ?? null, fetchedAt: row?.fetchedAt ?? "", error: e instanceof Error ? e.message : String(e) };
  }
}

async function getReport(clientId: string, month: string): Promise<Row | null> {
  const rows = await find(COLLECTIONS.reports, { clientId, month }, { limit: 1 });
  return rows[0] ?? null;
}

async function production(clientId: string, month: string) {
  const contents = (await findAll(COLLECTIONS.contents, { clientId })).filter((c) => !c.trashedAt && String(c.postDate ?? "").startsWith(month));
  return {
    planned: contents.length,
    posted: contents.filter((c) => c.status === "Postado").length,
    approved: contents.filter((c) => c.clientApproval === "Aprovado" || ["Aprovado", "Agendado", "Postado"].includes(c.status)).length,
    adjustments: contents.filter((c) => c.clientApproval === "Ajustes").length,
    byType: ["roteiro", "carrossel", "estatico"].map((t) => ({ type: t, count: contents.filter((c) => c.type === t).length })),
  };
}

export const GET: APIRoute = handle(async (_req, { params, url }) => {
  const access = await requireAccess();
  const client = await loadClientFor(access, params.id!);
  const month = isMonth(url.searchParams.get("mes") ?? "") ? url.searchParams.get("mes")! : new Date().toISOString().slice(0, 7);
  const report = await getReport(client._id, month);
  if (access.role === "client" && !report?.published) {
    return json({ month, published: false, message: "A Humaniza ainda está fechando os resultados deste mês." });
  }
  const force = url.searchParams.get("atualizar") === "1" && access.role !== "client";
  const integ = client.integrations ?? {};
  const meta = access.role !== "client" ? await getMetaSettings() : null;
  const prev = prevMonth(month);
  const [ig, prevIg, ads, prevAds, prod] = await Promise.all([
    integ.igUserId ? cached(client._id, month, "instagram", force, () => fetchInstagram(integ.igUserId, month)) : null,
    integ.igUserId ? cached(client._id, prev, "instagram", false, () => fetchInstagram(integ.igUserId, prev)) : null,
    integ.adAccountId ? cached(client._id, month, "ads", force, () => fetchAds(integ.adAccountId, month)) : null,
    integ.adAccountId ? cached(client._id, prev, "ads", false, () => fetchAds(integ.adAccountId, prev)) : null,
    production(client._id, month),
  ]);
  const auto = analyze({ ig: ig?.data ?? null, prevIg: prevIg?.data ?? null, ads: ads?.data ?? null, prevAds: prevAds?.data ?? null, planned: prod.planned, posted: prod.posted });
  return json({
    month,
    published: !!report?.published,
    connections: {
      metaConnected: access.role === "client" ? undefined : !!meta?.data?.token,
      instagram: integ.igUsername ?? (integ.igUserId ? "conectado" : ""),
      ads: integ.adAccountName ?? (integ.adAccountId ? "conectada" : ""),
    },
    instagram: ig ? { ...ig.data, fetchedAt: ig.fetchedAt, error: access.role === "client" ? "" : ig.error } : null,
    previousInstagram: prevIg?.data ? { totals: prevIg.data.totals, profile: prevIg.data.profile } : null,
    ads: ads ? { ...ads.data, fetchedAt: ads.fetchedAt, error: access.role === "client" ? "" : ads.error } : null,
    previousAds: prevAds?.data ? { totals: prevAds.data.totals } : null,
    production: prod,
    auto,
    report: {
      analysis: report?.analysis ?? "",
      nextSteps: report?.nextSteps ?? [],
      manual: report?.manual ?? {},
      publishedAt: report?.publishedAt ?? "",
      updatedBy: access.role === "client" ? undefined : report?.updatedBy ?? "",
    },
  });
});

const PLATFORMS = ["tiktok", "youtube", "googleAds", "google", "linkedin", "site", "outros"];
const NUM_FIELDS = ["followers", "posts", "reach", "views", "interactions", "spend", "clicks", "leads", "sales"];

export const PATCH: APIRoute = handle(async (request, { params }) => {
  const access: Access = await requireAccess(["admin", "team"]);
  const client = await loadClientFor(access, params.id!);
  const b = await readJson(request);
  const month = str(b.month, 7);
  if (!isMonth(month)) throw new HttpError(400, "Mês inválido.");
  const existing = await getReport(client._id, month);
  const row: Record<string, any> = existing ?? { clientId: client._id, month, analysis: "", nextSteps: [], manual: {}, published: false, publishedAt: "" };
  if ("analysis" in b) row.analysis = str(b.analysis, 8000);
  if (Array.isArray(b.nextSteps))
    row.nextSteps = b.nextSteps.slice(0, 30).map((s: any) => ({ text: str(s?.text, 400), done: !!s?.done })).filter((s: any) => s.text);
  if (b.manual && typeof b.manual === "object") {
    const manual: Record<string, Record<string, number | string>> = {};
    for (const p of PLATFORMS) {
      const src = b.manual[p];
      if (!src || typeof src !== "object") continue;
      const out: Record<string, number | string> = {};
      for (const k of NUM_FIELDS) if (src[k] !== undefined && src[k] !== "" && Number.isFinite(Number(src[k]))) out[k] = Number(src[k]);
      if (src.note) out.note = str(src.note, 500);
      if (Object.keys(out).length) manual[p] = out;
    }
    row.manual = manual;
  }
  if ("published" in b) {
    const pub = !!b.published;
    if (pub && !row.published) row.publishedAt = new Date().toISOString();
    row.published = pub;
  }
  row.updatedBy = access.name;
  if (existing) await replace(COLLECTIONS.reports, row as Row);
  else await create(COLLECTIONS.reports, row);
  if ("published" in b && b.published && !existing?.published)
    await logActivity(access, {
      action: "report.published",
      description: `${access.name} liberou os resultados de ${month.split("-").reverse().join("/")} para ${client.name}.`,
      entityType: "report", entityId: client._id, clientId: client._id, visibleToClient: true,
    });
  return json({ ok: true });
});
