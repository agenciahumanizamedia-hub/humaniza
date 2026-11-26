// Quem está fazendo a requisição, e o que essa pessoa pode ver.
//
// Regra central de segurança do Humaniza OS:
//   1. A identidade vem da sessão de membro do Wix (cookie HttpOnly escrito pelo login), lida aqui
//      no servidor. O navegador NUNCA informa o próprio perfil ou o próprio cliente.
//   2. O perfil (admin, team, client) e o cliente vinculado vêm da coleção osUsers, que só o
//      administrador altera. Quem tem login mas não está em osUsers (ou está inativo) não vê nada.
//   3. Cada endpoint chama `requireAccess()` e filtra os dados pelo perfil antes de responder.
import { members } from "@wix/members";
import { find, getOne, COLLECTIONS, type Row } from "./db";

export type Role = "admin" | "team" | "client";

/**
 * Áreas que o administrador libera para cada pessoa da EQUIPE (Acessos → Editar acesso).
 * A área de administração (Orçamentos, Acessos, Equipe, conexões do Meta e da IA) nunca é da equipe.
 * Quem foi cadastrado antes desta opção existir (sem `modules`) continua com todas as áreas.
 */
export const TEAM_MODULES = ["projetos", "calendario", "demandas", "resultados", "pauta", "identidade", "lixeira"] as const;
export type TeamModule = (typeof TEAM_MODULES)[number];

export function cleanModules(v: unknown): TeamModule[] {
  if (!Array.isArray(v)) return [...TEAM_MODULES];
  return TEAM_MODULES.filter((m) => v.includes(m));
}

export interface Access {
  userId: string; // item em osUsers
  memberId: string;
  email: string;
  name: string;
  role: Role;
  clientId: string | null; // só para perfil client
  permission: string; // Operacional | Líder | Gestor (equipe)
  modules: TeamModule[]; // áreas liberadas (só conta para a equipe; admin tem tudo)
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const norm = (v: unknown) => String(v ?? "").trim().toLowerCase();

/** Lê o membro logado (ou null) usando a sessão do próprio visitante — sem elevação. */
async function currentMember(): Promise<{ id: string; email: string; name: string } | null> {
  try {
    const res: any = await members.getCurrentMember({ fieldsets: ["FULL"] as any });
    const m = res?.member;
    const id = m?._id ?? m?.id;
    if (!id) return null;
    const email = norm(m.loginEmail);
    const name =
      m.profile?.nickname ||
      [m.contact?.firstName, m.contact?.lastName].filter(Boolean).join(" ") ||
      email.split("@")[0];
    return { id, email, name };
  } catch {
    return null;
  }
}

/** Perfil completo de quem chamou, ou null (não logado / não liberado). */
export async function getAccess(): Promise<Access | null> {
  const member = await currentMember();
  if (!member?.email) return null;
  const [user] = await find(COLLECTIONS.users, { email: member.email }, { limit: 1 });
  if (!user || user.active === false) return null;
  const role = norm(user.role) as Role;
  if (!["admin", "team", "client"].includes(role)) return null;
  if (role === "client" && !user.clientId) return null;
  return {
    userId: user._id,
    memberId: member.id,
    email: member.email,
    name: user.name || member.name,
    role,
    clientId: role === "client" ? String(user.clientId) : null,
    permission: user.permission || "",
    modules: role === "team" ? cleanModules(user.modules) : [...TEAM_MODULES],
  };
}

/** A pessoa pode usar esta área? Admin sempre; cliente não usa áreas da equipe; equipe conforme liberado. */
export function canUse(access: Access, module: TeamModule): boolean {
  if (access.role === "admin") return true;
  if (access.role === "team") return access.modules.includes(module);
  return false;
}

/** Interrompe com 403 se a pessoa da equipe não tem a área liberada. Admin e cliente passam direto. */
export function requireModule(access: Access, ...modules: TeamModule[]): void {
  if (access.role !== "team") return;
  if (!modules.some((m) => access.modules.includes(m))) throw new HttpError(403, "Esta área não foi liberada para o seu acesso.");
}

/** Igual a getAccess, mas interrompe com 401/403. `roles` limita quem pode usar o endpoint. */
export async function requireAccess(roles: Role[] = ["admin", "team", "client"]): Promise<Access> {
  const access = await getAccess();
  if (!access) throw new HttpError(401, "Faça login com um acesso liberado pela Humaniza.");
  if (!roles.includes(access.role)) throw new HttpError(403, "Seu perfil não tem acesso a esta área.");
  return access;
}

/** O cliente pode ser visto por quem chamou? Admin: todos. Equipe: os que atende. Cliente: só o próprio. */
export function canSeeClient(access: Access, client: Row | null): boolean {
  if (!client) return false;
  if (access.role === "admin") return true;
  if (access.role === "client") return client._id === access.clientId;
  const team: string[] = (client.teamEmails ?? []).map(norm);
  return team.includes(access.email);
}

/** Filtro de clientes por perfil, já pronto para a consulta no banco. */
export function clientFilter(access: Access): Record<string, unknown> {
  if (access.role === "admin") return {};
  if (access.role === "client") return { _id: access.clientId };
  return { teamEmails: { $hasSome: [access.email] } };
}

export async function loadClientFor(access: Access, clientId: string): Promise<Row> {
  const client = await getOne(COLLECTIONS.clients, clientId);
  if (!canSeeClient(access, client)) throw new HttpError(404, "Cliente não encontrado.");
  return client as Row;
}
