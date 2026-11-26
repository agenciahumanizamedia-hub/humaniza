// POST /api/projects/:id/acao — aprovar ou pedir ajuste (etapa inteira ou um conteúdo).
// Cliente: decide sobre o que foi liberado para ele. Equipe/admin: também podem registrar.
// O cliente nunca edita o conteúdo: só aprova, pede ajuste ou sugere outra ordem.
import type { APIRoute } from "astro";
import { requireAccess, HttpError, requireModule } from "../../../../server/access";
import { COLLECTIONS, getOne, patch } from "../../../../server/db";
import { logActivity } from "../../../../server/activity";
import { handle, json } from "../../../../server/http";
import { readJson, str, historyLine, STAGE_LABEL, type Stage } from "../../../../server/util";
import { loadProjectFor, contentVisibleToClient } from "../../../../server/projects";

const NEXT: Record<string, [string, string] | null> = {
  strategic: ["productionStatus", "Em desenvolvimento"],
  production: ["calendarStatus", "Em desenvolvimento"],
  calendar: ["approvalStatus", "Em desenvolvimento"],
  approval: null,
};

export const POST: APIRoute = handle(async (request, { params }) => {
  const access = await requireAccess();
  requireModule(access, "projetos");
  const { project, client } = await loadProjectFor(access, params.id!);
  const b = await readJson(request);
  const decision = str(b.decision, 20);
  const note = str(b.note, 3000);
  if (!["approve", "adjust", "order"].includes(decision)) throw new HttpError(400, "Ação inválida.");
  if (decision !== "approve" && !note) throw new HttpError(400, "Escreva o que precisa mudar.");
  const who = access.role === "client" ? `${access.name} (cliente)` : access.name;

  if (b.contentId) {
    const content = await getOne(COLLECTIONS.contents, str(b.contentId, 100));
    if (!content || content.projectId !== project._id) throw new HttpError(404, "Conteúdo não encontrado.");
    if (access.role === "client" && !contentVisibleToClient(project, content)) throw new HttpError(404, "Conteúdo não encontrado.");
    const label = decision === "approve" ? "Aprovado" : decision === "adjust" ? "Ajustes" : "Sugestão de ordem";
    await patch(COLLECTIONS.contents, content._id, {
      clientApproval: label,
      clientNote: note,
      clientActionAt: new Date().toISOString(),
      status: decision === "approve" ? "Aprovado" : decision === "adjust" ? "Ajustes" : content.status,
    });
    const text = `${label === "Aprovado" ? "aprovou" : label === "Ajustes" ? "pediu ajuste em" : "sugeriu outra ordem para"} “${content.title || "conteúdo"}”${note ? `: ${note}` : ""}`;
    await patch(COLLECTIONS.projects, project._id, { history: [historyLine(who, text), ...(project.history ?? [])].slice(0, 300) });
    await logActivity(access, {
      action: `content.${decision}`,
      description: `${who} ${text} (${project.period}).`,
      entityType: "content",
      entityId: content._id,
      clientId: client._id,
      visibleToClient: true,
    });
    return json({ ok: true });
  }

  const stage = str(b.stage, 20) as Stage;
  if (!(stage in STAGE_LABEL)) throw new HttpError(400, "Etapa inválida.");
  const key = `${stage}Status`;
  if (access.role === "client" && (!project[key] || project[key] === "Bloqueado")) throw new HttpError(403, "Essa etapa ainda não foi liberada.");
  const changes: Record<string, any> = {};
  let text = "";
  if (decision === "approve") {
    changes[key] = stage === "approval" ? "Finalizado" : "Aprovado";
    const next = NEXT[stage];
    if (next && (!project[next[0]] || project[next[0]] === "Bloqueado")) changes[next[0]] = next[1];
    text = `aprovou ${STAGE_LABEL[stage]}${note ? `: ${note}` : ""}`;
  } else {
    changes[key] = "Ajustes solicitados";
    text = `pediu ajustes em ${STAGE_LABEL[stage]}: ${note}`;
  }
  changes.history = [historyLine(who, text), ...(project.history ?? [])].slice(0, 300);
  await patch(COLLECTIONS.projects, project._id, changes);
  await logActivity(access, {
    action: `project.${decision}`,
    description: `${who} ${text} (${project.period}).`,
    entityType: "project",
    entityId: project._id,
    clientId: client._id,
    visibleToClient: true,
  });
  return json({ ok: true });
});
