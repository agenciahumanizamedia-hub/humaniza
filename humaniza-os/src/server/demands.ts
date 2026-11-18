import { COLLECTIONS, getOne, type Row } from "./db";
import { loadClientFor, HttpError, type Access } from "./access";

export const COLUMNS = ["A fazer", "Em andamento", "Em revisão", "Aguardando cliente", "Concluído"];

export function demandView(d: Row) {
  return {
    _id: d._id, title: d.title ?? "", description: d.description ?? "", clientId: d.clientId ?? "", column: d.column ?? COLUMNS[0],
    priority: d.priority ?? "Média", dueDate: d.dueDate ?? "", assignees: d.assignees ?? [], links: d.links ?? [], imageUrl: d.imageUrl ?? "",
    order: d.order ?? 0, createdBy: d.createdBy ?? "", checklist: d.checklist ?? [], comments: d.comments ?? [], trashedAt: d.trashedAt ?? "",
  };
}

export async function loadDemandFor(access: Access, id: string): Promise<Row> {
  const d = await getOne(COLLECTIONS.demands, id);
  if (!d) throw new HttpError(404, "Demanda não encontrada.");
  if (access.role === "admin") return d;
  if (access.role !== "team") throw new HttpError(403, "Sem acesso.");
  if ((d.assignees ?? []).includes(access.email) || d.createdBy === access.email) return d;
  if (d.clientId) {
    await loadClientFor(access, d.clientId);
    return d;
  }
  throw new HttpError(404, "Demanda não encontrada.");
}
