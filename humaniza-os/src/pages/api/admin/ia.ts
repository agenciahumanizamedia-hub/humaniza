// GET  /api/admin/ia — o Claude está conectado? (admin)
// POST /api/admin/ia { apiKey } — salva a chave da API da Anthropic (só no servidor; nunca volta à tela).
import type { APIRoute } from "astro";
import { requireAccess, HttpError } from "../../../server/access";
import { handle, json } from "../../../server/http";
import { readJson, str } from "../../../server/util";
import { aiSettings, saveAiKey, askClaude, MODEL } from "../../../server/ai";
import { logActivity } from "../../../server/activity";

export const GET: APIRoute = handle(async () => {
  await requireAccess(["admin"]);
  const s = await aiSettings();
  return json({ connected: !!s?.data?.apiKey, savedAt: s?.data?.savedAt ?? "", model: MODEL });
});

export const POST: APIRoute = handle(async (request) => {
  const access = await requireAccess(["admin"]);
  const key = str((await readJson(request)).apiKey, 300);
  if (!key.startsWith("sk-ant-") || key.length < 40) throw new HttpError(400, "Cole a chave completa (começa com sk-ant-).");
  await saveAiKey(key, access.email);
  try {
    await askClaude("Responda apenas com JSON.", 'Devolva {"ok": true}', 20);
  } catch (e) {
    throw new HttpError(400, `A chave foi salva, mas o teste falhou: ${e instanceof Error ? e.message : e}`);
  }
  await logActivity(access, { action: "ai.connected", description: `${access.name} conectou o Claude ao Humaniza OS.`, entityType: "settings", entityId: "anthropic", clientId: "" });
  return json({ ok: true });
});
