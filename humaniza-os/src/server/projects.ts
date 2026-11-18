// Regras de projetos/mês e conteúdos: quem vê o quê.
import { COLLECTIONS, getOne, type Row } from "./db";
import { loadClientFor, HttpError, type Access } from "./access";

export async function loadProjectFor(access: Access, id: string): Promise<{ project: Row; client: Row }> {
  const project = await getOne(COLLECTIONS.projects, id);
  if (!project || project.trashedAt) throw new HttpError(404, "Projeto não encontrado.");
  const client = await loadClientFor(access, project.clientId);
  return { project, client };
}

export async function loadContentFor(access: Access, id: string): Promise<{ content: Row; client: Row }> {
  const content = await getOne(COLLECTIONS.contents, id);
  if (!content) throw new HttpError(404, "Conteúdo não encontrado.");
  const client = await loadClientFor(access, content.clientId);
  return { content, client };
}

const hidden = (status: unknown) => !status || status === "Bloqueado";

/** O cliente só vê etapas que não estão bloqueadas. Equipe e admin veem tudo. */
export function projectView(access: Access, p: Row) {
  const base = {
    _id: p._id,
    clientId: p.clientId,
    period: p.period,
    periodSort: p.periodSort ?? "",
    strategicStatus: p.strategicStatus,
    productionStatus: p.productionStatus,
    calendarStatus: p.calendarStatus,
    approvalStatus: p.approvalStatus,
    history: (p.history ?? []).slice(0, access.role === "client" ? 30 : 200),
  };
  if (access.role !== "client")
    return { ...base, strategic: p.strategic ?? {}, calendar: p.calendar ?? {}, productionNote: p.productionNote ?? "", approvalNotes: p.approvalNotes ?? "" };
  return {
    ...base,
    strategic: hidden(p.strategicStatus) ? null : p.strategic ?? {},
    calendar: hidden(p.calendarStatus) ? null : { content: p.calendar?.content ?? "", note: p.calendar?.note ?? "" },
    productionNote: hidden(p.productionStatus) ? "" : p.productionNote ?? "",
    approvalNotes: hidden(p.approvalStatus) ? "" : p.approvalNotes ?? "",
  };
}

export function contentVisibleToClient(project: Row | null, c: Row): boolean {
  if (c.trashedAt) return false;
  if (!project) return false;
  return !hidden(project.productionStatus);
}

export function contentView(access: Access, c: Row) {
  const v: Record<string, unknown> = {
    _id: c._id,
    clientId: c.clientId,
    projectId: c.projectId,
    type: c.type,
    order: c.order ?? 0,
    title: c.title ?? "",
    fields: c.fields ?? {},
    postDate: c.postDate ?? "",
    week: c.week ?? "",
    status: c.status ?? "",
    driveLink: c.driveLink ?? "",
    referenceLink: c.referenceLink ?? "",
    clientApproval: c.clientApproval ?? "",
    clientNote: c.clientNote ?? "",
    clientActionAt: c.clientActionAt ?? "",
  };
  if (access.role !== "client") {
    Object.assign(v, { responsible: c.responsible ?? "", checklist: c.checklist ?? [], note: c.note ?? "", source: c.source ?? "", trashedAt: c.trashedAt ?? "" });
  }
  return v;
}
