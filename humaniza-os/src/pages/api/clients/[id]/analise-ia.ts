// POST /api/clients/:id/analise-ia { de, ate } — o Claude lê os dados do período (Instagram, anúncios,
// roteiros e datas do Humaniza OS) e devolve um RASCUNHO de análise: resumo, sugestões com base nos
// números, ganchos para reescrever, temas para aprofundar e próximos passos. Equipe/admin.
import type { APIRoute } from "astro";
import { requireAccess, loadClientFor, HttpError, requireModule } from "../../../../server/access";
import { COLLECTIONS, findAll } from "../../../../server/db";
import { handle, json } from "../../../../server/http";
import { readJson, str } from "../../../../server/util";
import { aggregateIg, aggregateAds, daysBetween } from "../../../../server/insights";
import { askClaude, plain, ANALYST_SYSTEM, MODEL } from "../../../../server/ai";
import { logActivity } from "../../../../server/activity";

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const shift = (d: string, n: number) => new Date(Date.parse(d + "T12:00:00Z") + n * 86400e3).toISOString().slice(0, 10);
const TYPE_PT: Record<string, string> = { roteiro: "Reels", carrossel: "Carrossel", estatico: "Estático" };

export const POST: APIRoute = handle(async (request, { params }) => {
  const access = await requireAccess(["admin", "team"]);
  requireModule(access, "resultados");
  const client = await loadClientFor(access, params.id!);
  const b = await readJson(request);
  const de = str(b.de, 10), ate = str(b.ate, 10);
  if (!ISO.test(de) || !ISO.test(ate) || de > ate) throw new HttpError(400, "Período inválido.");
  const len = daysBetween(de, ate).length;
  const pde = shift(de, -len), pate = shift(de, -1);
  const [metrics, contents, planner] = await Promise.all([
    findAll(COLLECTIONS.metrics, { clientId: client._id }),
    findAll(COLLECTIONS.contents, { clientId: client._id }),
    findAll(COLLECTIONS.planner, { clientId: client._id }),
  ]);
  const src = (s: string) => metrics.filter((m) => m.source === s);
  const hasIg = src("ig_day").length || src("ig_media").length;
  const ig = hasIg ? aggregateIg(src("ig_day"), src("ig_profile"), src("ig_media"), de, ate) : null;
  const prevIg = hasIg ? aggregateIg(src("ig_day"), src("ig_profile"), src("ig_media"), pde, pate) : null;
  const ads = src("ads_day").length ? aggregateAds(src("ads_day"), de, ate) : null;

  const period = contents.filter((c) => !c.trashedAt && c.postDate >= de && c.postDate <= ate);
  const next = contents.filter((c) => !c.trashedAt && c.postDate > ate).sort((a, b) => a.postDate.localeCompare(b.postDate)).slice(0, 12);
  const roteiro = (c: any) => ({
    data: c.postDate, formato: TYPE_PT[c.type] ?? c.type, status: c.status, aprovacao_cliente: c.clientApproval || "—", comentario_cliente: c.clientNote || "",
    tema: plain(c.fields?.tema).slice(0, 200), gancho: plain(c.fields?.gancho).slice(0, 300), objetivo: plain(c.fields?.objetivo).slice(0, 200),
    legenda_inicio: plain(c.fields?.legenda).slice(0, 220), cta: plain(c.fields?.cta).slice(0, 120),
  });
  const post = (p: any) => ({
    data: p.date, formato: p.type, legenda: String(p.caption ?? "").slice(0, 300), alcance: p.reach, visualizacoes: p.views, interacoes: p.interactions,
    curtidas: p.likes, comentarios: p.comments, salvos: p.saves, compartilhamentos: p.shares,
    taxa_interacao_sobre_alcance: p.engagementRate === null ? null : Number((p.engagementRate * 100).toFixed(2)),
  });
  const data = {
    cliente: { nome: client.name, servico: client.serviceType ?? "", tom_de_voz: client.brand?.tone ?? "", observacoes_marca: client.brand?.notes ?? "", instagram: client.instagram ?? "" },
    periodo: { de, ate, comparado_com: { de: pde, ate: pate } },
    instagram: ig
      ? {
          fonte: "Instagram (Meta)", dias_com_dados: `${ig.coverage.withData}/${ig.coverage.days}`, seguidores: ig.followers,
          totais: ig.totals, totais_periodo_anterior: prevIg?.totals ?? null,
          posts: ig.posts.filter((p: any) => p.type !== "Story").slice(0, 40).map(post),
        }
      : "Instagram ainda não conectado: sem métricas de publicações.",
    anuncios: ads
      ? { fonte: "Gerenciador de Anúncios (Meta)", totais: ads.totals, campanhas: ads.campaigns.slice(0, 15).map((c) => ({ nome: c.name, mede: c.resultLabel, investido: c.spend, resultados: c.results, custo_por_resultado: c.costPerResult, conversas: c.conversations, ctr: c.ctr })) }
      : "Sem dados de anúncios.",
    roteiros_do_periodo: { fonte: "Humaniza OS", itens: period.slice(0, 40).map(roteiro) },
    proximos_roteiros: { fonte: "Humaniza OS", itens: next.map(roteiro) },
    proximas_datas: planner.filter((p) => !p.trashedAt && p.date > ate).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 10).map((p) => ({ data: p.date, titulo: p.title, tipo: p.kind })),
  };
  const ask = `Analise o período do cliente e devolva este JSON:
{
  "resumo": "3 a 5 frases: o que a Humaniza entregou, o que trouxe resultado e o foco do próximo período",
  "sugestoes": [ { "tipo": "funcionou|repetir|melhorar|teste", "texto": "recomendação específica", "base": [ { "indicador": "...", "valor": "...", "fonte": "Instagram (Meta) | Gerenciador de Anúncios (Meta) | Humaniza OS" } ] } ],
  "ganchos": [ { "tema": "tema do roteiro/post", "gancho_atual": "texto atual ou vazio", "gancho_sugerido": "novo gancho de até 15 palavras", "motivo": "por que funciona melhor" } ],
  "temas_para_aprofundar": [ { "tema": "...", "motivo": "com base em qual dado", "ideia_de_conteudo": "formato + abordagem" } ],
  "proximos_passos": [ "ação objetiva" ]
}
Entre 4 e 8 sugestões (pelo menos 1 de cada tipo quando houver base), até 5 ganchos (priorize os próximos roteiros), até 4 temas e até 5 próximos passos.

DADOS:
${JSON.stringify(data)}`;
  const out = await askClaude(ANALYST_SYSTEM, ask, 3000);
  const kinds = ["funcionou", "repetir", "melhorar", "teste"];
  const suggestions = (Array.isArray(out.sugestoes) ? out.sugestoes : []).slice(0, 10).map((s: any, i: number) => ({
    id: `ia-${Date.now()}-${i}`, kind: kinds.includes(s?.tipo) ? s.tipo : "melhorar", text: str(s?.texto, 600), approved: false, ai: true,
    evidence: (Array.isArray(s?.base) ? s.base : []).slice(0, 4).map((e: any) => ({ label: str(e?.indicador, 120), value: str(e?.valor, 120), source: str(e?.fonte, 80) || "Humaniza OS" })),
  })).filter((s: any) => s.text);
  await logActivity(access, { action: "ai.analysis", description: `${access.name} gerou um rascunho de análise com o Claude para ${client.name}.`, entityType: "report", entityId: client._id, clientId: client._id });
  return json({
    model: MODEL,
    summary: str(out.resumo, 2000),
    suggestions,
    hooks: (Array.isArray(out.ganchos) ? out.ganchos : []).slice(0, 6).map((h: any) => ({ theme: str(h?.tema, 200), current: str(h?.gancho_atual, 300), suggested: str(h?.gancho_sugerido, 200), why: str(h?.motivo, 300) })),
    themes: (Array.isArray(out.temas_para_aprofundar) ? out.temas_para_aprofundar : []).slice(0, 5).map((t: any) => ({ theme: str(t?.tema, 200), why: str(t?.motivo, 300), idea: str(t?.ideia_de_conteudo, 300) })),
    nextSteps: (Array.isArray(out.proximos_passos) ? out.proximos_passos : []).slice(0, 6).map((x: any) => str(x, 300)).filter(Boolean),
  });
});
