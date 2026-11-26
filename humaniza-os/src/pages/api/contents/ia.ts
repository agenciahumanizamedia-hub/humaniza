// POST /api/contents/ia { contentId, pedido? } — o Claude sugere 3 ganchos e um ajuste de legenda/CTA para
// um roteiro, usando o tom da marca e os posts que mais engajaram do cliente. Equipe/admin.
import type { APIRoute } from "astro";
import { requireAccess, HttpError, requireModule } from "../../../server/access";
import { COLLECTIONS, findAll } from "../../../server/db";
import { handle, json } from "../../../server/http";
import { readJson, str } from "../../../server/util";
import { loadContentFor } from "../../../server/projects";
import { askClaude, plain, MODEL } from "../../../server/ai";

export const POST: APIRoute = handle(async (request) => {
  const access = await requireAccess(["admin", "team"]);
  requireModule(access, "projetos");
  const b = await readJson(request);
  const { content, client } = await loadContentFor(access, str(b.contentId, 100));
  if (content.trashedAt) throw new HttpError(404, "Conteúdo não encontrado.");
  const media = (await findAll(COLLECTIONS.metrics, { clientId: client._id, source: "ig_media" }))
    .map((m) => m.data ?? {})
    .filter((d) => typeof d.interactions === "number" && typeof d.reach === "number" && d.reach > 0 && d.type !== "Story")
    .sort((a, b) => b.interactions / b.reach - a.interactions / a.reach)
    .slice(0, 5)
    .map((d) => ({ formato: d.type, legenda: String(d.caption ?? "").slice(0, 250), interacoes: d.interactions, alcance: d.reach }));
  const f = content.fields ?? {};
  const system = `Você é roteirista sênior de Instagram da Agência Humaniza. Português do Brasil. Ganchos curtos (até 15 palavras), específicos, sem clickbait enganoso, no tom da marca. Use apenas as informações fornecidas. Responda APENAS com JSON válido.`;
  const ask = `Roteiro (${content.type === "roteiro" ? "Reels" : content.type === "carrossel" ? "Carrossel" : "Estático"}) do cliente ${client.name}.
Tom de voz: ${client.brand?.tone || "não informado"}. Observações da marca: ${client.brand?.notes || "—"}.
Tema: ${plain(f.tema)}
Objetivo: ${plain(f.objetivo)}
Gancho atual: ${plain(f.gancho) || "(vazio)"}
Desenvolvimento: ${plain(f.desenvolvimento || f.slides || f.mensagem).slice(0, 1200)}
Legenda atual: ${plain(f.legenda).slice(0, 600)}
CTA atual: ${plain(f.cta)}
Comentário do cliente: ${content.clientNote || "—"}
Pedido da equipe: ${str(b.pedido, 400) || "melhorar o gancho para prender nos 3 primeiros segundos"}
Posts que mais engajaram este cliente (Instagram): ${media.length ? JSON.stringify(media) : "ainda sem dados do Instagram"}

Devolva:
{ "ganchos": [ { "texto": "...", "por_que": "..." } ], "ajuste_legenda": "primeira linha da legenda sugerida", "cta": "CTA sugerido", "observacao": "1 frase sobre o que mais mudaria no roteiro" }
Exatamente 3 ganchos com abordagens diferentes (pergunta, número/dado, contraste ou bastidor).`;
  const out = await askClaude(system, ask, 900);
  return json({
    model: MODEL,
    hooks: (Array.isArray(out.ganchos) ? out.ganchos : []).slice(0, 3).map((g: any) => ({ text: str(g?.texto, 200), why: str(g?.por_que, 300) })).filter((g: any) => g.text),
    caption: str(out.ajuste_legenda, 400),
    cta: str(out.cta, 200),
    note: str(out.observacao, 400),
  });
});
