// GET  /api/clients — clientes que o perfil pode ver (admin: todos; equipe: os que atende; cliente: o próprio).
// POST /api/clients — cria cliente (somente admin) e registra no histórico.
import type { APIRoute } from "astro";
import { requireAccess, clientFilter } from "../../../server/access";
import { find, create, COLLECTIONS } from "../../../server/db";
import { logActivity } from "../../../server/activity";
import { handle, json, readFields } from "../../../server/http";
import { HttpError } from "../../../server/access";

const PUBLIC_FIELDS = ["_id", "name", "logoUrl", "coverUrl", "brand", "brandColor", "status", "serviceType", "serviceCustom", "instagram"] as const;
const TEAM_FIELDS = [...PUBLIC_FIELDS, "email", "whatsapp", "driveUrl", "teamEmails", "access", "responsibleName", "responsiblePhone"] as const;

export const GET: APIRoute = handle(async () => {
  const access = await requireAccess();
  const rows = await find(COLLECTIONS.clients, clientFilter(access), {
    sort: [{ fieldName: "name", order: "ASC" }],
  });
  const fields: readonly string[] =
    access.role === "admin" ? [...TEAM_FIELDS, "notes"] : access.role === "team" ? TEAM_FIELDS : PUBLIC_FIELDS;
  return json(rows.map((r) => Object.fromEntries(fields.map((f) => [f, r[f] ?? null]))));
});

export const POST: APIRoute = handle(async (request) => {
  const access = await requireAccess(["admin"]);
  const f = await readFields(request, ["name", "email", "status", "serviceType", "whatsapp", "instagram", "brandColor", "notes"] as const);
  if (!f.name) throw new HttpError(400, "Informe o nome do cliente.");
  const row = await create(COLLECTIONS.clients, {
    name: f.name,
    email: (f.email ?? "").toLowerCase(),
    status: f.status || "Ativo",
    access: "Liberado",
    serviceType: f.serviceType ?? "",
    whatsapp: (f.whatsapp ?? "").replace(/\D/g, ""),
    instagram: f.instagram ?? "",
    brandColor: /^#[0-9a-fA-F]{6}$/.test(f.brandColor ?? "") ? f.brandColor : "",
    notes: f.notes ?? "",
    teamEmails: [],
  });
  await logActivity(access, {
    action: "client.created",
    description: `${access.name} cadastrou o cliente ${row.name}.`,
    entityType: "client",
    entityId: row._id,
    clientId: row._id,
  });
  return json({ _id: row._id, name: row.name }, 201);
});
