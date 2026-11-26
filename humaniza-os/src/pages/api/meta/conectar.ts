// GET /api/meta/conectar?voltar=/painel#... — inicia o login oficial do Facebook (admin).
import type { APIRoute } from "astro";
import { requireAccess } from "../../../server/access";
import { handle } from "../../../server/http";
import { oauthUrl } from "../../../server/meta";

export const GET: APIRoute = handle(async (_req, { url }) => {
  await requireAccess(["admin"]);
  const state = crypto.randomUUID();
  const back = (url.searchParams.get("voltar") ?? "/painel").startsWith("/") ? url.searchParams.get("voltar") ?? "/painel" : "/painel";
  const target = await oauthUrl(`${url.origin}/api/meta/retorno`, state);
  const cookie = (k: string, v: string) => `${k}=${encodeURIComponent(v)}; Path=/api/meta; HttpOnly; Secure; SameSite=Lax; Max-Age=600`;
  const headers = new Headers({ Location: target });
  headers.append("Set-Cookie", cookie("hz_meta_state", state));
  headers.append("Set-Cookie", cookie("hz_meta_back", back));
  return new Response(null, { status: 302, headers });
});
