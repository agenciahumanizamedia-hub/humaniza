// Chamadas do navegador para os endpoints do servidor (/api/*). O navegador nunca acessa o banco
// direto: tudo passa pelo servidor, que confere o perfil de quem chamou.
export type Role = "admin" | "team" | "client";

export interface Me {
  name: string;
  email: string;
  role: Role;
  clientId: string | null;
  permission: string;
}
export interface Client {
  _id: string;
  name: string;
  status: string | null;
  serviceType: string | null;
  instagram: string | null;
  brandColor: string | null;
  email?: string | null;
  whatsapp?: string | null;
  teamEmails?: string[] | null;
}
export interface User {
  _id: string;
  name: string;
  email: string;
  role: Role;
  clientId: string | null;
  jobTitle: string;
  permission: string;
  active: boolean;
}
export interface Activity {
  _id: string;
  when: string | null;
  description: string;
  actorName: string;
  actorRole: string;
  action: string;
  clientId: string | null;
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    credentials: "same-origin",
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, (body as any).error ?? "Falha ao carregar.");
  return body as T;
}

export const api = {
  importHub: () =>
    call<{ clientes: number; projetos: number; conteudos: number; briefing: number; lidosDoHub: Record<string, number> }>(
      "/api/admin/importar-hub",
      { method: "POST", body: "{}" },
    ),
  me: () => call<Me>("/api/me"),
  clients: () => call<Client[]>("/api/clients"),
  createClient: (data: Record<string, string>) => call<{ _id: string }>("/api/clients", { method: "POST", body: JSON.stringify(data) }),
  users: () => call<User[]>("/api/users"),
  grantAccess: (data: Record<string, string>) => call<{ _id: string }>("/api/users", { method: "POST", body: JSON.stringify(data) }),
  activity: () => call<Activity[]>("/api/activity"),
};
