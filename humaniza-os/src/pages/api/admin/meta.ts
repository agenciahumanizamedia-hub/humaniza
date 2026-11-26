// GET  /api/admin/meta[?contas=1] — situação da conexão com o Meta (e contas visíveis). Admin.
// POST /api/admin/meta — admin cadastra o app da agência ({ appId, appSecret, configId }) ou um token
//      de usuário do sistema ({ token }). Segredos ficam só no servidor e nunca voltam ao navegador.
import type { APIRoute } from "astro";
import { requireAccess, HttpError } from "../../../server/access";
import { handle, json } from "../../../server/http";
import { readJson, str } from "../../../server/util";
import { getMetaSettings, getMetaApp, saveMetaApp, saveMetaToken, discoverAssets, SCOPES, GRAPH_VERSION } from "../../../server/meta";
import { logActivity } from "../../../server/activity";

export const GET: APIRoute = handle(async (_req, { url }) => {
  await requireAccess(["admin"]);
  const [s, app] = await Promise.all([getMetaSettings(), getMetaApp()]);
  const status: Record<string, unknown> = {
    connected: !!s?.data?.token,
    method: s?.data?.method ?? "",
    accountName: s?.data?.accountName ?? "",
    expiresAt: s?.data?.expiresAt ?? "",
    scopes: s?.data?.scopes ?? [],
    missingScopes: s?.data?.scopes?.length ? SCOPES.filter((x) => !s.data.scopes.includes(x)) : [],
    savedAt: s?.data?.savedAt ?? "",
    app: { appId: app?.data?.appId ?? "", hasSecret: !!app?.data?.appSecret, configId: app?.data?.configId ?? "" },
    redirectUri: `${url.origin}/api/meta/retorno`,
    graphVersion: GRAPH_VERSION,
    scopesNeeded: SCOPES,
  };
  if (url.searchParams.get("contas") === "1" && status.connected) status.assets = await discoverAssets();
  return json(status);
});

export const POST: APIRoute = handle(async (request) => {
  const access = await requireAccess(["admin"]);
  const b = await readJson(request);
  if (b.token) {
    const token = str(b.token, 1000);
    if (token.length < 50) throw new HttpError(400, "Token incompleto.");
    const r = await saveMetaToken(token, access.email, "system_user");
    await logActivity(access, { action: "meta.connected", description: `${access.name} conectou o Meta por usuário do sistema (${r.name}).`, entityType: "settings", entityId: "meta", clientId: "" });
    return json({ ok: true, name: r.name, expiresAt: r.expiresAt });
  }
  const appId = str(b.appId, 40).replace(/\D/g, "");
  if (!appId) throw new HttpError(400, "Informe o ID do app.");
  const data: { appId: string; appSecret?: string; configId?: string } = { appId, configId: str(b.configId, 40).replace(/\D/g, "") };
  if (str(b.appSecret, 100)) data.appSecret = str(b.appSecret, 100);
  else if (!(await getMetaApp())?.data?.appSecret) throw new HttpError(400, "Informe a chave secreta do app.");
  await saveMetaApp(data);
  return json({ ok: true });
});
