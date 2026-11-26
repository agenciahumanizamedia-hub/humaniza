// GET    /api/quotes/ID — um orçamento (somente admin).
// PATCH  /api/quotes/ID — salva o orçamento inteiro (campos do editor) ou só { status }.
// DELETE /api/quotes/ID — apaga o orçamento.
import type { APIRoute } from "astro";
import { requireAccess, HttpError } from "../../../server/access";
import { getOne, removeOne, replace, COLLECTIONS } from "../../../server/db";
import { logActivity } from "../../../server/activity";
import { handle, json } from "../../../server/http";
import { readJson, historyLine } from "../../../server/util";
import { QUOTE_STATUS, cleanQuote, totals, type QuoteStatus } from "../../../server/quotes";

const LABEL: Record<string, string> = { rascunho: "rascunho", enviado: "enviado", aprovado: "aprovado", recusado: "recusado" };

export const GET: APIRoute = handle(async (_req, { params }) => {
  await requireAccess(["admin"]);
  const row = await getOne(COLLECTIONS.quotes, params.id ?? "");
  if (!row) throw new HttpError(404, "Orçamento não encontrado.");
  return json(row);
});

export const PATCH: APIRoute = handle(async (request, { params }) => {
  const access = await requireAccess(["admin"]);
  const row = await getOne(COLLECTIONS.quotes, params.id ?? "");
  if (!row) throw new HttpError(404, "Orçamento não encontrado.");
  const b = await readJson(request);
  const history: string[] = Array.isArray(row.history) ? row.history.slice(-80) : [];

  // Só mudar o status (botões da lista).
  if (Object.keys(b).length === 1 && "status" in b) {
    const status = String(b.status) as QuoteStatus;
    if (!QUOTE_STATUS.includes(status)) throw new HttpError(400, "Status inválido.");
    if (status === row.status) return json({ ok: true });
    history.push(historyLine(access.name, `marcou como ${LABEL[status]}`));
    await replace(COLLECTIONS.quotes, { ...row, status, history });
    await logActivity(access, {
      action: "quote.status",
      description: `${access.name} marcou o orçamento de ${row.prospectName} como ${LABEL[status]}.`,
      entityType: "quote",
      entityId: row._id,
    });
    return json({ ok: true });
  }

  const q = cleanQuote({ ...row, ...b });
  history.push(historyLine(access.name, "editou o orçamento"));
  await replace(COLLECTIONS.quotes, { ...row, ...q, ...totals(q), history });
  return json({ ok: true });
});

export const DELETE: APIRoute = handle(async (_req, { params }) => {
  const access = await requireAccess(["admin"]);
  const row = await getOne(COLLECTIONS.quotes, params.id ?? "");
  if (!row) throw new HttpError(404, "Orçamento não encontrado.");
  await removeOne(COLLECTIONS.quotes, row._id);
  await logActivity(access, {
    action: "quote.deleted",
    description: `${access.name} apagou o orçamento de ${row.prospectName}.`,
    entityType: "quote",
    entityId: row._id,
  });
  return json({ ok: true });
});
