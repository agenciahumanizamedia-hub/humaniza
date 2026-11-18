// GET  /api/users — pessoas com acesso (somente admin).
// POST /api/users — libera acesso para um e-mail: equipe ou cliente (somente admin).
//
// Como funciona o acesso: ao liberar, o sistema cria a conta de membro no Wix (sem senha). A pessoa
// cria a senha em /login → "Primeiro acesso". Não existe cadastro aberto: só entra quem foi liberado.
import type { APIRoute } from "astro";
import { members } from "@wix/members";
import { auth } from "@wix/essentials";
import { requireAccess, HttpError } from "../../server/access";
import { find, create, getOne, COLLECTIONS } from "../../server/db";
import { logActivity } from "../../server/activity";
import { handle, json, readFields } from "../../server/http";

export const GET: APIRoute = handle(async () => {
  await requireAccess(["admin"]);
  const rows = await find(COLLECTIONS.users, {}, { sort: [{ fieldName: "name", order: "ASC" }] });
  return json(
    rows.map((r) => ({
      _id: r._id,
      name: r.name,
      email: r.email,
      role: r.role,
      clientId: r.clientId ?? null,
      jobTitle: r.jobTitle ?? "",
      permission: r.permission ?? "",
      active: r.active !== false,
    })),
  );
});

export const POST: APIRoute = handle(async (request) => {
  const access = await requireAccess(["admin"]);
  const f = await readFields(request, ["name", "email", "role", "clientId", "jobTitle", "permission"] as const);
  const email = (f.email ?? "").toLowerCase();
  if (!f.name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new HttpError(400, "Informe nome e e-mail válidos.");
  if (!["team", "client", "admin"].includes(f.role ?? "")) throw new HttpError(400, "Perfil inválido.");
  if ((await find(COLLECTIONS.users, { email }, { limit: 1 })).length) throw new HttpError(409, "Este e-mail já tem acesso.");
  let clientName = "";
  if (f.role === "client") {
    const client = f.clientId ? await getOne(COLLECTIONS.clients, f.clientId) : null;
    if (!client) throw new HttpError(400, "Escolha a empresa do cliente.");
    clientName = client.name;
  }
  const row = await create(COLLECTIONS.users, {
    name: f.name,
    email,
    role: f.role,
    clientId: f.role === "client" ? f.clientId : "",
    jobTitle: f.jobTitle ?? "",
    permission: f.role === "team" ? f.permission || "Operacional" : f.role === "admin" ? "Gestor" : "",
    active: true,
  });
  // Cria a conta de membro (sem senha). Se já existir, segue normalmente.
  let memberCreated = false;
  try {
    await auth.elevate(members.createMember)({ member: { loginEmail: email } });
    memberCreated = true;
  } catch (err) {
    console.warn("createMember:", (err as Error)?.message ?? err);
  }
  const roleLabel = f.role === "client" ? `cliente (${clientName})` : f.role === "team" ? "equipe" : "administrador";
  await logActivity(access, {
    action: "user.granted",
    description: `${access.name} liberou acesso de ${roleLabel} para ${f.name}.`,
    entityType: "user",
    entityId: row._id,
    clientId: f.role === "client" ? f.clientId : "",
  });
  return json({ _id: row._id, memberCreated }, 201);
});
