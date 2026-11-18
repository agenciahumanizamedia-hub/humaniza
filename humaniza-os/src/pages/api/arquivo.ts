// GET /api/arquivo?tipo=quotes — dados do sistema antigo guardados na migração (somente admin).
import type { APIRoute } from "astro";
import { requireAccess } from "../../server/access";
import { COLLECTIONS, findAll } from "../../server/db";
import { handle, json } from "../../server/http";

export const GET: APIRoute = handle(async (_req, { url }) => {
  await requireAccess(["admin"]);
  const tipo = url.searchParams.get("tipo") ?? "";
  const rows = await findAll(COLLECTIONS.legacy, tipo ? { sourceCollection: tipo } : {});
  return json(rows.map((r) => ({ _id: r._id, sourceCollection: r.sourceCollection, legacyId: r.legacyId, clientId: r.clientId ?? "", data: r.data ?? {} })));
});
