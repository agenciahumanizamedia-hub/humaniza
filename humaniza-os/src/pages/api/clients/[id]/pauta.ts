// Próximos conteúdos do cliente (somente equipe/admin).
// GET   /api/clients/:id/pauta?mes=AAAA-MM — tendências pesquisadas, pautas sugeridas, datas de captação e do mês.
// POST  /api/clients/:id/pauta { mes, etapa: "tendencias", foco? }  — o Claude pesquisa na web o que está em alta.
// POST  /api/clients/:id/pauta { mes, etapa: "ideias", quantidade, mix, foco?, substituir? } — o Claude cria pautas
//       inéditas (conferidas contra os roteiros do cliente e, só aqui no servidor, contra a base dos outros clientes).
// PATCH /api/clients/:id/pauta { mes, id, acao: "salvar"|"aprovar"|"descartar"|"reabrir", ideia? }
//       "aprovar" cria o roteiro/carrossel/estático no projeto do mês, que segue o fluxo normal de aprovação do cliente.
import type { APIRoute } from "astro";
import { requireAccess, loadClientFor, HttpError } from "../../../../server/access";
import { COLLECTIONS, findAll, create, patch } from "../../../../server/db";
import { handle, json } from "../../../../server/http";
import { readJson, str, historyLine } from "../../../../server/util";
import { logActivity } from "../../../../server/activity";
import { askClaude, askClaudeWeb, aiSettings, plain, MODEL } from "../../../../server/ai";
import { commercialCalendar, segmentTags } from "../../../../server/commercial-dates";
import {
  PAUTA_TYPES, CHECKLIST, loadPauta, savePauta, allPautaIdeas, tooSimilar, contentRef, ideaRef, toHtml, projectForMonth, monthName,
  type Idea, type PautaType, type Trend,
} from "../../../../server/pauta";

const MES = /^\d{4}-\d{2}$/;
const TYPE_PT: Record<string, string> = { roteiro: "Reels", carrossel: "Carrossel", estatico: "Estático" };
const daysIn = (mes: string) => new Date(Date.UTC(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)), 0)).getUTCDate();

function monthOf(v: unknown) {
  const mes = str(v, 7);
  if (!MES.test(mes)) throw new HttpError(400, "Informe o mês (AAAA-MM).");
  return mes;
}

async function context(clientId: string, mes: string) {
  const [contents, planner] = await Promise.all([
    findAll(COLLECTIONS.contents, { clientId }),
    findAll(COLLECTIONS.planner, { clientId }),
  ]);
  const inMonth = planner.filter((p) => !p.trashedAt && (String(p.date).startsWith(mes) || (p.endDate && p.date < `${mes}-32` && p.endDate >= `${mes}-01`)));
  return {
    contents,
    capture: inMonth.filter((p) => p.kind === "Captação").map((p) => ({ date: p.date, title: p.title })),
    planned: inMonth.map((p) => ({ date: p.date, endDate: p.endDate ?? "", title: p.title, kind: p.kind })),
  };
}

function segmentOf(client: any) {
  return [client.serviceType, client.serviceCustom, client.brand?.notes, client.notes].filter(Boolean).join(" · ");
}

export const GET: APIRoute = handle(async (_req, { params, url }) => {
  const access = await requireAccess(["admin", "team"]);
  const client = await loadClientFor(access, params.id!);
  const mes = monthOf(url.searchParams.get("mes"));
  const [{ data }, ctx, ai] = await Promise.all([loadPauta(client._id, mes), context(client._id, mes), aiSettings()]);
  const tags = segmentTags(segmentOf(client) + " " + client.name);
  const commercial = commercialCalendar(`${mes}-01`, 1).filter((s) => s.date.startsWith(mes) && s.tags.some((t) => tags.includes(t)));
  const history = ctx.contents.filter((c) => !c.trashedAt).length;
  return json({
    mes,
    trends: data.trends,
    ideas: data.ideas,
    capture: ctx.capture,
    dates: [...ctx.planned, ...commercial.map((c) => ({ date: c.date, endDate: "", title: c.title, kind: "Calendário comercial" }))].sort((a, b) => a.date.localeCompare(b.date)),
    occupied: ctx.contents.filter((c) => !c.trashedAt && String(c.postDate ?? "").startsWith(mes)).map((c) => ({ date: c.postDate, type: c.type, title: c.title ?? "" })),
    history,
    aiReady: !!ai?.data?.apiKey,
  });
});

const TREND_SYSTEM = `Você é pesquisador(a) de tendências de redes sociais da Agência Humaniza (Brasil). Pesquise na web antes de responder.
Regras: português do Brasil; foque em Instagram (Reels, carrossel, stories) no Brasil, e em tendências do TikTok que estão migrando para o Instagram.
Só afirme o que as páginas pesquisadas sustentam e cite as URLs usadas. Não reproduza letras de música; cite áudios só pelo nome.
Prefira fontes recentes (últimos 60 dias) e específicas do nicho. Responda APENAS com um objeto JSON válido, sem texto antes ou depois.`;

const IDEAS_SYSTEM = `Você é estrategista e roteirista sênior de Instagram da Agência Humaniza (Brasil). Português do Brasil, linguagem natural, no tom da marca.
Regras obrigatórias:
- Use somente as informações fornecidas sobre o cliente. Nunca invente números, depoimentos, preços ou resultados.
- Cada pauta precisa ser INÉDITA para este cliente: não repita tema, ângulo ou gancho da lista "ja_feitos" nem entre si.
- Ganchos de até 15 palavras, específicos, sem clickbait enganoso. Cada pauta com um ângulo diferente.
- Em "por_que", cite a tendência e/ou o dado do cliente em que a pauta se apoia (ex.: "Carrossel teve 4,1% de interação nos últimos 90 dias").
- Pense na captação: diga o que gravar/fotografar para a equipe organizar o dia de captação.
- Responda APENAS com um objeto JSON válido, sem texto antes ou depois.`;

function mixCounts(mix: string, n: number): Record<PautaType, number> | null {
  const split = (r: number, c: number) => {
    const roteiro = Math.round(n * r), carrossel = Math.round(n * c);
    return { roteiro, carrossel, estatico: Math.max(0, n - roteiro - carrossel) };
  };
  if (mix === "equilibrado") return split(0.5, 0.3);
  if (mix === "reels") return split(0.7, 0.2);
  if (mix === "carrossel") return split(0.3, 0.6);
  if (mix === "so-reels") return { roteiro: n, carrossel: 0, estatico: 0 };
  return null; // automático: o Claude decide pelo desempenho
}

function cleanIdea(x: any, mes: string, trendIds: Set<string>, by: string, i: number): Idea | null {
  const type = (PAUTA_TYPES as readonly string[]).includes(x?.formato) ? (x.formato as PautaType) : null;
  const title = str(x?.titulo, 160);
  if (!type || !title) return null;
  const d = str(x?.data_sugerida, 10);
  const day = Number(d.slice(8, 10));
  return {
    id: `p-${Date.now().toString(36)}-${i}-${Math.random().toString(36).slice(2, 6)}`,
    type, title,
    tema: str(x?.tema, 300), objetivo: str(x?.objetivo, 300), gancho: str(x?.gancho, 200),
    desenvolvimento: str(x?.desenvolvimento, 3000), legenda: str(x?.legenda, 1500), cta: str(x?.cta, 200), captacao: str(x?.captacao, 800),
    postDate: d.startsWith(mes) && day >= 1 && day <= daysIn(mes) ? d : "",
    trendId: trendIds.has(str(x?.tendencia_id, 20)) ? str(x?.tendencia_id, 20) : "",
    why: str(x?.por_que, 600),
    status: "sugerida", createdAt: new Date().toISOString(), by,
  };
}

export const POST: APIRoute = handle(async (request, { params }) => {
  const access = await requireAccess(["admin", "team"]);
  const client = await loadClientFor(access, params.id!);
  const b = await readJson(request);
  const mes = monthOf(b.mes);
  const foco = str(b.foco, 400);
  const { row, data } = await loadPauta(client._id, mes);
  const segment = segmentOf(client) || "não informado";

  if (b.etapa === "tendencias") {
    const ask = `Cliente: ${client.name}. Segmento/serviço: ${segment}. Instagram: ${client.instagram || "—"}.
Mês em que os conteúdos serão captados e publicados: ${monthName(mes)}.${foco ? `\nFoco pedido pela equipe: ${foco}` : ""}

Pesquise na web e traga o que está em alta e performando agora para esse nicho no Instagram do Brasil, pensando em ${monthName(mes)}:
1) formatos e estilos de Reels/carrossel em alta (estrutura, edição, tipo de gancho);
2) temas e assuntos do nicho com interesse crescente;
3) datas, eventos e sazonalidade de ${monthName(mes)} que afetam esse público;
4) comportamentos/trends e áudios virais adaptáveis a uma marca (só o nome do áudio).

Devolva:
{ "resumo": "2 a 3 frases sobre o cenário do mês para esse nicho",
  "tendencias": [ { "id": "t1", "tipo": "formato|tema|data|comportamento|audio", "titulo": "curto", "descricao": "o que é e por que está performando (com base nas fontes)", "como_aplicar": "como este cliente pode usar, em 1 frase", "fontes": ["https://..."] } ] }
Entre 5 e 8 tendências, cada uma com pelo menos uma fonte.`;
    const out = await askClaudeWeb(TREND_SYSTEM, ask, 3000, 5);
    const known = new Map(out.sources.map((s) => [s.url, s]));
    const items: Trend[] = (Array.isArray(out.json.tendencias) ? out.json.tendencias : []).slice(0, 10).map((t: any, i: number) => ({
      id: `t${i + 1}`,
      kind: str(t?.tipo, 30) || "tema",
      title: str(t?.titulo, 140),
      description: str(t?.descricao, 600),
      apply: str(t?.como_aplicar, 300),
      // só ficam as fontes que a pesquisa realmente retornou
      sources: (Array.isArray(t?.fontes) ? t.fontes : []).map((u: any) => known.get(String(u))).filter(Boolean).slice(0, 3) as any,
    })).filter((t: Trend) => t.title);
    data.trends = { summary: str(out.json.resumo, 800), items, sources: out.sources.slice(0, 20), at: new Date().toISOString(), by: access.name, searches: out.searches };
    await savePauta(client._id, mes, row, data);
    await logActivity(access, { action: "ai.trends", description: `${access.name} pesquisou tendências de ${monthName(mes)} para ${client.name}.`, entityType: "client", entityId: client._id, clientId: client._id });
    return json({ trends: data.trends, model: MODEL });
  }

  if (b.etapa !== "ideias") throw new HttpError(400, "Etapa inválida.");
  const replacing = str(b.substituir, 60);
  const target = replacing ? data.ideas.find((i) => i.id === replacing) : null;
  if (replacing && (!target || target.status !== "sugerida")) throw new HttpError(404, "Pauta não encontrada.");
  const n = target ? 1 : Math.min(12, Math.max(1, Number(b.quantidade) || 6));
  const mix = target ? { roteiro: 0, carrossel: 0, estatico: 0, [target.type]: 1 } as Record<PautaType, number> : mixCounts(str(b.mix, 20), n);

  // Histórico do próprio cliente (pode ir para o Claude) e da base dos outros clientes (só comparação aqui).
  const [ctx, otherContents, prev, media] = await Promise.all([
    context(client._id, mes),
    findAll(COLLECTIONS.contents).then((rows) => rows.filter((c) => c.clientId !== client._id)),
    allPautaIdeas(client._id),
    findAll(COLLECTIONS.metrics, { clientId: client._id, source: "ig_media" }),
  ]);
  const mineContents = ctx.contents;
  const mineRefs = [...mineContents.map(contentRef), ...prev.mine.filter((i) => i.id !== replacing).map(ideaRef)];
  const otherRefs = [...otherContents.map(contentRef), ...prev.others.map(ideaRef)];

  const done = [...mineContents]
    .sort((a, b) => String(b.postDate || b._createdDate || "").localeCompare(String(a.postDate || a._createdDate || "")))
    .slice(0, 120)
    .map((c) => `${TYPE_PT[c.type] ?? c.type}: ${plain(c.title || c.fields?.tema).slice(0, 90)}${c.fields?.gancho ? ` — gancho: ${plain(c.fields.gancho).slice(0, 90)}` : ""}`);
  const doneIdeas = prev.mine.map((i) => `${TYPE_PT[i.type]}: ${i.title} — gancho: ${i.gancho}`).slice(-80);

  const posts = media.map((m) => m.data ?? {}).filter((d) => typeof d.reach === "number" && d.reach > 0 && typeof d.interactions === "number" && d.type !== "Story");
  const byFormat: Record<string, { n: number; rate: number }> = {};
  for (const p of posts) {
    const f = (byFormat[p.type] ??= { n: 0, rate: 0 });
    f.n++; f.rate += p.interactions / p.reach;
  }
  const desempenho = posts.length
    ? {
        fonte: "Instagram (Meta)",
        por_formato: Object.entries(byFormat).map(([formato, v]) => ({ formato, posts: v.n, interacao_media_sobre_alcance: `${((v.rate / v.n) * 100).toFixed(1)}%` })),
        melhores_posts: [...posts].sort((a, b) => b.interactions / b.reach - a.interactions / a.reach).slice(0, 6)
          .map((p) => ({ data: p.date, formato: p.type, legenda: String(p.caption ?? "").slice(0, 180), interacoes: p.interactions, alcance: p.reach, salvos: p.saves ?? null })),
      }
    : "Instagram ainda não conectado: sem dados de desempenho. Baseie-se nas tendências e nos roteiros já feitos.";
  const tags = segmentTags(segment + " " + client.name);
  const trends = data.trends?.items ?? [];
  const quer = mix
    ? Object.entries(mix).filter(([, v]) => v > 0).map(([k, v]) => `${v} ${TYPE_PT[k]}`).join(", ")
    : `${n} pautas no total, escolhendo o mix de formatos pelo desempenho do cliente`;

  const input = {
    cliente: { nome: client.name, segmento: segment, tom_de_voz: client.brand?.tone ?? "", observacoes_marca: client.brand?.notes ?? "", instagram: client.instagram ?? "" },
    mes: { referencia: mes, nome: monthName(mes), dias: daysIn(mes) },
    captacao: ctx.capture.length ? ctx.capture : "Data de captação ainda não marcada.",
    datas_do_mes: [
      ...ctx.planned.map((p) => ({ data: p.date, titulo: p.title, tipo: p.kind })),
      ...commercialCalendar(`${mes}-01`, 1).filter((s) => s.date.startsWith(mes) && s.tags.some((t) => tags.includes(t))).map((s) => ({ data: s.date, titulo: s.title, dica: s.tip })),
    ],
    datas_ja_ocupadas: mineContents.filter((c) => !c.trashedAt && String(c.postDate ?? "").startsWith(mes)).map((c) => c.postDate),
    tendencias: trends.length ? trends.map((t) => ({ id: t.id, tipo: t.kind, titulo: t.title, descricao: t.description, como_aplicar: t.apply })) : "Sem pesquisa de tendências para este mês.",
    desempenho,
    ja_feitos: { roteiros_do_cliente: done, pautas_ja_sugeridas: doneIdeas },
    foco_da_equipe: foco || "—",
    pautas_atuais_do_mes: target ? data.ideas.filter((i) => i.status !== "descartada" && i.id !== replacing).map((i) => i.title) : [],
  };

  const askFor = (count: string, extra = "") => `Crie pautas para ${monthName(mes)}: ${count}.${extra}
Formato de cada pauta (formato = "roteiro" para Reels, "carrossel" ou "estatico"):
{ "pautas": [ {
  "formato": "roteiro|carrossel|estatico",
  "titulo": "título interno curto",
  "tema": "tema central",
  "objetivo": "alcance | engajamento | autoridade | conversão — e o porquê",
  "gancho": "frase dos 3 primeiros segundos / capa",
  "desenvolvimento": "Reels: cenas numeradas com fala e o que aparece; Carrossel: texto de cada slide numerado; Estático: mensagem da arte",
  "legenda": "legenda pronta (até 600 caracteres)",
  "cta": "chamada para ação",
  "captacao": "o que gravar/fotografar no dia de captação (planos, locais, quem aparece, objetos)",
  "data_sugerida": "AAAA-MM-DD dentro do mês, evitando datas_ja_ocupadas e aproveitando datas_do_mes",
  "tendencia_id": "id da tendência usada ou vazio",
  "por_que": "base da sugestão: tendência e/ou dado do cliente"
} ] }

DADOS:
${JSON.stringify(input)}`;

  const extraWanted = mix ? Object.values(mix).reduce((a, b) => a + b, 0) : n;
  const trendIds = new Set(trends.map((t) => t.id));
  const accepted: Idea[] = [];
  const rejected: { title: string; like: string; base: "cliente" | "outros" }[] = [];
  const consider = (raw: any[]) => {
    raw.forEach((x, i) => {
      const idea = cleanIdea(x, mes, trendIds, access.name, accepted.length + rejected.length + i);
      if (!idea || accepted.length >= extraWanted) return;
      const r = ideaRef(idea);
      const sameMine = tooSimilar(r, [...mineRefs, ...accepted.map(ideaRef)]);
      const sameOther = sameMine ? null : tooSimilar(r, otherRefs);
      if (sameMine || sameOther) rejected.push({ title: idea.title, like: (sameMine ?? sameOther)!.label, base: sameMine ? "cliente" : "outros" });
      else accepted.push(idea);
    });
  };
  const first = await askClaude(IDEAS_SYSTEM, askFor(quer), Math.min(8000, 1200 + extraWanted * 650));
  consider(Array.isArray(first.pautas) ? first.pautas : []);
  if (accepted.length < extraWanted) {
    // Uma nova rodada só para repor as que ficaram parecidas demais com algo que já existe.
    const missing = extraWanted - accepted.length;
    const avoid = [...rejected.map((r) => r.title), ...accepted.map((a) => a.title)];
    const again = await askClaude(IDEAS_SYSTEM, askFor(`${missing} pauta(s) nova(s)`, `\nEstas ideias foram recusadas por serem parecidas demais com conteúdos que já existem — crie ângulos totalmente diferentes deles e das já aceitas: ${JSON.stringify(avoid)}`), Math.min(6000, 1200 + missing * 650));
    consider(Array.isArray(again.pautas) ? again.pautas : []);
  }
  if (!accepted.length) throw new HttpError(502, "O Claude não conseguiu criar pautas inéditas desta vez. Tente mudar o foco do mês e gerar de novo.");

  if (target) {
    const idx = data.ideas.findIndex((i) => i.id === replacing);
    data.ideas[idx] = { ...target, status: "descartada" };
    data.ideas.splice(idx + 1, 0, accepted[0]);
  } else data.ideas.push(...accepted);
  await savePauta(client._id, mes, row, data);
  await logActivity(access, { action: "ai.pautas", description: `${access.name} gerou ${accepted.length} pauta(s) de ${monthName(mes)} com o Claude para ${client.name}.`, entityType: "client", entityId: client._id, clientId: client._id });
  return json({
    created: accepted.map((a) => a.id),
    rejected: rejected.map((r) => ({ title: r.title, reason: r.base === "cliente" ? `parecida com "${r.like}" deste cliente` : "parecida com um conteúdo de outro cliente da agência" })),
    checkedAgainst: mineRefs.length + otherRefs.length,
    model: MODEL,
  });
});

export const PATCH: APIRoute = handle(async (request, { params }) => {
  const access = await requireAccess(["admin", "team"]);
  const client = await loadClientFor(access, params.id!);
  const b = await readJson(request);
  const mes = monthOf(b.mes);
  const { row, data } = await loadPauta(client._id, mes);
  const idx = data.ideas.findIndex((i) => i.id === str(b.id, 60));
  if (idx < 0) throw new HttpError(404, "Pauta não encontrada.");
  const idea = data.ideas[idx];
  const acao = str(b.acao, 20);

  if (acao === "salvar") {
    if (idea.status === "aprovada") throw new HttpError(409, "Esta pauta já virou conteúdo. Edite pelo projeto do mês.");
    const e = b.ideia ?? {};
    const type = (PAUTA_TYPES as readonly string[]).includes(e.type) ? (e.type as PautaType) : idea.type;
    const d = str(e.postDate, 10);
    data.ideas[idx] = {
      ...idea, type,
      title: str(e.title, 160) || idea.title, tema: str(e.tema, 300), objetivo: str(e.objetivo, 300), gancho: str(e.gancho, 200),
      desenvolvimento: str(e.desenvolvimento, 3000), legenda: str(e.legenda, 1500), cta: str(e.cta, 200), captacao: str(e.captacao, 800),
      postDate: d.startsWith(mes) ? d : "", editedBy: access.name,
    };
  } else if (acao === "descartar" || acao === "reabrir") {
    if (idea.status === "aprovada") throw new HttpError(409, "Esta pauta já virou conteúdo. Para tirar, use a lixeira do projeto.");
    data.ideas[idx] = { ...idea, status: acao === "descartar" ? "descartada" : "sugerida" };
  } else if (acao === "aprovar") {
    if (idea.status === "aprovada") return json({ ok: true, contentId: idea.contentId, projectId: idea.projectId });
    const { project, created } = await projectForMonth(client, mes, access.name, historyLine);
    const existing = (await findAll(COLLECTIONS.contents, { projectId: project._id })).filter((c) => !c.trashedAt);
    const trend = data.trends?.items.find((t) => t.id === idea.trendId);
    const dev = toHtml(idea.desenvolvimento);
    const content = await create(COLLECTIONS.contents, {
      clientId: client._id, projectId: project._id, type: idea.type, order: existing.length, title: idea.title,
      fields: {
        tema: toHtml(idea.tema), objetivo: toHtml(idea.objetivo), gancho: toHtml(idea.gancho),
        desenvolvimento: idea.type === "roteiro" ? dev : "", slides: idea.type === "carrossel" ? dev : "", mensagem: idea.type === "estatico" ? dev : "",
        legenda: toHtml(idea.legenda), cta: toHtml(idea.cta),
      },
      responsible: "", driveLink: "", referenceLink: trend?.sources[0]?.url ?? "", postDate: idea.postDate, week: "",
      status: "Em criação", checklist: CHECKLIST[idea.type].map((label) => ({ label, done: false })),
      note: [`Pauta aprovada por ${access.name} em Próximos conteúdos (sugestão do Claude).`, idea.captacao && `Captação: ${idea.captacao}`, trend && `Tendência: ${trend.title}`, idea.why && `Por quê: ${idea.why}`].filter(Boolean).join("\n"),
      clientApproval: "", clientNote: "", clientActionAt: "", source: "os", legacyId: "", legacyData: {}, updatedBy: access.name,
    });
    await patch(COLLECTIONS.projects, project._id, {
      history: [historyLine(access.name, `Aprovou a pauta "${idea.title}" (${TYPE_PT[idea.type]}) de Próximos conteúdos.`), ...(project.history ?? [])].slice(0, 300),
    });
    data.ideas[idx] = { ...idea, status: "aprovada", contentId: content._id, projectId: project._id };
    await savePauta(client._id, mes, row, data);
    await logActivity(access, { action: "content.created", description: `${access.name} aprovou a pauta "${idea.title}" para ${monthName(mes)} (${client.name}).`, entityType: "content", entityId: content._id, clientId: client._id });
    return json({ ok: true, contentId: content._id, projectId: project._id, projectCreated: created });
  } else throw new HttpError(400, "Ação inválida.");

  await savePauta(client._id, mes, row, data);
  return json({ ok: true });
});
