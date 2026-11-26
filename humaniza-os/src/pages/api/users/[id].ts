// PATCH /api/users/ID — o administrador ajusta o acesso de uma pessoa:
//   { modules: [...] }   áreas liberadas (só equipe)
//   { clientIds: [...] } clientes que a pessoa atende (só equipe)
//   { jobTitle }         função
//   { active: false }    bloqueia o acesso (true libera de novo)
import type { APIRoute } from "astro";
import { requireAccess, HttpError, cleanModules, TEAM_MODULES } from "../../../server/access";
import { getOne, patch, COLLECTIONS } from "../../../server/db";
import { logActivity } from "../../../server/activity";
import { handle, json } from "../../../server/http";
import { readJson, str } from "../../../server/util";
import { setTeamClients } from "../../../server/team-access";

const LABEL: Record<string, string> = {
  projetos: "Projetos e roteiros", calendario: "Calendário e datas", demandas: "Demandas", resultados: "Resultados e tráfego",
  pauta: "Próximos conteúdos", identidade: "Editar identidade visual", lixeira: "Lixeira",
};

export const PATCH: APIRoute = handle(async (request, { params }) => {
  const access = await requireAccess(["admin"]);
  const user = await getOne(COLLECTIONS.users, params.id ?? "");
  if (!user) throw new HttpError(404, "Pessoa não encontrada.");
  const b = await readJson(request);
  const changes: Record<string, unknown> = {};
  const notes: string[] = [];
  if ("jobTitle" in b) changes.jobTitle = str(b.jobTitle, 120);
  if ("active" in b) {
    if (user.email === access.email && b.active === false) throw new HttpError(400, "Você não pode bloquear o seu próprio acesso.");
    changes.active = b.active !== false;
    notes.push(changes.active ? "liberou de novo o acesso" : "bloqueou o acesso");
  }
  if (user.role === "team" && "modules" in b) {
    const mods = cleanModules(b.modules);
    changes.modules = mods;
    notes.push(`áreas: ${mods.length === TEAM_MODULES.length ? "todas da equipe" : mods.map((m) => LABEL[m]).join(", ") || "nenhuma"}`);
  }
  if (Object.keys(changes).length) await patch(COLLECTIONS.users, user._id, changes);
  if (user.role === "team" && Array.isArray(b.clientIds)) {
    const ids = b.clientIds.map((x: unknown) => str(x, 100)).filter(Boolean);
    await setTeamClients(user.email, ids);
    notes.push(`${ids.length} cliente(s)`);
  }
  if (!notes.length && !Object.keys(changes).length) throw new HttpError(400, "Nada para salvar.");
  await logActivity(access, {
    action: "user.updated",
    description: `${access.name} ajustou o acesso de ${user.name}${notes.length ? ` (${notes.join("; ")})` : ""}.`,
    entityType: "user",
    entityId: user._id,
  });
  return json({ ok: true });
});
