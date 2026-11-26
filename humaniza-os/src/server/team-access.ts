// Quais clientes uma pessoa da equipe atende. O vínculo continua sendo o campo `teamEmails` de cada
// cliente (o mesmo de "Dados e equipe"); aqui ele é ajustado de uma vez a partir da tela de Acessos.
import { findAll, patch, COLLECTIONS } from "./db";

const norm = (v: unknown) => String(v ?? "").trim().toLowerCase();

/** Deixa `email` exatamente nos clientes `clientIds`: entra nos marcados e sai dos demais. */
export async function setTeamClients(email: string, clientIds: string[]): Promise<void> {
  const who = norm(email);
  const wanted = new Set(clientIds.filter(Boolean));
  const clients = await findAll(COLLECTIONS.clients);
  for (const c of clients) {
    const team: string[] = (Array.isArray(c.teamEmails) ? c.teamEmails : []).map(norm);
    const has = team.includes(who);
    const should = wanted.has(c._id);
    if (has === should) continue;
    const next = should ? [...team, who].slice(0, 30) : team.filter((e) => e !== who);
    await patch(COLLECTIONS.clients, c._id, { teamEmails: next });
  }
}
