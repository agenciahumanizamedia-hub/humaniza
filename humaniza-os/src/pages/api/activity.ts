// GET /api/activity — timeline filtrada pelo perfil de quem pede.
import type { APIRoute } from "astro";
import { requireAccess, clientFilter } from "../../server/access";
import { find, COLLECTIONS } from "../../server/db";
import { timelineFor } from "../../server/activity";
import { handle, json } from "../../server/http";

export const GET: APIRoute = handle(async () => {
  const access = await requireAccess();
  const visible = access.role === "team" ? (await find(COLLECTIONS.clients, clientFilter(access))).map((c) => c._id) : [];
  const rows = await timelineFor(access, visible);
  return json(
    rows.map((r) => ({
      _id: r._id,
      when: r._createdDate ?? null,
      description: r.description,
      actorName: r.actorName,
      actorRole: r.actorRole,
      action: r.action,
      clientId: r.clientId || null,
    })),
  );
});
