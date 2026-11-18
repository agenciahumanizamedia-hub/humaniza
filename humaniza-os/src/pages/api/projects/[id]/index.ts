// GET    /api/projects/:id — projeto/mês com seus conteúdos (o cliente vê só as etapas liberadas).
// PATCH  /api/projects/:id — equipe/admin editam planejamento, calendário, observações e etapas.
// DELETE /api/projects/:id — manda o projeto para a lixeira (admin).
import type { APIRoute } from "astro";
import { requireAccess, HttpError } from "../../../../server/access";
import { COLLECTIONS, findAll, patch } from "../../../../server/db";
import { logActivity } from "../../../../server/activity";
import { handle, json } from "../../../../server/http";
import { readJson, str, cleanHtml, historyLine, STAGES, STAGE_LABEL, STAGE_STATUS } from "../../../../server/util";
import { loadProjectFor, projectView, contentView, contentVisibleToClient } from "../../../../server/projects";

export const GET: APIRoute = handle(async (_req, { params }) => {
  const access = await requireAccess();
  const { project, client } = await loadProjectFor(access, params.id!);
  const contents = (await findAll(COLLECTIONS.contents, { projectId: project._id }))
    .filter((c) => !c.trashedAt && (access.role !== "client" || contentVisibleToClient(project, c)))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((c) => contentView(access, c));
  return json({
    project: projectView(access, project),
    client: { _id: client._id, name: client.name, logoUrl: client.logoUrl ?? "", coverUrl: client.coverUrl ?? "", brand: client.brand ?? null, instagram: client.instagram ?? "" },
    contents,
  });
});

export const PATCH: APIRoute = handle(async (request, { params }) => {
  const access = await requireAccess(["admin", "team"]);
  const { project, client } = await loadProjectFor(access, params.id!);
  const b = await readJson(request);
  const changes: Record<string, any> = {};
  const notes: string[] = [];
  if (b.strategic && typeof b.strategic === "object") {
    changes.strategic = Object.fromEntries(
      ["macro", "editorial", "themes", "creative", "note"].map((k) => [k, k === "note" ? str(b.strategic[k], 4000) : cleanHtml(b.strategic[k])]),
    );
    notes.push("planejamento");
  }
  if (b.calendar && typeof b.calendar === "object") {
    changes.calendar = { content: cleanHtml(b.calendar.content), note: str(b.calendar.note, 4000) };
    notes.push("calendário");
  }
  if ("productionNote" in b) changes.productionNote = str(b.productionNote, 4000);
  if ("approvalNotes" in b) changes.approvalNotes = str(b.approvalNotes, 4000);
  if ("period" in b) {
    changes.period = str(b.period, 120) || project.period;
    if (/^\d{4}-\d{2}$/.test(str(b.periodSort, 7))) changes.periodSort = str(b.periodSort, 7);
  }
  for (const s of STAGES) {
    const key = `${s}Status`;
    if (key in b) {
      const v = str(b[key], 40);
      if (!STAGE_STATUS.includes(v)) throw new HttpError(400, "Status inválido.");
      if (v !== project[key]) {
        changes[key] = v;
        notes.push(`${STAGE_LABEL[s]} → ${v}`);
      }
    }
  }
  if (!Object.keys(changes).length) return json({ ok: true });
  changes.history = [historyLine(access.name, `Alterou ${notes.join(", ") || "observações"}.`), ...(project.history ?? [])].slice(0, 300);
  await patch(COLLECTIONS.projects, project._id, changes);
  const released = notes.filter((n) => n.includes("Liberado ao cliente"));
  await logActivity(access, {
    action: released.length ? "project.released" : "project.updated",
    description: released.length
      ? `${access.name} liberou para aprovação: ${released.join(", ")} (${project.period}).`
      : `${access.name} atualizou ${notes.join(", ") || "o projeto"} de ${project.period}.`,
    entityType: "project",
    entityId: project._id,
    clientId: client._id,
    visibleToClient: released.length > 0,
  });
  return json({ ok: true });
});

export const DELETE: APIRoute = handle(async (_req, { params }) => {
  const access = await requireAccess(["admin"]);
  const { project, client } = await loadProjectFor(access, params.id!);
  await patch(COLLECTIONS.projects, project._id, { trashedAt: new Date().toISOString() });
  await logActivity(access, {
    action: "project.trashed",
    description: `${access.name} mandou o projeto ${project.period} de ${client.name} para a lixeira.`,
    entityType: "project",
    entityId: project._id,
    clientId: client._id,
  });
  return json({ ok: true });
});
