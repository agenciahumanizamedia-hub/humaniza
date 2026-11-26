// Link público do orçamento (o cliente NÃO precisa de login).
// GET  /api/orcamento?t=TOKEN — dados do orçamento para o cliente ver (sem anotações internas).
// POST /api/orcamento         — { t, decisao: "aprovar" | "recusar", nome, obs } registra a resposta.
//
// Segurança: o token é aleatório (144 bits) e só serve para ESTE orçamento. A resposta só vale uma
// vez e não vale depois da validade. Quem decidiu fica registrado com nome, data e hora.
import type { APIRoute } from "astro";
import { HttpError } from "../../server/access";
import { create, find, replace, COLLECTIONS } from "../../server/db";
import { handle, json } from "../../server/http";
import { historyLine, readJson, str } from "../../server/util";
import { publicView } from "../../server/quotes";

async function byToken(t: string) {
  if (!/^[0-9a-f]{36}$/.test(t)) throw new HttpError(404, "Orçamento não encontrado.");
  const [row] = await find(COLLECTIONS.quotes, { publicToken: t }, { limit: 1 });
  if (!row) throw new HttpError(404, "Orçamento não encontrado.");
  return row;
}

const today = () => new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);

export const GET: APIRoute = handle(async (_req, { url }) => {
  const row = await byToken(url.searchParams.get("t") ?? "");
  return json({ ...publicView(row), expired: !!row.validity && row.validity < today() });
});

export const POST: APIRoute = handle(async (request) => {
  const b = await readJson(request);
  const row = await byToken(str(b.t, 60));
  const decision = b.decisao === "aprovar" ? "aprovado" : b.decisao === "recusar" ? "recusado" : "";
  if (!decision) throw new HttpError(400, "Escolha aprovar ou recusar.");
  if (row.status === "aprovado" || row.status === "recusado") throw new HttpError(409, "Este orçamento já foi respondido.");
  if (row.validity && row.validity < today()) throw new HttpError(409, "Este orçamento venceu. Fale com a Humaniza para receber um novo.");
  const name = str(b.nome, 120);
  if (!name) throw new HttpError(400, "Informe o seu nome.");
  const note = str(b.obs, 1000);
  const history: string[] = Array.isArray(row.history) ? row.history.slice(-80) : [];
  history.push(historyLine(`${name} (pelo link)`, `${decision === "aprovado" ? "aprovou" : "recusou"} o orçamento${note ? `: ${note}` : ""}`));
  const decidedAt = new Date().toISOString();
  await replace(COLLECTIONS.quotes, { ...row, status: decision, decisionName: name, decisionNote: note, decidedAt, history });
  await create(COLLECTIONS.activity, {
    action: `quote.${decision}`,
    description: `${name} ${decision === "aprovado" ? "aprovou" : "recusou"} pelo link o orçamento de ${row.prospectName}.${note ? ` Observação: ${note}` : ""}`,
    entityType: "quote",
    entityId: row._id,
    clientId: row.clientId ?? "",
    visibleToClient: false,
    actorEmail: "",
    actorName: name,
    actorRole: "client",
  });
  return json({ ok: true, status: decision, decidedAt });
});
