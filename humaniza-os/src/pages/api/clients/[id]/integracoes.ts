// PATCH /api/clients/:id/integracoes — vincula o Instagram e a conta de anúncios do cliente (admin).
import type { APIRoute } from "astro";
import { requireAccess, loadClientFor } from "../../../../server/access";
import { COLLECTIONS, patch } from "../../../../server/db";
import { logActivity } from "../../../../server/activity";
import { handle, json } from "../../../../server/http";
import { readJson, str } from "../../../../server/util";

export const PATCH: APIRoute = handle(async (request, { params }) => {
  const access = await requireAccess(["admin"]);
  const client = await loadClientFor(access, params.id!);
  const b = await readJson(request);
  const integrations = {
    igUserId: str(b.igUserId, 40).replace(/\D/g, ""),
    igUsername: str(b.igUsername, 80),
    pageId: str(b.pageId, 40).replace(/\D/g, ""),
    adAccountId: str(b.adAccountId, 40).replace(/[^\d_act]/g, ""),
    adAccountName: str(b.adAccountName, 120),
  };
  await patch(COLLECTIONS.clients, client._id, { integrations });
  await logActivity(access, {
    action: "client.integrations",
    description: `${access.name} atualizou as contas do Meta vinculadas a ${client.name}.`,
    entityType: "client", entityId: client._id, clientId: client._id,
  });
  return json({ ok: true });
});
