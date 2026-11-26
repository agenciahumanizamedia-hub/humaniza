// Sincronização com o Meta.
// GET  /api/sync            — (agendador) lista os clientes com contas vinculadas.
// POST /api/sync?cliente=ID — sincroniza um cliente. Aceita o agendador (cabeçalho x-sync-key,
//                             conferido pelo hash guardado em osSettings) ou um admin logado
//                             (botão "Sincronizar agora").
import type { APIRoute } from "astro";
import { requireAccess, HttpError, loadClientFor } from "../../../server/access";
import { COLLECTIONS, find } from "../../../server/db";
import { handle, json } from "../../../server/http";
import { syncClient, clientsToSync } from "../../../server/sync";

async function sha256(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function fromScheduler(request: Request) {
  const key = request.headers.get("x-sync-key");
  if (!key) return false;
  const row = (await find(COLLECTIONS.settings, { key: "sync" }, { limit: 1 }))[0];
  if (!row?.data?.keyHash) return false;
  return (await sha256(key)) === row.data.keyHash;
}

export const GET: APIRoute = handle(async (request) => {
  if (!(await fromScheduler(request))) throw new HttpError(401, "Não autorizado.");
  return json(await clientsToSync());
});

export const POST: APIRoute = handle(async (request, { url }) => {
  const clientId = url.searchParams.get("cliente") ?? "";
  if (!clientId) throw new HttpError(400, "Informe o cliente.");
  if (!(await fromScheduler(request))) {
    const access = await requireAccess(["admin"]);
    await loadClientFor(access, clientId);
  }
  return json(await syncClient(clientId, { full: url.searchParams.get("completo") === "1" }));
});
