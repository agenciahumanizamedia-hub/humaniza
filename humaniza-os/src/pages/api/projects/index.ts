// GET  /api/projects?clientId=… — projetos/mês de um cliente (ou de todos os visíveis).
// POST /api/projects — cria projeto/mês, em branco ou duplicando outro (admin e equipe).
import type { APIRoute } from "astro";
import { requireAccess, loadClientFor, clientFilter, HttpError } from "../../../server/access";
import { COLLECTIONS, find, findAll, create, createMany } from "../../../server/db";
import { logActivity } from "../../../server/activity";
import { handle, json } from "../../../server/http";
import { readJson, str, historyLine } from "../../../server/util";
import { loadProjectFor } from "../../../server/projects";

export const GET: APIRoute = handle(async (_req, { url }) => {
  const access = await requireAccess();
  const clientId = url.searchParams.get("clientId");
  let ids: string[];
  if (clientId) {
    await loadClientFor(access, clientId);
    ids = [clientId];
  } else {
    ids = (await find(COLLECTIONS.clients, clientFilter(access), { limit: 1000 })).map((c) => c._id);
  }
  if (!ids.length) return json([]);
  const rows = await findAll(COLLECTIONS.projects, { clientId: { $in: ids } });
  const contents = await findAll(COLLECTIONS.contents, { projectId: { $in: rows.map((r) => r._id) } });
  const list = rows
    .filter((p) => !p.trashedAt)
    .map((p) => {
      const mine = contents.filter((c) => c.projectId === p._id && !c.trashedAt);
      const visible = access.role === "client" && (!p.productionStatus || p.productionStatus === "Bloqueado") ? [] : mine;
      return {
        _id: p._id,
        clientId: p.clientId,
        period: p.period,
        periodSort: p.periodSort ?? "",
        strategicStatus: p.strategicStatus,
        productionStatus: p.productionStatus,
        calendarStatus: p.calendarStatus,
        approvalStatus: p.approvalStatus,
        total: visible.length,
        approved: visible.filter((c) => c.clientApproval === "Aprovado" || c.status === "Aprovado" || c.status === "Postado").length,
        adjustments: visible.filter((c) => c.clientApproval === "Ajustes" || c.status === "Ajustes").length,
        created: p._createdDate ?? p.legacyCreatedAt ?? "",
      };
    })
    .sort((a, b) => (b.periodSort || "").localeCompare(a.periodSort || "") || String(b.created).localeCompare(String(a.created)));
  return json(list);
});

export const POST: APIRoute = handle(async (request) => {
  const access = await requireAccess(["admin", "team"]);
  const b = await readJson(request);
  const client = await loadClientFor(access, str(b.clientId, 100));
  const period = str(b.period, 120);
  if (!period) throw new HttpError(400, "Informe o período (ex.: Dezembro 2026).");
  const periodSort = /^\d{4}-\d{2}$/.test(str(b.periodSort, 7)) ? str(b.periodSort, 7) : "";
  let base: Record<string, any> = {
    strategic: { macro: "", editorial: "", themes: "", creative: "", note: "" },
    calendar: { content: "", note: "" },
    productionNote: "",
  };
  let copied: any[] = [];
  if (b.copyFrom) {
    const { project } = await loadProjectFor(access, str(b.copyFrom, 100));
    base = { strategic: project.strategic ?? {}, calendar: project.calendar ?? {}, productionNote: project.productionNote ?? "" };
    copied = (await findAll(COLLECTIONS.contents, { projectId: project._id })).filter((c) => !c.trashedAt);
  }
  const row = await create(COLLECTIONS.projects, {
    clientId: client._id,
    period,
    periodSort,
    ...base,
    strategicStatus: "Em desenvolvimento",
    productionStatus: "Bloqueado",
    calendarStatus: "Bloqueado",
    approvalStatus: "Bloqueado",
    approvalNotes: "",
    history: [historyLine(access.name, b.copyFrom ? "Criou o projeto duplicando outro mês." : "Criou o projeto.")],
    meta: {},
  });
  if (copied.length)
    await createMany(
      COLLECTIONS.contents,
      copied.map((c, i) => ({
        clientId: client._id, projectId: row._id, type: c.type, order: i, title: c.title, fields: c.fields ?? {},
        responsible: c.responsible ?? "", driveLink: "", referenceLink: c.referenceLink ?? "", postDate: "", week: c.week ?? "",
        status: "Em criação", checklist: (c.checklist ?? []).map((x: any) => ({ ...x, done: false })), note: "",
        clientApproval: "", clientNote: "", clientActionAt: "", source: "os", legacyId: "", legacyData: {},
      })),
    );
  await logActivity(access, {
    action: "project.created",
    description: `${access.name} criou o projeto ${period} de ${client.name}.`,
    entityType: "project",
    entityId: row._id,
    clientId: client._id,
    visibleToClient: false,
  });
  return json({ _id: row._id }, 201);
});
