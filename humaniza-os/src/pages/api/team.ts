// GET /api/team — pessoas da equipe (para atribuir demandas e responsáveis). Admin e equipe.
import type { APIRoute } from "astro";
import { requireAccess } from "../../server/access";
import { COLLECTIONS, findAll } from "../../server/db";
import { handle, json } from "../../server/http";

export const GET: APIRoute = handle(async () => {
  await requireAccess(["admin", "team"]);
  const rows = await findAll(COLLECTIONS.users, { role: { $in: ["admin", "team"] } });
  return json(
    rows
      .filter((u) => u.active !== false)
      .map((u) => ({ _id: u._id, name: u.name, email: u.email, role: u.role, jobTitle: u.jobTitle ?? "", permission: u.permission ?? "" }))
      .sort((a, b) => String(a.name).localeCompare(String(b.name))),
  );
});
