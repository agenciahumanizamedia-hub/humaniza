// GET /api/meta/retorno — o Facebook volta para cá depois do login; troca o código pelo token (admin).
import type { APIRoute } from "astro";
import { requireAccess } from "../../../server/access";
import { oauthExchange } from "../../../server/meta";
import { logActivity } from "../../../server/activity";

function readCookie(request: Request, name: string) {
  const m = (request.headers.get("cookie") ?? "").match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : "";
}

export const GET: APIRoute = async ({ request, url }) => {
  const back = readCookie(request, "hz_meta_back") || "/painel";
  const go = (status: string) => {
    const sep = back.includes("?") ? "&" : "?";
    const [path, hash] = back.split("#");
    const headers = new Headers({ Location: `${path}${sep}meta=${status}${hash ? `#${hash}` : ""}` });
    headers.append("Set-Cookie", "hz_meta_state=; Path=/api/meta; Max-Age=0");
    return new Response(null, { status: 302, headers });
  };
  try {
    const access = await requireAccess(["admin"]);
    if (url.searchParams.get("error")) return go("cancelado");
    const state = url.searchParams.get("state") ?? "";
    if (!state || state !== readCookie(request, "hz_meta_state")) return go("invalido");
    const r = await oauthExchange(url.searchParams.get("code") ?? "", `${url.origin}/api/meta/retorno`, access.email);
    await logActivity(access, { action: "meta.connected", description: `${access.name} conectou o Meta pelo login do Facebook (${r.name}).`, entityType: "settings", entityId: "meta", clientId: "" });
    return go("ok");
  } catch (e) {
    console.error("meta retorno", e);
    return go("erro");
  }
};
