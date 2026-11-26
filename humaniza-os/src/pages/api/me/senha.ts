// POST /api/me/senha — a própria pessoa troca a senha (admin, equipe ou cliente).
// Usa a sessão de quem está logado: ninguém troca a senha de outra pessoa por aqui.
import type { APIRoute } from "astro";
import { requireAccess, HttpError } from "../../../server/access";
import { create, COLLECTIONS } from "../../../server/db";
import { handle, json } from "../../../server/http";
import { changeOwnPassword, passwordError } from "../../../server/password";
import { readJson } from "../../../server/util";

export const POST: APIRoute = handle(async (request) => {
  const access = await requireAccess();
  const body = await readJson(request);
  const password = typeof body.password === "string" ? body.password : "";
  if (password.length < 8) throw new HttpError(400, "Use pelo menos 8 caracteres.");
  if (password.length > 100) throw new HttpError(400, "Senha longa demais.");
  try {
    await changeOwnPassword(password);
  } catch (err) {
    console.warn("changeOwnPassword:", (err as Error)?.message ?? err);
    throw new HttpError(400, passwordError(err));
  }
  await create(COLLECTIONS.activity, {
    action: "user.password",
    description: `${access.name} trocou a própria senha.`,
    entityType: "user",
    entityId: access.userId,
    clientId: "",
    visibleToClient: false,
    actorEmail: access.email,
    actorName: access.name,
    actorRole: access.role,
  });
  return json({ ok: true });
});
