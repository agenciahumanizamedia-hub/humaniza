// PATCH  /api/contents/:id — equipe/admin editam o roteiro (campos, data, status, checklist…).
// DELETE /api/contents/:id — lixeira (?restaurar=1 tira da lixeira; ?definitivo=1 apaga, só admin).
import type { APIRoute } from "astro";
import { requireAccess, HttpError, requireModule } from "../../../server/access";
import { COLLECTIONS, patch, removeOne } from "../../../server/db";
import { logActivity } from "../../../server/activity";
import { handle, json } from "../../../server/http";
import { readJson, str, cleanHtml } from "../../../server/util";
import { loadContentFor } from "../../../server/projects";

const FIELDS = ["tema", "objetivo", "gancho", "desenvolvimento", "slides", "mensagem", "legenda", "cta"];
const STATUS = ["Em criação", "Aguardando aprovação", "Aprovado", "Ajustes", "Em produção", "Agendado", "Postado"];
const url = (v: unknown) => {
  const s = str(v, 1000);
  return !s || /^https?:\/\//.test(s) ? s : "https://" + s;
};

export const PATCH: APIRoute = handle(async (request, { params }) => {
  const access = await requireAccess(["admin", "team"]);
  requireModule(access, "projetos");
  const { content } = await loadContentFor(access, params.id!);
  const b = await readJson(request);
  const changes: Record<string, any> = { updatedBy: access.name };
  if (b.fields && typeof b.fields === "object") {
    const fields = { ...(content.fields ?? {}) };
    for (const k of FIELDS) if (k in b.fields) fields[k] = cleanHtml(b.fields[k]);
    changes.fields = fields;
    changes.title = (fields.tema || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 300) || content.title;
  }
  if ("type" in b && ["roteiro", "carrossel", "estatico"].includes(str(b.type, 20))) changes.type = str(b.type, 20);
  if ("postDate" in b) changes.postDate = /^\d{4}-\d{2}-\d{2}$/.test(str(b.postDate, 10)) ? str(b.postDate, 10) : "";
  if ("week" in b) changes.week = str(b.week, 20);
  if ("status" in b) {
    if (!STATUS.includes(str(b.status, 40))) throw new HttpError(400, "Status inválido.");
    changes.status = str(b.status, 40);
  }
  if ("responsible" in b) changes.responsible = str(b.responsible, 200);
  if ("note" in b) changes.note = str(b.note, 4000);
  if ("driveLink" in b) changes.driveLink = url(b.driveLink);
  if ("referenceLink" in b) changes.referenceLink = url(b.referenceLink);
  if ("order" in b && Number.isFinite(Number(b.order))) changes.order = Number(b.order);
  if (Array.isArray(b.checklist))
    changes.checklist = b.checklist.slice(0, 30).map((c: any) => ({ label: str(c?.label, 120), done: !!c?.done })).filter((c: any) => c.label);
  await patch(COLLECTIONS.contents, content._id, changes);
  return json({ ok: true });
});

export const DELETE: APIRoute = handle(async (_req, { params, url: u }) => {
  const restore = u.searchParams.get("restaurar") === "1";
  const forever = u.searchParams.get("definitivo") === "1";
  const access = await requireAccess(forever ? ["admin"] : ["admin", "team"]);
  requireModule(access, ...(restore ? (["lixeira"] as const) : (["projetos"] as const)));
  const { content, client } = await loadContentFor(access, params.id!);
  if (forever) {
    if (!content.trashedAt) throw new HttpError(400, "Mande para a lixeira antes de apagar de vez.");
    await removeOne(COLLECTIONS.contents, content._id);
  } else {
    await patch(COLLECTIONS.contents, content._id, { trashedAt: restore ? "" : new Date().toISOString() });
  }
  await logActivity(access, {
    action: forever ? "content.deleted" : restore ? "content.restored" : "content.trashed",
    description: `${access.name} ${forever ? "apagou definitivamente" : restore ? "restaurou" : "mandou para a lixeira"} “${content.title || "conteúdo"}” (${client.name}).`,
    entityType: "content",
    entityId: content._id,
    clientId: client._id,
  });
  return json({ ok: true });
});
