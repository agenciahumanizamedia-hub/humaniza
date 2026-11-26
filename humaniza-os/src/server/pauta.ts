// "Próximos conteúdos": pautas sugeridas pelo Claude para o mês de captação de um cliente.
// Regras:
// - Ficam guardadas em osSettings ("pauta:<clienteId>:<AAAA-MM>") e só a equipe/admin vê.
// - O Claude recebe SOMENTE dados do próprio cliente. A comparação com a base de outros clientes
//   é feita aqui no servidor, sem mandar nada deles para o Claude.
// - Ao aprovar, a pauta vira um roteiro/carrossel/estático no projeto do mês (criado se não existir).
import { COLLECTIONS, find, findAll, create, replace, type Row } from "./db";

export const PAUTA_TYPES = ["roteiro", "carrossel", "estatico"] as const;
export type PautaType = (typeof PAUTA_TYPES)[number];

export interface Trend { id: string; title: string; description: string; apply: string; kind: string; sources: { url: string; title: string }[] }
export interface Idea {
  id: string; type: PautaType; title: string; tema: string; objetivo: string; gancho: string; desenvolvimento: string;
  legenda: string; cta: string; captacao: string; postDate: string; trendId: string; why: string;
  status: "sugerida" | "aprovada" | "descartada"; contentId?: string; projectId?: string; createdAt: string; by: string; editedBy?: string;
}
export interface PautaData {
  trends: { summary: string; items: Trend[]; sources: { url: string; title: string }[]; at: string; by: string; searches: number } | null;
  ideas: Idea[];
}

const keyOf = (clientId: string, mes: string) => `pauta:${clientId}:${mes}`;

export async function loadPauta(clientId: string, mes: string): Promise<{ row: Row | null; data: PautaData }> {
  const row = (await find(COLLECTIONS.settings, { key: keyOf(clientId, mes) }, { limit: 1 }))[0] ?? null;
  const d = row?.data ?? {};
  return { row, data: { trends: d.trends ?? null, ideas: Array.isArray(d.ideas) ? d.ideas : [] } };
}
export async function savePauta(clientId: string, mes: string, row: Row | null, data: PautaData) {
  if (row) await replace(COLLECTIONS.settings, { ...row, data });
  else await create(COLLECTIONS.settings, { key: keyOf(clientId, mes), data });
}

/** Todas as pautas já sugeridas (qualquer mês) — do cliente e dos demais, separadas. */
export async function allPautaIdeas(clientId: string): Promise<{ mine: Idea[]; others: Idea[] }> {
  const rows = (await findAll(COLLECTIONS.settings)).filter((r) => String(r.key ?? "").startsWith("pauta:"));
  const mine: Idea[] = [], others: Idea[] = [];
  for (const r of rows) {
    const ideas: Idea[] = Array.isArray(r.data?.ideas) ? r.data.ideas : [];
    (String(r.key).split(":")[1] === clientId ? mine : others).push(...ideas);
  }
  return { mine, others };
}

// ---------- Similaridade (evitar repetição) ----------
const STOP = new Set(
  "a o os as de da do das dos e em no na nos nas um uma uns umas para pra por com sem que se seu sua seus suas eh ao aos como mais muito voce voces vc sobre isso esse essa este esta isto ele ela eles elas nao sim ja tem ter ser sao foi vai vou faz fazer seu meu minha nosso nossa the and of to".split(" "),
);
export function tokens(s: string): Set<string> {
  const t = String(s ?? "")
    .replace(/<[^>]+>/g, " ")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w))
    .map((w) => (w.length > 5 && w.endsWith("s") ? w.slice(0, -1) : w));
  return new Set(t);
}
function jaccard(a: Set<string>, b: Set<string>) {
  if (!a.size || !b.size) return { score: 0, common: 0 };
  let common = 0;
  for (const w of a) if (b.has(w)) common++;
  return { score: common / (a.size + b.size - common), common };
}
export interface Ref { label: string; theme: Set<string>; hook: Set<string> }
export function refOf(title: string, tema: string, gancho: string, label = ""): Ref {
  return { label: label || title || tema, theme: tokens(`${title} ${tema}`), hook: tokens(gancho) };
}
/** Devolve o item parecido demais (ou null). Tema igual ou gancho igual já conta como repetição. */
export function tooSimilar(r: Ref, refs: Ref[]): Ref | null {
  for (const x of refs) {
    const t = jaccard(r.theme, x.theme);
    if (t.common >= 2 && t.score >= 0.5) return x;
    const h = jaccard(r.hook, x.hook);
    if (h.common >= 3 && h.score >= 0.55) return x;
  }
  return null;
}
export const contentRef = (c: Row) => refOf(String(c.title ?? ""), String(c.fields?.tema ?? ""), String(c.fields?.gancho ?? ""), String(c.title || c.fields?.tema || ""));
export const ideaRef = (i: Idea) => refOf(i.title, i.tema, i.gancho);

// ---------- Aprovar: vira conteúdo no projeto do mês ----------
const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
export const monthName = (mes: string) => `${MONTHS[Number(mes.slice(5, 7)) - 1]} ${mes.slice(0, 4)}`;
export const CHECKLIST: Record<PautaType, string[]> = {
  roteiro: ["Roteiro escrito", "Aprovado pelo cliente", "Captado", "Editado", "Legenda pronta", "Postado"],
  carrossel: ["Texto dos slides", "Aprovado pelo cliente", "Arte criada", "Legenda pronta", "Postado"],
  estatico: ["Mensagem definida", "Aprovado pelo cliente", "Arte criada", "Legenda pronta", "Postado"],
};
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
export const toHtml = (s: string) =>
  String(s ?? "")
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => `<p>${esc(l)}</p>`)
    .join("");

export async function projectForMonth(client: Row, mes: string, by: string, historyLine: (by: string, t: string) => string): Promise<{ project: Row; created: boolean }> {
  const all = (await findAll(COLLECTIONS.projects, { clientId: client._id })).filter((p) => !p.trashedAt);
  const name = monthName(mes).toLowerCase();
  const found = all.find((p) => p.periodSort === mes) ?? all.find((p) => String(p.period ?? "").toLowerCase().trim() === name);
  if (found) return { project: found, created: false };
  const project = await create(COLLECTIONS.projects, {
    clientId: client._id,
    period: monthName(mes),
    periodSort: mes,
    strategic: { macro: "", editorial: "", themes: "", creative: "", note: "" },
    calendar: { content: "", note: "" },
    productionNote: "",
    strategicStatus: "Em desenvolvimento",
    productionStatus: "Bloqueado",
    calendarStatus: "Bloqueado",
    approvalStatus: "Bloqueado",
    approvalNotes: "",
    history: [historyLine(by, "Criou o projeto ao aprovar uma pauta de Próximos conteúdos.")],
    meta: {},
  });
  return { project, created: true };
}
