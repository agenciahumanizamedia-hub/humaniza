// Claude (API da Anthropic) dentro do Humaniza OS: gera rascunhos de análise e de ganchos.
// A chave fica só no servidor (osSettings "anthropic", cadastrada pelo admin no painel). Nada é
// publicado sozinho: o resultado volta como rascunho para a equipe editar e aprovar.
import { COLLECTIONS, find, create, replace } from "./db";
import { HttpError } from "./access";

const API = "https://api.anthropic.com/v1/messages";
const VERSION = "2026-10-21";
export const MODEL = "claude-sonnet-5-5";

export async function aiSettings() {
  return (await find(COLLECTIONS.settings, { key: "anthropic" }, { limit: 1 }))[0] ?? null;
}
export async function saveAiKey(apiKey: string, by: string) {
  const row = await aiSettings();
  const data = { apiKey, savedBy: by, savedAt: new Date().toISOString() };
  if (row) await replace(COLLECTIONS.settings, { ...row, data });
  else await create(COLLECTIONS.settings, { key: "anthropic", data });
}

async function apiKey(): Promise<string> {
  const key = (await aiSettings())?.data?.apiKey;
  if (!key) throw new HttpError(409, "O Claude ainda não foi conectado. Peça ao administrador para cadastrar a chave da API.");
  return key;
}

async function post(key: string, payload: Record<string, unknown>): Promise<any> {
  const res = await fetch(API, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "anthropic-version": VERSION, "content-type": "application/json" },
    body: JSON.stringify({ model: MODEL, ...payload }),
  });
  const body: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = String(body?.error?.message ?? `status ${res.status}`);
    if (res.status === 401) throw new HttpError(409, "A chave do Claude é inválida ou foi revogada. Cadastre uma nova.");
    if (res.status === 429) throw new HttpError(429, "Limite de uso do Claude atingido. Tente de novo em alguns minutos.");
    if (/web.?search/i.test(msg))
      throw new HttpError(409, "A pesquisa na web do Claude está desativada para esta chave. No Console da Anthropic (platform.claude.com), em Settings → Privacy, ative \"Web search\" e tente de novo.");
    throw new HttpError(502, `Claude: ${msg}`);
  }
  return body;
}

export function parseJson(text: string): any {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < start) throw new HttpError(502, "O Claude não devolveu uma resposta no formato esperado. Tente de novo.");
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    throw new HttpError(502, "O Claude não devolveu uma resposta no formato esperado. Tente de novo.");
  }
}

const textOf = (content: any[]) => (content ?? []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("");

/** Chama o Claude e devolve o JSON pedido no prompt. */
export async function askClaude(system: string, user: string, maxTokens = 2500): Promise<any> {
  const body = await post(await apiKey(), { max_tokens: maxTokens, system, messages: [{ role: "user", content: user }] });
  return parseJson(textOf(body.content));
}

export type WebSource = { url: string; title: string };

/** Igual ao askClaude, mas o Claude pode pesquisar na web (ferramenta oficial web_search da API).
 *  Devolve o JSON e a lista de páginas que a pesquisa realmente trouxe (para citar as fontes). */
export async function askClaudeWeb(system: string, user: string, maxTokens = 3000, maxSearches = 4): Promise<{ json: any; sources: WebSource[]; searches: number }> {
  const key = await apiKey();
  const messages: any[] = [{ role: "user", content: user }];
  const tools = [{ type: "web_search_20250305", name: "web_search", max_uses: maxSearches }];
  const sources = new Map<string, WebSource>();
  let searches = 0;
  let final: any[] = [];
  for (let turn = 0; turn < 3; turn++) {
    const body = await post(key, { max_tokens: maxTokens, system, messages, tools });
    const content: any[] = body.content ?? [];
    for (const c of content) {
      if (c.type === "server_tool_use" && c.name === "web_search") searches++;
      if (c.type === "web_search_tool_result" && Array.isArray(c.content))
        for (const r of c.content) if (r?.url) sources.set(r.url, { url: String(r.url), title: String(r.title ?? r.url).slice(0, 200) });
    }
    final = content;
    if (body.stop_reason !== "pause_turn") break;
    messages.push({ role: "assistant", content });
  }
  return { json: parseJson(textOf(final)), sources: [...sources.values()], searches };
}

export const plain = (h: unknown) => String(h ?? "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

export const ANALYST_SYSTEM = `Você é estrategista sênior de social media da Agência Humaniza (Brasil). Escreve em português do Brasil, direto, prático e gentil, para a equipe da agência revisar antes de mostrar ao cliente.
Regras obrigatórias:
- Use SOMENTE os dados fornecidos. Nunca invente números, posts, datas ou resultados.
- Toda sugestão precisa citar em "base" os números exatos (com a fonte) em que se apoia. Se não houver número, diga que é recomendação qualitativa e use a base "Roteiros do Humaniza OS".
- Se faltar dado (ex.: Instagram não conectado), diga isso no resumo e foque no que dá para analisar (roteiros, ganchos, mix de formatos, calendário).
- Seja específico: cite o tema/post, diga o que manter, o que mudar e como (ex.: reescreva o gancho assim: "...").
- Responda APENAS com um objeto JSON válido, sem texto antes ou depois.`;
