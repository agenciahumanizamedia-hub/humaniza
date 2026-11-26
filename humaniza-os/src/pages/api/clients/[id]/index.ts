// GET   /api/clients/:id — ficha do cliente (o que cada perfil pode ver).
// PATCH /api/clients/:id — atualiza identidade e dados do cliente (admin; equipe só identidade visual).
import type { APIRoute } from "astro";
import { requireAccess, loadClientFor, HttpError, requireModule } from "../../../../server/access";
import { COLLECTIONS, patch } from "../../../../server/db";
import { logActivity } from "../../../../server/activity";
import { handle, json } from "../../../../server/http";
import { readJson, str } from "../../../../server/util";

const CLIENT_VIEW = ["_id", "name", "logoUrl", "coverUrl", "brand", "status", "serviceType", "serviceCustom", "instagram", "responsibleName", "responsiblePhone", "whatsapp", "driveUrl"];
const TEAM_VIEW = [...CLIENT_VIEW, "email", "teamEmails", "access", "notes", "integrations"];

const HEX = /^#[0-9a-fA-F]{6}$/;
function cleanBrand(b: any) {
  const colors = Array.isArray(b?.colors)
    ? b.colors
        .slice(0, 12)
        .map((c: any) => ({ hex: HEX.test(String(c?.hex)) ? String(c.hex).toUpperCase() : "", name: str(c?.name, 40), role: str(c?.role, 30) }))
        .filter((c: any) => c.hex)
    : [];
  return {
    colors,
    fonts: str(b?.fonts, 200),
    tone: str(b?.tone, 1000),
    notes: str(b?.notes, 2000),
    useHumanizaPalette: b?.useHumanizaPalette !== false,
  };
}
const url = (v: unknown) => {
  const s = str(v, 1000);
  return /^https:\/\//.test(s) ? s : "";
};

export const GET: APIRoute = handle(async (_req, { params }) => {
  const access = await requireAccess();
  const c = await loadClientFor(access, params.id!);
  const fields = access.role === "client" ? CLIENT_VIEW : TEAM_VIEW;
  return json(Object.fromEntries(fields.map((f) => [f, c[f] ?? null])));
});

export const PATCH: APIRoute = handle(async (request, { params }) => {
  const access = await requireAccess(["admin", "team"]);
  requireModule(access, "identidade");
  const c = await loadClientFor(access, params.id!);
  const b = await readJson(request);
  const changes: Record<string, unknown> = {};
  // identidade visual: admin e equipe do cliente
  if ("brand" in b) changes.brand = cleanBrand(b.brand);
  if ("logoUrl" in b) changes.logoUrl = url(b.logoUrl);
  if ("coverUrl" in b) changes.coverUrl = url(b.coverUrl);
  if (access.role === "admin") {
    for (const k of ["name", "email", "status", "serviceType", "serviceCustom", "instagram", "responsibleName", "responsiblePhone", "whatsapp", "notes", "access"]) {
      if (k in b) changes[k] = k === "email" ? str(b[k], 200).toLowerCase() : str(b[k], k === "notes" ? 4000 : 300);
    }
    if ("driveUrl" in b) changes.driveUrl = url(b.driveUrl);
    if ("teamEmails" in b && Array.isArray(b.teamEmails))
      changes.teamEmails = b.teamEmails.map((e: any) => str(e, 200).toLowerCase()).filter((e: string) => e.includes("@")).slice(0, 30);
    if (changes.name === "") throw new HttpError(400, "O nome do cliente não pode ficar vazio.");
  }
  if (!Object.keys(changes).length) throw new HttpError(400, "Nada para salvar.");
  await patch(COLLECTIONS.clients, c._id, changes);
  await logActivity(access, {
    action: "client.updated",
    description: `${access.name} atualizou ${"brand" in changes || "logoUrl" in changes ? "a identidade visual" : "os dados"} de ${c.name}.`,
    entityType: "client",
    entityId: c._id,
    clientId: c._id,
  });
  return json({ ok: true });
});
