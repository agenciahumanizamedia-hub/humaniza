// DELETE /api/events/:id — remove o compromisso do calendário (vai para a lixeira). Admin e equipe.
import type { APIRoute } from "astro";
import { requireAccess, loadClientFor, HttpError } from "../../../server/access";
import { COLLECTIONS, getOne, patch } from "../../../server/db";
import { handle, json } from "../../../server/http";

export const DELETE: APIRoute = handle(async (_req, { params }) => {
  const access = await requireAccess(["admin", "team"]);
  const e = await getOne(COLLECTIONS.events, params.id!);
  if (!e) throw new HttpError(404, "Compromisso não encontrado.");
  if (e.clientId) await loadClientFor(access, e.clientId);
  else if (access.role !== "admin" && e.responsibleEmail !== access.email) throw new HttpError(403, "Sem acesso.");
  await patch(COLLECTIONS.events, e._id, { trashedAt: new Date().toISOString() });
  return json({ ok: true });
});
