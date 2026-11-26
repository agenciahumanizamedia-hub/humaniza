// GET  /api/users — pessoas com acesso (somente admin).
// POST /api/users — libera acesso para um e-mail: equipe, cliente ou administrador (somente admin).
//
// Como funciona o acesso: ao liberar, o sistema cria a conta de membro no Wix e já gera uma senha,
// que aparece UMA vez para o administrador copiar e mandar à pessoa (ela pode trocar depois, em
// "Trocar minha senha"). Não existe cadastro aberto: só entra quem foi liberado aqui.
// Se o Wix não deixar gravar a senha, o acesso é liberado mesmo assim e a tela oferece o e-mail
// oficial do Wix para a pessoa criar a senha.
import type { APIRoute } from "astro";
import { members } from "@wix/members";
import { auth } from "@wix/essentials";
import { requireAccess, HttpError, cleanModules } from "../../server/access";
import { find, findAll, create, getOne, patch, COLLECTIONS } from "../../server/db";
import { setTeamClients } from "../../server/team-access";
import { logActivity } from "../../server/activity";
import { handle, json } from "../../server/http";
import { readJson, str } from "../../server/util";
import { generatePassword, passwordError, setMemberPassword } from "../../server/password";

export const GET: APIRoute = handle(async () => {
  await requireAccess(["admin"]);
  const [rows, clients] = await Promise.all([
    find(COLLECTIONS.users, {}, { sort: [{ fieldName: "name", order: "ASC" }], limit: 1000 }),
    findAll(COLLECTIONS.clients),
  ]);
  const clientsOf = (email: string) =>
    clients.filter((c) => (c.teamEmails ?? []).map((e: string) => String(e).toLowerCase()).includes(String(email).toLowerCase())).map((c) => c._id);
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
      passwordSetAt: r.passwordSetAt ?? "",
      modules: r.role === "team" ? cleanModules(r.modules) : [],
      clientIds: r.role === "team" ? clientsOf(r.email) : [],
    })),
  );
});

export const POST: APIRoute = handle(async (request) => {
  const access = await requireAccess(["admin"]);
  const b = await readJson(request);
  const f = {
    name: str(b.name, 160),
    email: str(b.email, 200),
    role: str(b.role, 20),
    clientId: str(b.clientId, 100),
    jobTitle: str(b.jobTitle, 120),
    permission: str(b.permission, 40),
  };
  const email = f.email.toLowerCase();
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
    modules: f.role === "team" ? cleanModules(b.modules) : [],
    active: true,
  });
  // Equipe: clientes que a pessoa vai atender (o mesmo vínculo de "Dados e equipe" do cliente).
  if (f.role === "team" && Array.isArray(b.clientIds)) await setTeamClients(email, b.clientIds.map((x: unknown) => str(x, 100)));
  // Cria a conta de membro. Se já existir, segue normalmente.
  try {
    await auth.elevate(members.createMember)({ member: { loginEmail: email, profile: { nickname: f.name } } } as any);
  } catch (err) {
    console.warn("createMember:", (err as Error)?.message ?? err);
  }
  // Gera e grava a senha inicial.
  let password: string | null = null;
  let passwordMessage = "";
  try {
    const candidate = generatePassword();
    await setMemberPassword(email, candidate);
    password = candidate;
    await create(COLLECTIONS.activity, {
      action: "user.password",
      description: `${access.name} gerou a senha inicial de ${f.name}.`,
      entityType: "user",
      entityId: row._id,
      clientId: "",
      visibleToClient: false,
      actorEmail: access.email,
      actorName: access.name,
      actorRole: access.role,
    });
    await patch(COLLECTIONS.users, row._id, { passwordSetAt: new Date().toISOString() });
  } catch (err) {
    console.warn("setMemberPassword:", (err as Error)?.message ?? err);
    passwordMessage = passwordError(err);
  }
  const roleLabel = f.role === "client" ? `cliente (${clientName})` : f.role === "team" ? "equipe" : "administrador";
  await logActivity(access, {
    action: "user.granted",
    description: `${access.name} liberou acesso de ${roleLabel} para ${f.name}.`,
    entityType: "user",
    entityId: row._id,
    clientId: f.role === "client" ? f.clientId : "",
  });
  return json({ _id: row._id, email, password, passwordMessage }, 201);
});
