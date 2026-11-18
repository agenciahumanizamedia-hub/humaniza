// Respostas padronizadas dos endpoints e leitura segura do corpo da requisição.
import { HttpError } from "./access";

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

/** Envolve um endpoint: erros conhecidos viram 401/403/404/400; o resto vira 500 sem vazar detalhes. */
export function handle(fn: (request: Request, ctx: { params: Record<string, string | undefined>; url: URL }) => Promise<Response>) {
  return async ({ request, params, url }: { request: Request; params: Record<string, string | undefined>; url: URL }) => {
    try {
      return await fn(request, { params: params ?? {}, url: url ?? new URL(request.url) });
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message }, e.status);
      if (e instanceof Error && e.message === "not-found") return json({ error: "Item não encontrado." }, 404);
      console.error("[humaniza-os]", e);
      return json({ error: "Erro interno. Tente novamente." }, 500);
    }
  };
}

/** Lê o JSON do corpo e mantém só os campos permitidos, como texto limpo. */
export async function readFields<K extends string>(request: Request, allowed: readonly K[]): Promise<Partial<Record<K, string>>> {
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    throw new HttpError(400, "Dados inválidos.");
  }
  const out: Partial<Record<K, string>> = {};
  for (const key of allowed) {
    const v = body[key];
    if (v === undefined || v === null) continue;
    out[key] = String(v).trim().slice(0, 2000);
  }
  return out;
}
