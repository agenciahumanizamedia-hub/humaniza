// POST /api/users/senha — suporte de senha feito pelo administrador.
//   { userId, modo: "gerar" } → gera uma senha nova, grava no Wix e devolve UMA vez para copiar.
//   { userId, modo: "email" } → manda o e-mail oficial do Wix com o link para a pessoa criar a senha.
import type { APIRoute } from "astro";
import { requireAccess, HttpError } from "../../../server/access";
import { create, getOne, patch, COLLECTIONS } from "../../../server/db";
import { handle, json, readFields } from "../../../server/http";
import { generatePassword, passwordError, sendSetPasswordEmail, setMemberPassword } from "../../../server/password";

export const POST: APIRoute = handle(async (request) => {
  const access = await requireAccess(["admin"]);
  const f = await readFields(request, ["userId", "modo"] as const);
  const user = f.userId ? await getOne(COLLECTIONS.users, f.userId) : null;
  if (!user?.email) throw new HttpError(404, "Pessoa não encontrada.");
  const email = String(user.email).toLowerCase();
  const log = (description: string) =>
    create(COLLECTIONS.activity, {
      action: "user.password",
      description,
      entityType: "user",
      entityId: user._id,
      clientId: "",
      visibleToClient: false,
      actorEmail: access.email,
      actorName: access.name,
      actorRole: access.role,
    });

  if (f.modo === "email") {
    try {
      await sendSetPasswordEmail(email);
    } catch (err) {
      console.warn("sendSetPasswordEmail:", (err as Error)?.message ?? err);
      throw new HttpError(502, "O Wix não conseguiu enviar o e-mail agora. Tente de novo em instantes.");
    }
    await log(`${access.name} enviou a ${user.name} o e-mail para criar a senha.`);
    return json({ ok: true, sentTo: email });
  }

  if (f.modo !== "gerar") throw new HttpError(400, "Escolha gerar senha ou enviar e-mail.");
  const password = generatePassword();
  try {
    await setMemberPassword(email, password);
  } catch (err) {
    console.warn("setMemberPassword:", (err as Error)?.message ?? err);
    const msg = passwordError(err);
    throw new HttpError(502, msg.includes("conta Wix") ? msg : `${msg} Use “Enviar e-mail para criar senha”.`);
  }
  await patch(COLLECTIONS.users, user._id, { passwordSetAt: new Date().toISOString() });
  await log(`${access.name} gerou uma senha nova para ${user.name}.`);
  return json({ ok: true, email, password });
});
