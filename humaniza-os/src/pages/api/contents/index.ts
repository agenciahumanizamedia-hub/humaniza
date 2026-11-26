// GET  /api/contents?month=AAAA-MM&clientId=…&trash=1 — conteúdos para o calendário (ou a lixeira).
// POST /api/contents — novo roteiro, carrossel ou estático dentro de um projeto (admin e equipe).
import type { APIRoute } from "astro";
import { requireAccess, loadClientFor, clientFilter, HttpError, requireModule } from "../../../server/access";
import { COLLECTIONS, find, findAll, create, patch } from "../../../server/db";
import { logActivity } from "../../../server/activity";
import { handle, json } from "../../../server/http";
import { readJson, str, historyLine } from "../../../server/util";
import { loadProjectFor, contentView, contentVisibleToClient } from "../../../server/projects";

const CHECKLIST: Record<string, string[]> = {
  roteiro: ["Roteiro escrito", "Aprovado pelo cliente", "Captado", "Editado", "Legenda pronta", "Postado"],
  carrossel: ["Texto dos slides", "Aprovado pelo cliente", "Arte criada", "Legenda pronta", "Postado"],
  estatico: ["Mensagem definida", "Aprovado pelo cliente", "Arte criada", "Legenda pronta", "Postado"],
};

export const GET: APIRoute = handle(async (_req, { url }) => {
  const access = await requireAccess();
  const month = url.searchParams.get("month") ?? "";
  const clientId = url.searchParams.get("clientId");
  const trash = url.searchParams.get("trash") === "1";
  if (trash && access.role === "client") throw new HttpError(403, "Sem acesso.");
  requireModule(access, ...(trash ? (["lixeira"] as const) : (["projetos", "calendario"] as const)));
  const clients = clientId ? [await loadClientFor(access, clientId)] : await find(COLLECTIONS.clients, clientFilter(access), { limit: 1000 });
  const ids = clients.map((c) => c._id);
  if (!ids.length) return json([]);
  let rows = await findAll(COLLECTIONS.contents, { clientId: { $in: ids } });
  rows = rows.filter((c) => (trash ? !!c.trashedAt : !c.trashedAt));
  if (/^\d{4}-\d{2}$/.test(month)) rows = rows.filter((c) => String(c.postDate ?? "").startsWith(month));
  if (access.role === "client") {
    const projects = await findAll(COLLECTIONS.projects, { _id: { $in: [...new Set(rows.map((r) => r.projectId).filter(Boolean))] } });
    const byId = new Map(projects.map((p) => [p._id, p]));
    rows = rows.filter((c) => contentVisibleToClient(byId.get(c.projectId) ?? null, c));
  }
  const names = new Map(clients.map((c) => [c._id, c.name]));
  return json(rows.map((c) => ({ ...contentView(access, c), clientName: names.get(c.clientId) ?? "" })));
});

export const POST: APIRoute = handle(async (request) => {
  const access = await requireAccess(["admin", "team"]);
  requireModule(access, "projetos");
  const b = await readJson(request);
  const type = str(b.type, 20);
  if (!CHECKLIST[type]) throw new HttpError(400, "Tipo inválido.");
  const { project, client } = await loadProjectFor(access, str(b.projectId, 100));
  const existing = await findAll(COLLECTIONS.contents, { projectId: project._id });
  const label = type === "roteiro" ? "Roteiro (Reels)" : type === "carrossel" ? "Carrossel" : "Estático";
  const row = await create(COLLECTIONS.contents, {
    clientId: client._id,
    projectId: project._id,
    type,
    order: existing.length,
    title: `Novo ${label.toLowerCase()}`,
    fields: { tema: "", objetivo: "", gancho: "", desenvolvimento: "", slides: "", mensagem: "", legenda: "", cta: "" },
    responsible: "",
    driveLink: "",
    referenceLink: "",
    postDate: str(b.postDate, 10),
    week: "",
    status: "Em criação",
    checklist: CHECKLIST[type].map((label) => ({ label, done: false })),
    note: "",
    clientApproval: "",
    clientNote: "",
    clientActionAt: "",
    source: "os",
    legacyId: "",
    legacyData: {},
    updatedBy: access.name,
  });
  await patch(COLLECTIONS.projects, project._id, {
    history: [historyLine(access.name, `Adicionou ${label.toLowerCase()}.`), ...(project.history ?? [])].slice(0, 300),
  });
  await logActivity(access, {
    action: "content.created",
    description: `${access.name} adicionou ${label.toLowerCase()} em ${project.period} (${client.name}).`,
    entityType: "content",
    entityId: row._id,
    clientId: client._id,
  });
  return json({ _id: row._id }, 201);
});
