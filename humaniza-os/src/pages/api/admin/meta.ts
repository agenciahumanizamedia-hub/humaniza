// GET  /api/admin/meta — situação da conexão com o Meta e contas que o token enxerga (admin).
// POST /api/admin/meta — salva um novo token (fica só no servidor; nunca volta para o navegador).
import type { APIRoute } from "astro";
import { requireAccess, HttpError } from "../../../server/access";
import { handle, json } from "../../../server/http";
import { readJson, str } from "../../../server/util";
import { getMetaSettings, saveMetaToken, discoverAssets } from "../../../server/meta";
import { logActivity } from "../../../server/activity";

export const GET: APIRoute = handle(async (_req, { url }) => {
  await requireAccess(["admin"]);
  const s = await getMetaSettings();
  const status = s?.data?.token
    ? { connected: true, accountName: s.data.accountName, expiresAt: s.data.expiresAt, savedAt: s.data.savedAt, savedBy: s.data.savedBy }
    : { connected: false };
  if (url.searchParams.get("contas") === "1" && status.connected) return json({ ...status, assets: await discoverAssets() });
  return json(status);
});

export const POST: APIRoute = handle(async (request) => {
  const access = await requireAccess(["admin"]);
  const b = await readJson(request);
  const token = str(b.token, 1000);
  if (token.length < 50) throw new HttpError(400, "Cole o token completo gerado no Meta.");
  const r = await saveMetaToken(token, access.email);
  await logActivity(access, { action: "meta.connected", description: `${access.name} conectou o Meta (${r.name}).`, entityType: "settings", entityId: "meta", clientId: "" });
  return json({ ok: true, ...r });
});
