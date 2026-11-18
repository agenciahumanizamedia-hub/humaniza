// GET  /api/events?month=AAAA-MM — compromissos (captações, reuniões, entregas) do calendário.
// POST /api/events — novo compromisso (admin e equipe).
import type { APIRoute } from "astro";
import { requireAccess, loadClientFor, clientFilter } from "../../../server/access";
import { COLLECTIONS, find, findAll, create } from "../../../server/db";
import { HttpError as HttpErrorShim } from "../../../server/access";
import { handle, json } from "../../../server/http";
import { readJson, str } from "../../../server/util";
import { logActivity } from "../../../server/activity";

export const GET: APIRoute = handle(async (_req, { url }) => {
  const access = await requireAccess();
  const month = url.searchParams.get("month") ?? "";
  const clients = await find(COLLECTIONS.clients, clientFilter(access), { limit: 1000 });
  const ids = new Set(clients.map((c) => c._id));
  let rows = (await findAll(COLLECTIONS.events)).filter((e) => !e.trashedAt);
  if (/^\d{4}-\d{2}$/.test(month)) rows = rows.filter((e) => String(e.date ?? "").startsWith(month));
  if (access.role === "client") rows = rows.filter((e) => ids.has(e.clientId) && e.visibleToClient);
  else if (access.role === "team") rows = rows.filter((e) => !e.clientId || ids.has(e.clientId) || e.responsibleEmail === access.email);
  const names = new Map(clients.map((c) => [c._id, c.name]));
  return json(
    rows.map((e) => ({
      _id: e._id, clientId: e.clientId ?? "", clientName: names.get(e.clientId) ?? "", date: e.date ?? "", startTime: e.startTime ?? "", endTime: e.endTime ?? "",
      title: e.title ?? "", format: e.format ?? "", status: e.status ?? "", location: e.location ?? "", visibleToClient: !!e.visibleToClient,
      responsibleName: e.responsibleName ?? "", ...(access.role === "client" ? { clientNote: e.clientNote ?? "" } : { teamNote: e.teamNote ?? "", clientNote: e.clientNote ?? "" }),
    })),
  );
});

export const POST: APIRoute = handle(async (request) => {
  const access = await requireAccess(["admin", "team"]);
  const b = await readJson(request);
  const clientId = str(b.clientId, 100);
  const client = clientId ? await loadClientFor(access, clientId) : null;
  const date = str(b.date, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !str(b.title, 200)) throw new HttpErrorShim(400, "Informe título e data.");
  const row = await create(COLLECTIONS.events, {
    clientId: client?._id ?? "", date, startTime: str(b.startTime, 5), endTime: str(b.endTime, 5), title: str(b.title, 200),
    format: str(b.format, 60) || "Compromisso", status: str(b.status, 60) || "Agendado", visibleToClient: !!b.visibleToClient,
    responsibleName: str(b.responsibleName, 120) || access.name, responsibleEmail: access.email, teamNote: str(b.teamNote, 2000),
    clientNote: "", location: str(b.location, 300), source: "os", legacyId: "", legacyData: {},
  });
  await logActivity(access, {
    action: "event.created",
    description: `${access.name} agendou “${str(b.title, 200)}” em ${date.split("-").reverse().join("/")}${client ? ` (${client.name})` : ""}.`,
    entityType: "event", entityId: row._id, clientId: client?._id ?? "", visibleToClient: !!b.visibleToClient,
  });
  return json({ _id: row._id }, 201);
});
