// Utilidades do servidor: leitura de JSON, limpeza de HTML dos roteiros e histórico.
import { HttpError } from "./access";

export async function readJson(request: Request): Promise<Record<string, any>> {
  try {
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
    return body as Record<string, any>;
  } catch {
    throw new HttpError(400, "Dados inválidos.");
  }
}

export const str = (v: unknown, max = 2000) => (v === undefined || v === null ? "" : String(v).trim().slice(0, max));

/**
 * Limpa o HTML dos editores de texto (roteiros, planejamento). Mantém só formatação simples:
 * negrito, itálico, sublinhado, quebras, listas, cor e fundo. Remove scripts, eventos (on*),
 * links javascript: e qualquer outro atributo.
 */
export function cleanHtml(input: unknown, max = 60000): string {
  let h = String(input ?? "").slice(0, max);
  h = h.replace(/<(script|style|iframe|object|embed|link|meta)[\s\S]*?(<\/\1>|$)/gi, "");
  const allowed = new Set(["b", "strong", "i", "em", "u", "br", "div", "p", "span", "font", "ul", "ol", "li", "h3", "h4", "mark"]);
  h = h.replace(/<\/?([a-zA-Z0-9]+)([^>]*)>/g, (full, tag: string, attrs: string) => {
    const t = tag.toLowerCase();
    if (!allowed.has(t)) return "";
    if (full.startsWith("</")) return `</${t}>`;
    const keep: string[] = [];
    const color = attrs.match(/\bcolor\s*=\s*["']?(#[0-9a-fA-F]{3,6}|rgb\([\d\s,]+\))/);
    if (t === "font" && color) keep.push(`color="${color[1]}"`);
    const style = attrs.match(/\bstyle\s*=\s*"([^"]*)"/);
    if (style) {
      const safe = style[1]
        .split(";")
        .map((d) => d.trim())
        .filter((d) => /^(color|background-color|font-weight|font-style|text-decoration|font-size)\s*:\s*[#\w\s(),.%-]+$/i.test(d) && !/url|expression/i.test(d));
      if (safe.length) keep.push(`style="${safe.join("; ")}"`);
    }
    return `<${t}${keep.length ? " " + keep.join(" ") : ""}>`;
  });
  return h;
}

export function historyLine(who: string, text: string): string {
  const now = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  return `${now} • ${who} • ${text}`;
}

export const STAGES = ["strategic", "production", "calendar", "approval"] as const;
export type Stage = (typeof STAGES)[number];
export const STAGE_LABEL: Record<Stage, string> = {
  strategic: "Planejamento",
  production: "Desenvolvimento",
  calendar: "Calendário",
  approval: "Aprovação final",
};
export const STAGE_STATUS = [
  "Bloqueado",
  "Em desenvolvimento",
  "Liberado ao cliente",
  "Aguardando aprovação",
  "Ajustes solicitados",
  "Aprovado",
  "Finalizado",
];
