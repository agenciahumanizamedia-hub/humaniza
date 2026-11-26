// GET  /api/clients/:id/datas — datas importantes e campanhas do cliente + sugestões do calendário
//      comercial para os próximos meses (sugestões só para equipe/admin).
// POST /api/clients/:id/datas — adiciona uma data/campanha (equipe/admin).
import type { APIRoute } from "astro";
import { requireAccess, loadClientFor, HttpError } from "../../../../server/access";
import { COLLECTIONS, findAll, create } from "../../../../server/db";
import { logActivity } from "../../../../server/activity";
import { handle, json } from "../../../../server/http";
import { readJson, str } from "../../../../server/util";
import { commercialCalendar, segmentTags } from "../../../../server/commercial-dates";

export const KINDS = ["Data importante", "Campanha comercial", "Lançamento", "Evento", "Sazonal"];
export const STATUS = ["Ideia", "Planejada", "Em produção", "No ar", "Concluída"];

export function plannerView(r: any, client: boolean) {
  const v: any = {
    _id: r._id, date: r.date ?? "", endDate: r.endDate ?? "", kind: r.kind ?? KINDS[0], title: r.title ?? "", description: r.description ?? "",
    status: r.status ?? STATUS[0], color: r.color ?? "", visibleToClient: !!r.visibleToClient,
  };
  if (!client) Object.assign(v, { budget: r.budget ?? "", channels: r.channels ?? [], internalNote: r.internalNote ?? "" });
  return v;
}

export const GET: APIRoute = handle(async (_req, { params }) => {
  const access = await requireAccess();
  const client = await loadClientFor(access, params.id!);
  const isClient = access.role === "client";
  const rows = (await findAll(COLLECTIONS.planner, { clientId: client._id }))
    .filter((r) => !r.trashedAt && (!isClient || r.visibleToClient))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const today = new Date().toISOString().slice(0, 10);
  let suggestions: any[] = [];
  if (!isClient) {
    const tags = segmentTags(`${client.name} ${client.serviceCustom ?? ""} ${client.notes ?? ""} ${client.brand?.notes ?? ""}`);
    const taken = new Set(rows.map((r) => `${r.date}|${String(r.title).toLowerCase()}`));
    suggestions = commercialCalendar(today, 5)
      .filter((s) => s.tags.some((t) => tags.includes(t)))
      .filter((s) => !taken.has(`${s.date}|${s.title.toLowerCase()}`));
  }
  return json({ items: rows.map((r) => plannerView(r, isClient)), suggestions });
});

export const POST: APIRoute = handle(async (request, { params }) => {
  const access = await requireAccess(["admin", "team"]);
  const client = await loadClientFor(access, params.id!);
  const b = await readJson(request);
  const title = str(b.title, 200);
  const date = str(b.date, 10);
  if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new HttpError(400, "Informe título e data.");
  const row = await create(COLLECTIONS.planner, {
    clientId: client._id, date, endDate: /^\d{4}-\d{2}-\d{2}$/.test(str(b.endDate, 10)) ? str(b.endDate, 10) : "",
    kind: KINDS.includes(str(b.kind, 40)) ? str(b.kind, 40) : KINDS[0], title, description: str(b.description, 3000),
    status: STATUS.includes(str(b.status, 40)) ? str(b.status, 40) : STATUS[0], visibleToClient: b.visibleToClient !== false,
    budget: str(b.budget, 60), channels: Array.isArray(b.channels) ? b.channels.map((c: any) => str(c, 40)).slice(0, 10) : [],
    internalNote: str(b.internalNote, 2000), color: str(b.color, 7), trashedAt: "", createdBy: access.email,
  });
  await logActivity(access, {
    action: "planner.created",
    description: `${access.name} adicionou “${title}” (${date.split("-").reverse().join("/")}) ao planejamento de ${client.name}.`,
    entityType: "planner", entityId: row._id, clientId: client._id, visibleToClient: b.visibleToClient !== false,
  });
  return json({ _id: row._id }, 201);
});
