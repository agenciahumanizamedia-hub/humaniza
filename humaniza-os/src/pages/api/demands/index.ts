// GET  /api/demands — quadro de demandas da equipe (estilo Trello). Admin vê tudo; equipe vê as
//      dos clientes que atende e as atribuídas a ela. Cliente não acessa.
// POST /api/demands — nova demanda.
import type { APIRoute } from "astro";
import { requireAccess, loadClientFor, clientFilter, HttpError } from "../../../server/access";
import { COLLECTIONS, find, findAll, create } from "../../../server/db";
import { logActivity } from "../../../server/activity";
import { handle, json } from "../../../server/http";
import { readJson, str } from "../../../server/util";
import { demandView, COLUMNS } from "../../../server/demands";

export const GET: APIRoute = handle(async (_req, { url }) => {
  const access = await requireAccess(["admin", "team"]);
  const trash = url.searchParams.get("trash") === "1";
  const clients = await find(COLLECTIONS.clients, clientFilter(access), { limit: 1000 });
  const ids = new Set(clients.map((c) => c._id));
  let rows = (await findAll(COLLECTIONS.demands)).filter((d) => (trash ? !!d.trashedAt : !d.trashedAt));
  if (access.role === "team")
    rows = rows.filter((d) => (d.assignees ?? []).includes(access.email) || (d.clientId && ids.has(d.clientId)) || d.createdBy === access.email);
  const names = new Map(clients.map((c) => [c._id, c.name]));
  return json(rows.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map((d) => ({ ...demandView(d), clientName: names.get(d.clientId) ?? "" })));
});

export const POST: APIRoute = handle(async (request) => {
  const access = await requireAccess(["admin", "team"]);
  const b = await readJson(request);
  const title = str(b.title, 200);
  if (!title) throw new HttpError(400, "Dê um título para a demanda.");
  const clientId = str(b.clientId, 100);
  const client = clientId ? await loadClientFor(access, clientId) : null;
  const column = COLUMNS.includes(str(b.column, 40)) ? str(b.column, 40) : COLUMNS[0];
  const row = await create(COLLECTIONS.demands, {
    title, description: str(b.description, 4000), clientId: client?._id ?? "", column,
    priority: ["Baixa", "Média", "Alta", "Urgente"].includes(str(b.priority, 20)) ? str(b.priority, 20) : "Média",
    dueDate: /^\d{4}-\d{2}-\d{2}$/.test(str(b.dueDate, 10)) ? str(b.dueDate, 10) : "",
    assignees: Array.isArray(b.assignees) ? b.assignees.map((e: any) => str(e, 200).toLowerCase()).filter((e: string) => e.includes("@")).slice(0, 10) : [],
    links: [], imageUrl: "", order: Date.now(), createdBy: access.email, trashedAt: "", checklist: [], comments: [],
  });
  await logActivity(access, {
    action: "demand.created",
    description: `${access.name} criou a demanda “${title}”${client ? ` (${client.name})` : ""}.`,
    entityType: "demand", entityId: row._id, clientId: client?._id ?? "",
  });
  return json({ _id: row._id }, 201);
});
