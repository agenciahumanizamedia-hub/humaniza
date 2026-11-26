// PATCH  /api/demands/:id — mover de coluna, editar, marcar checklist, comentar.
// DELETE /api/demands/:id — lixeira (?restaurar=1 tira da lixeira; ?definitivo=1 apaga, só admin).
import type { APIRoute } from "astro";
import { requireAccess, loadClientFor, HttpError, requireModule } from "../../../server/access";
import { COLLECTIONS, patch, removeOne } from "../../../server/db";
import { logActivity } from "../../../server/activity";
import { handle, json } from "../../../server/http";
import { readJson, str } from "../../../server/util";
import { loadDemandFor, COLUMNS } from "../../../server/demands";

export const PATCH: APIRoute = handle(async (request, { params }) => {
  const access = await requireAccess(["admin", "team"]);
  requireModule(access, "demandas");
  const d = await loadDemandFor(access, params.id!);
  const b = await readJson(request);
  const changes: Record<string, any> = {};
  if ("title" in b) changes.title = str(b.title, 200) || d.title;
  if ("description" in b) changes.description = str(b.description, 4000);
  if ("column" in b) {
    if (!COLUMNS.includes(str(b.column, 40))) throw new HttpError(400, "Coluna inválida.");
    changes.column = str(b.column, 40);
  }
  if ("priority" in b && ["Baixa", "Média", "Alta", "Urgente"].includes(str(b.priority, 20))) changes.priority = str(b.priority, 20);
  if ("dueDate" in b) changes.dueDate = /^\d{4}-\d{2}-\d{2}$/.test(str(b.dueDate, 10)) ? str(b.dueDate, 10) : "";
  if ("order" in b && Number.isFinite(Number(b.order))) changes.order = Number(b.order);
  if ("clientId" in b) {
    const id = str(b.clientId, 100);
    changes.clientId = id ? (await loadClientFor(access, id))._id : "";
  }
  if (Array.isArray(b.assignees)) changes.assignees = b.assignees.map((e: any) => str(e, 200).toLowerCase()).filter((e: string) => e.includes("@")).slice(0, 10);
  if (Array.isArray(b.links)) changes.links = b.links.map((l: any) => str(l, 1000)).filter((l: string) => /^https?:\/\//.test(l)).slice(0, 20);
  if ("imageUrl" in b) changes.imageUrl = /^https:\/\//.test(str(b.imageUrl, 1000)) ? str(b.imageUrl, 1000) : "";
  if (Array.isArray(b.checklist)) changes.checklist = b.checklist.slice(0, 40).map((c: any) => ({ label: str(c?.label, 200), done: !!c?.done })).filter((c: any) => c.label);
  if (str(b.comment, 2000))
    changes.comments = [...(d.comments ?? []), { by: access.name, at: new Date().toISOString(), text: str(b.comment, 2000) }].slice(-100);
  await patch(COLLECTIONS.demands, d._id, changes);
  if (changes.column && changes.column !== d.column)
    await logActivity(access, {
      action: "demand.moved",
      description: `${access.name} moveu “${d.title}” para ${changes.column}.`,
      entityType: "demand", entityId: d._id, clientId: d.clientId ?? "",
    });
  return json({ ok: true });
});

export const DELETE: APIRoute = handle(async (_req, { params, url }) => {
  const restore = url.searchParams.get("restaurar") === "1";
  const forever = url.searchParams.get("definitivo") === "1";
  const access = await requireAccess(forever ? ["admin"] : ["admin", "team"]);
  requireModule(access, ...(restore ? (["lixeira"] as const) : (["demandas"] as const)));
  const d = await loadDemandFor(access, params.id!);
  if (forever) {
    if (!d.trashedAt) throw new HttpError(400, "Mande para a lixeira antes de apagar de vez.");
    await removeOne(COLLECTIONS.demands, d._id);
  } else await patch(COLLECTIONS.demands, d._id, { trashedAt: restore ? "" : new Date().toISOString() });
  await logActivity(access, {
    action: forever ? "demand.deleted" : restore ? "demand.restored" : "demand.trashed",
    description: `${access.name} ${forever ? "apagou definitivamente" : restore ? "restaurou" : "mandou para a lixeira"} a demanda “${d.title}”.`,
    entityType: "demand", entityId: d._id, clientId: d.clientId ?? "",
  });
  return json({ ok: true });
});
