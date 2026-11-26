// GET /api/me — perfil de quem está logado. 401 quando não há login liberado.
import type { APIRoute } from "astro";
import { requireAccess } from "../../server/access";
import { handle, json } from "../../server/http";

export const GET: APIRoute = handle(async () => {
  const a = await requireAccess();
  return json({ name: a.name, email: a.email, role: a.role, clientId: a.clientId, permission: a.permission, modules: a.modules });
});
