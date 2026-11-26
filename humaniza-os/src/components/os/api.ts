// Chamadas do navegador para os endpoints do servidor (/api/*). O navegador nunca acessa o banco
// direto: tudo passa pelo servidor, que confere o perfil de quem chamou.
export type Role = "admin" | "team" | "client";

export interface Me { name: string; email: string; role: Role; clientId: string | null; permission: string }
export interface BrandColor { hex: string; name: string; role: string }
export interface Brand { colors: BrandColor[]; fonts: string; tone: string; notes: string; useHumanizaPalette: boolean }
export interface Client {
  _id: string; name: string; status: string | null; serviceType: string | null; serviceCustom?: string | null; instagram: string | null;
  brandColor?: string | null; logoUrl?: string | null; coverUrl?: string | null; brand?: Brand | null; email?: string | null;
  whatsapp?: string | null; driveUrl?: string | null; teamEmails?: string[] | null; access?: string | null; notes?: string | null;
  responsibleName?: string | null; responsiblePhone?: string | null;
  integrations?: { igUserId?: string; igUsername?: string; pageId?: string; adAccountId?: string; adAccountName?: string } | null;
}
export interface User { _id: string; name: string; email: string; role: Role; clientId: string | null; jobTitle: string; permission: string; active: boolean }
export interface TeamMember { _id: string; name: string; email: string; role: Role; jobTitle: string; permission: string }
export interface Activity { _id: string; when: string | null; description: string; actorName: string; actorRole: string; action: string; clientId: string | null }
export interface ProjectSummary {
  _id: string; clientId: string; period: string; periodSort: string; strategicStatus: string; productionStatus: string; calendarStatus: string;
  approvalStatus: string; total: number; approved: number; adjustments: number; created: string;
}
export interface Content {
  _id: string; clientId: string; projectId: string; type: "roteiro" | "carrossel" | "estatico"; order: number; title: string;
  fields: Record<string, string>; postDate: string; week: string; status: string; driveLink: string; referenceLink: string;
  clientApproval: string; clientNote: string; clientActionAt: string; responsible?: string; checklist?: { label: string; done: boolean }[];
  note?: string; source?: string; trashedAt?: string; clientName?: string;
}
export interface Project {
  _id: string; clientId: string; period: string; periodSort: string; strategicStatus: string; productionStatus: string; calendarStatus: string;
  approvalStatus: string; history: string[]; strategic: Record<string, string> | null; calendar: { content: string; note: string } | null;
  productionNote: string; approvalNotes: string;
}
export interface ProjectDetail { project: Project; client: Pick<Client, "_id" | "name" | "logoUrl" | "coverUrl" | "brand" | "instagram">; contents: Content[] }
export interface CalEvent {
  _id: string; clientId: string; clientName: string; date: string; startTime: string; endTime: string; title: string; format: string; status: string;
  location: string; visibleToClient: boolean; responsibleName: string; teamNote?: string; clientNote?: string;
}
export interface Demand {
  _id: string; title: string; description: string; clientId: string; clientName?: string; column: string; priority: string; dueDate: string;
  assignees: string[]; links: string[]; imageUrl: string; order: number; createdBy: string; checklist: { label: string; done: boolean }[];
  comments: { by: string; at: string; text: string }[]; trashedAt: string;
}
export interface Post { id: string; caption: string; type: string; permalink: string; thumb: string; timestamp: string; date: string; likes: number | null; comments: number | null; saves: number | null; shares: number | null; reach: number | null; views: number | null; interactions: number | null; engagementRate: number | null; syncedAt: string }
export interface ConnState { linked: boolean; label: string; state: "ok" | "pendente" | "erro" | "aguardando"; lastSuccess: string; lastAttempt?: string; message?: string }
export interface IgAgg { coverage: { days: number; withData: number }; totals: Record<string, number | null>; followers: number | null; profile: { username: string; followers: number; picture: string } | null; series: Record<string, any>[]; posts: Post[] }
export interface Campaign { id: string; name: string; objective: string; currency: string; resultIndicator: string; resultLabel: string; spend: number; results: number | null; costPerResult: number | null; conversations: number | null; costPerConversation: number | null; impressions: number | null; clicks: number | null; ctr: number | null; cpc: number | null }
export interface AdsAgg { coverage: { days: number; withData: number }; totals: { spend: number | null; conversations: number | null; costPerConversation: number | null; impressions: number | null; clicks: number | null }; campaigns: Campaign[]; series: { date: string; spend: number | null }[] }
export interface Evidence { label: string; value: string; source: string }
export interface Suggestion2 { id: string; kind: "funcionou" | "repetir" | "melhorar" | "teste"; text: string; evidence: Evidence[]; approved?: boolean; ai?: boolean }
export interface Performance {
  de: string; ate: string; previous?: { de: string; ate: string }; published: boolean; message?: string; sources?: Record<string, string>;
  connections?: { metaConnected?: boolean; instagram: ConnState; ads: ConnState };
  instagram?: IgAgg | null; previousInstagram?: { totals: Record<string, number | null>; followers: number | null; coverage: { days: number; withData: number }; series: Record<string, any>[] } | null;
  ads?: AdsAgg | null; previousAds?: { totals: AdsAgg["totals"]; coverage: { days: number; withData: number }; series: { date: string; spend: number | null }[] } | null;
  delivery?: { total: number; byType: { type: string; count: number }[]; byStatus: { status: string; count: number }[]; postedInternal: number; confirmedByInstagram: number;
    items: { _id: string; projectId: string; title: string; type: string; postDate: string; status: string; clientApproval: string; instagramId: string }[] };
  upcoming?: { _id: string; date: string; endDate: string; title: string; kind: string; status: string; visibleToClient: boolean }[];
  suggestions?: Suggestion2[];
  report?: { analysis: string; suggestions: Suggestion2[]; nextSteps: { text: string; done: boolean }[]; manual: Record<string, Record<string, number>>; publishedAt: string; updatedBy?: string };
}
export interface AiAnalysis {
  model: string; summary: string; suggestions: Suggestion2[]; nextSteps: string[];
  hooks: { theme: string; current: string; suggested: string; why: string }[]; themes: { theme: string; why: string; idea: string }[];
}
export interface PlannerItem { _id: string; date: string; endDate: string; kind: string; title: string; description: string; status: string; color: string; visibleToClient: boolean; budget?: string; channels?: string[]; internalNote?: string }
export interface Suggestion { date: string; title: string; kind: "data" | "campanha"; tags: string[]; tip: string }
export interface MetaStatus {
  connected: boolean; method?: string; accountName?: string; expiresAt?: string; savedAt?: string; scopes?: string[]; missingScopes?: string[];
  app?: { appId: string; hasSecret: boolean; configId: string }; redirectUri?: string; scopesNeeded?: string[];
  assets?: { instagram: { igUserId: string; username: string; pageId: string; pageName: string }[]; adAccounts: { id: string; name: string; currency: string; active: boolean }[]; errors: string[] };
}
export interface LegacyRow { _id: string; sourceCollection: string; legacyId: string; clientId: string; data: Record<string, any> }

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) }, credentials: "same-origin" });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, (body as any).error ?? "Falha ao carregar.");
  return body as T;
}
const send = (method: string, data?: unknown): RequestInit => ({ method, body: data === undefined ? undefined : JSON.stringify(data) });
const q = (params: Record<string, string | undefined>) => {
  const s = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]).toString();
  return s ? `?${s}` : "";
};

export const api = {
  importHub: () => call<{ clientes: number; projetos: number; conteudos: number; briefing: number; lidosDoHub: Record<string, number> }>("/api/admin/importar-hub", send("POST", {})),
  me: () => call<Me>("/api/me"),
  clients: () => call<Client[]>("/api/clients"),
  client: (id: string) => call<Client>(`/api/clients/${id}`),
  createClient: (data: Record<string, string>) => call<{ _id: string }>("/api/clients", send("POST", data)),
  updateClient: (id: string, data: Partial<Client>) => call<{ ok: true }>(`/api/clients/${id}`, send("PATCH", data)),
  users: () => call<User[]>("/api/users"),
  team: () => call<TeamMember[]>("/api/team"),
  grantAccess: (data: Record<string, string>) => call<{ _id: string }>("/api/users", send("POST", data)),
  activity: () => call<Activity[]>("/api/activity"),
  projects: (clientId?: string) => call<ProjectSummary[]>(`/api/projects${q({ clientId })}`),
  project: (id: string) => call<ProjectDetail>(`/api/projects/${id}`),
  createProject: (data: { clientId: string; period: string; periodSort?: string; copyFrom?: string }) => call<{ _id: string }>("/api/projects", send("POST", data)),
  updateProject: (id: string, data: Record<string, unknown>) => call<{ ok: true }>(`/api/projects/${id}`, send("PATCH", data)),
  trashProject: (id: string) => call<{ ok: true }>(`/api/projects/${id}`, send("DELETE")),
  decide: (id: string, data: { decision: "approve" | "adjust" | "order"; note?: string; stage?: string; contentId?: string }) =>
    call<{ ok: true }>(`/api/projects/${id}/acao`, send("POST", data)),
  contents: (params: { month?: string; clientId?: string; trash?: boolean }) =>
    call<Content[]>(`/api/contents${q({ month: params.month, clientId: params.clientId, trash: params.trash ? "1" : undefined })}`),
  createContent: (data: { projectId: string; type: string; postDate?: string }) => call<{ _id: string }>("/api/contents", send("POST", data)),
  updateContent: (id: string, data: Record<string, unknown>) => call<{ ok: true }>(`/api/contents/${id}`, send("PATCH", data)),
  trashContent: (id: string, mode: "trash" | "restore" | "forever" = "trash") =>
    call<{ ok: true }>(`/api/contents/${id}${mode === "restore" ? "?restaurar=1" : mode === "forever" ? "?definitivo=1" : ""}`, send("DELETE")),
  events: (month?: string) => call<CalEvent[]>(`/api/events${q({ month })}`),
  createEvent: (data: Record<string, unknown>) => call<{ _id: string }>("/api/events", send("POST", data)),
  deleteEvent: (id: string) => call<{ ok: true }>(`/api/events/${id}`, send("DELETE")),
  demands: (trash = false) => call<Demand[]>(`/api/demands${trash ? "?trash=1" : ""}`),
  createDemand: (data: Record<string, unknown>) => call<{ _id: string }>("/api/demands", send("POST", data)),
  updateDemand: (id: string, data: Record<string, unknown>) => call<{ ok: true }>(`/api/demands/${id}`, send("PATCH", data)),
  trashDemand: (id: string, mode: "trash" | "restore" | "forever" = "trash") =>
    call<{ ok: true }>(`/api/demands/${id}${mode === "restore" ? "?restaurar=1" : mode === "forever" ? "?definitivo=1" : ""}`, send("DELETE")),
  performance: (clientId: string, de: string, ate: string) => call<Performance>(`/api/clients/${clientId}/resultados${q({ de, ate })}`),
  reports: (clientId: string) => call<{ periodKey: string; published: boolean; publishedAt: string }[]>(`/api/clients/${clientId}/resultados?relatorios=1`),
  saveReport: (clientId: string, data: Record<string, unknown>) => call<{ ok: true }>(`/api/clients/${clientId}/resultados`, send("PATCH", data)),
  aiAnalysis: (clientId: string, de: string, ate: string) => call<AiAnalysis>(`/api/clients/${clientId}/analise-ia`, send("POST", { de, ate })),
  aiHooks: (contentId: string, pedido?: string) => call<{ hooks: { text: string; why: string }[]; caption: string; cta: string; note: string }>("/api/contents/ia", send("POST", { contentId, pedido })),
  aiStatus: () => call<{ connected: boolean; savedAt: string; model: string }>("/api/admin/ia"),
  saveAiKey: (apiKey: string) => call<{ ok: true }>("/api/admin/ia", send("POST", { apiKey })),
  syncNow: (clientId: string, full = false) => call<Record<string, unknown>>(`/api/sync?cliente=${clientId}${full ? "&completo=1" : ""}`, send("POST", {})),
  saveMetaApp: (data: { appId: string; appSecret?: string; configId?: string }) => call<{ ok: true }>("/api/admin/meta", send("POST", data)),
  saveIntegrations: (clientId: string, data: Record<string, string>) => call<{ ok: true }>(`/api/clients/${clientId}/integracoes`, send("PATCH", data)),
  metaStatus: (withAssets = false) => call<MetaStatus>(`/api/admin/meta${withAssets ? "?contas=1" : ""}`),
  saveMetaToken: (token: string) => call<{ ok: true; name: string; expiresAt: string }>("/api/admin/meta", send("POST", { token })),
  planner: (clientId: string) => call<{ items: PlannerItem[]; suggestions: Suggestion[] }>(`/api/clients/${clientId}/datas`),
  addPlanner: (clientId: string, data: Record<string, unknown>) => call<{ _id: string }>(`/api/clients/${clientId}/datas`, send("POST", data)),
  updatePlanner: (id: string, data: Record<string, unknown>) => call<{ ok: true }>(`/api/planner/${id}`, send("PATCH", data)),
  deletePlanner: (id: string) => call<{ ok: true }>(`/api/planner/${id}`, send("DELETE")),
  archive: (tipo?: string) => call<LegacyRow[]>(`/api/arquivo${q({ tipo })}`),
  /** Envia uma imagem para a Mídia do Wix e devolve o link público dela. */
  async upload(file: File): Promise<string> {
    const { uploadUrl } = await call<{ uploadUrl: string }>("/api/upload", send("POST", { mimeType: file.type, fileName: file.name }));
    const res = await fetch(`${uploadUrl}?filename=${encodeURIComponent(file.name)}`, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
    if (!res.ok) throw new Error("Não foi possível enviar a imagem.");
    const body: any = await res.json().catch(() => ({}));
    const url = body?.file?.url || body?.url;
    if (!url) throw new Error("A imagem foi enviada, mas o link não voltou. Tente de novo.");
    return String(url).startsWith("http") ? url : `https://static.wixstatic.com/media/${url}`;
  },
};
