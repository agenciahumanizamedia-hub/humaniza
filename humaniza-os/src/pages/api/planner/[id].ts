// PATCH  /api/planner/:id — edita data/campanha. DELETE — remove (vai para a lixeira). Equipe/admin.
import type { APIRoute } from "astro";
import { requireAccess, loadClientFor, HttpError, requireModule } from "../../../server/access";
import { COLLECTIONS, getOne, patch } from "../../../server/db";
import { handle, json } from "../../../server/http";
import { readJson, str } from "../../../server/util";

const KINDS = ["Data importante", "Campanha comercial", "Lançamento", "Captação", "Prazo de aprovação", "Próxima ação", "Evento", "Sazonal"];
const STATUS = ["Ideia", "Planejada", "Em produção", "No ar", "Concluída"];

async function load(access: any, id: string) {
  const r = await getOne(COLLECTIONS.planner, id);
  if (!r || r.trashedAt) throw new HttpError(404, "Item não encontrado.");
  await loadClientFor(access, r.clientId);
  return r;
}

export const PATCH: APIRoute = handle(async (request, { params }) => {
  const access = await requireAccess(["admin", "team"]);
  requireModule(access, "calendario");
  const r = await load(access, params.id!);
  const b = await readJson(request);
  const c: Record<string, any> = {};
  if ("title" in b) c.title = str(b.title, 200) || r.title;
  if ("date" in b && /^\d{4}-\d{2}-\d{2}$/.test(str(b.date, 10))) c.date = str(b.date, 10);
  if ("endDate" in b) c.endDate = /^\d{4}-\d{2}-\d{2}$/.test(str(b.endDate, 10)) ? str(b.endDate, 10) : "";
  if ("kind" in b && KINDS.includes(str(b.kind, 40))) c.kind = str(b.kind, 40);
  if ("status" in b && STATUS.includes(str(b.status, 40))) c.status = str(b.status, 40);
  if ("description" in b) c.description = str(b.description, 3000);
  if ("internalNote" in b) c.internalNote = str(b.internalNote, 2000);
  if ("budget" in b) c.budget = str(b.budget, 60);
  if ("visibleToClient" in b) c.visibleToClient = !!b.visibleToClient;
  if (Array.isArray(b.channels)) c.channels = b.channels.map((x: any) => str(x, 40)).slice(0, 10);
  await patch(COLLECTIONS.planner, r._id, c);
  return json({ ok: true });
});

export const DELETE: APIRoute = handle(async (_req, { params }) => {
  const access = await requireAccess(["admin", "team"]);
  requireModule(access, "calendario");
  const r = await load(access, params.id!);
  await patch(COLLECTIONS.planner, r._id, { trashedAt: new Date().toISOString() });
  return json({ ok: true });
});
