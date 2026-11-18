// POST /api/admin/importar-hub — copia os dados do Hub Humaniza (Firebase) para o Humaniza OS.
//
// Somente admin. Lê as coleções públicas do Hub (hubClients, hubProjects, hubBriefingQuestions,
// hubBriefingAnswers) pela API REST do Firestore, SEM alterar nada lá. Pode ser rodado de novo:
// clientes, projetos e conteúdos que já foram copiados (pelo id antigo) são pulados.
import type { APIRoute } from "astro";
import { requireAccess } from "../../../server/access";
import { COLLECTIONS, findAll, createMany } from "../../../server/db";
import { logActivity } from "../../../server/activity";
import { handle, json } from "../../../server/http";

const BASE = "https://firestore.googleapis.com/v1/projects/humaniza-os/databases/(default)/documents";

function decode(v: any): any {
  if (!v || typeof v !== "object") return v;
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("nullValue" in v) return null;
  if ("timestampValue" in v) return v.timestampValue;
  if ("mapValue" in v) return decodeFields(v.mapValue.fields || {});
  if ("arrayValue" in v) return (v.arrayValue.values || []).map(decode);
  if ("referenceValue" in v) return v.referenceValue;
  return null;
}
function decodeFields(fields: Record<string, any>) {
  const o: Record<string, any> = {};
  for (const [k, v] of Object.entries(fields)) o[k] = decode(v);
  return o;
}
async function readCollection(name: string): Promise<any[]> {
  const out: any[] = [];
  let pageToken = "";
  for (let i = 0; i < 50; i++) {
    const url = `${BASE}/${name}?pageSize=300${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ""}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Firestore ${name}: ${res.status}`);
    const body: any = await res.json();
    for (const d of body.documents || []) out.push({ _fid: d.name.split("/").pop(), ...decodeFields(d.fields || {}) });
    if (!body.nextPageToken) break;
    pageToken = body.nextPageToken;
  }
  return out;
}

const plain = (h: string) => (h || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const MONTHS: Record<string, number> = { janeiro: 1, fevereiro: 2, marco: 3, abril: 4, maio: 5, junho: 6, julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12 };
function periodSort(p: string): string {
  const t = (p || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "");
  const y = t.match(/20\d\d/);
  let best: [number, number] | null = null;
  for (const [name, n] of Object.entries(MONTHS)) {
    const i = t.indexOf(name);
    if (i >= 0 && (!best || i < best[1])) best = [n, i];
  }
  return best ? `${y ? y[0] : "2026"}-${String(best[0]).padStart(2, "0")}` : "";
}

export const POST: APIRoute = handle(async () => {
  const access = await requireAccess(["admin"]);
  const [hubClients, hubProjects, questions, answers] = await Promise.all(
    ["hubClients", "hubProjects", "hubBriefingQuestions", "hubBriefingAnswers"].map(readCollection),
  );

  // Clientes
  const existingClients = await findAll(COLLECTIONS.clients);
  const byHub = new Map(existingClients.filter((c) => c.legacyHubId).map((c) => [c.legacyHubId, c._id]));
  const newClients: any[] = [];
  for (const c of hubClients) {
    if (byHub.has(c._fid)) continue;
    const id = crypto.randomUUID();
    byHub.set(c._fid, id);
    const email = String(c.email || "").trim().toLowerCase();
    newClients.push({
      _id: id, name: String(c.name || "").trim(), email: email.includes("@") ? email : "",
      status: c.status || "Ativo", access: c.access || "", serviceType: c.serviceType || "", serviceCustom: c.serviceCustom || "",
      responsibleName: c.responsibleName || "", responsiblePhone: c.responsiblePhone || "", whatsapp: c.responsiblePhone || "",
      notes: c.obs || "", teamEmails: [], legacyHubId: c._fid, legacyAgencyId: "",
      brand: { colors: [], fonts: "", notes: "" },
      legacyMeta: { briefingEditAllowed: c.briefingEditAllowed ?? null, briefingStatus: c.briefingStatus ?? null, briefingCurrentVersion: c.briefingCurrentVersion ?? null, accessState: c.accessState ?? null, clientState: c.clientState ?? null },
    });
  }

  // Projetos e conteúdos
  const existingProjects = await findAll(COLLECTIONS.projects);
  const projectsDone = new Set(existingProjects.map((p) => p.legacyHubId));
  const newProjects: any[] = [];
  const newContents: any[] = [];
  for (const p of hubProjects) {
    if (projectsDone.has(p._fid)) continue;
    const id = crypto.randomUUID();
    const prod = p.production || {};
    newProjects.push({
      _id: id, clientId: byHub.get(p.clientId) || "", period: p.period || "", periodSort: periodSort(p.period || ""),
      strategic: p.strategic || {}, calendar: p.calendar || {}, productionNote: prod.note || "",
      strategicStatus: p.strategicStatus || "", productionStatus: p.productionStatus || "", calendarStatus: p.calendarStatus || "",
      approvalStatus: p.approvalStatus || "", approvalNotes: p.approvalNotes || "", history: p.history || [],
      meta: { projectAccess: p.projectAccess ?? null, projectState: p.projectState ?? null },
      legacyHubId: p._fid, legacyCreatedAt: p.createdAt || "",
    });
    (prod.items || []).forEach((it: any, i: number) => {
      const f = it.fields || {};
      newContents.push({
        clientId: byHub.get(p.clientId) || "", projectId: id, type: it.type || "roteiro", order: i,
        title: plain(f.tema).slice(0, 300) || it.title || "", fields: f, responsible: it.responsible || "",
        driveLink: it.driveLink || "", referenceLink: it.referenceLink || "", postDate: it.postDate || "", week: it.week || "",
        status: it.itemStatus || "Em criação", checklist: it.checklist || [], note: it.note || "",
        clientApproval: it.clientApproval || "", clientNote: it.clientNote || "", clientActionAt: it.clientActionAt || "",
        source: "hub", legacyId: it.id || "", legacyData: {},
      });
    });
  }

  // Briefing (guardado no arquivo histórico até a tela de briefing ficar pronta)
  const existingLegacy = await findAll(COLLECTIONS.legacy);
  const legacyDone = new Set(existingLegacy.map((l) => `${l.sourceCollection}:${l.legacyId}`));
  const newLegacy: any[] = [];
  for (const [name, rows] of [["hubBriefingQuestions", questions], ["hubBriefingAnswers", answers]] as const) {
    for (const r of rows) {
      if (legacyDone.has(`${name}:${r._fid}`)) continue;
      newLegacy.push({ sourceCollection: name, legacyId: r._fid, clientId: byHub.get(r.clientId) || "", data: r });
    }
  }

  const result = {
    clientes: await createMany(COLLECTIONS.clients, newClients),
    projetos: await createMany(COLLECTIONS.projects, newProjects),
    conteudos: await createMany(COLLECTIONS.contents, newContents),
    briefing: await createMany(COLLECTIONS.legacy, newLegacy),
    lidosDoHub: { clientes: hubClients.length, projetos: hubProjects.length, perguntas: questions.length, respostas: answers.length },
  };
  await logActivity(access, {
    action: "import.hub",
    description: `${access.name} importou do Hub: ${result.clientes} clientes, ${result.projetos} projetos e ${result.conteudos} conteúdos.`,
    entityType: "import",
    entityId: "hub",
    clientId: "",
  });
  return json(result);
});
