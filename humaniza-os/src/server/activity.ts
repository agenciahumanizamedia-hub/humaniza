// Histórico de atividades: toda ação relevante grava quem fez, o quê, em qual item e quando.
// Só o servidor escreve aqui (coleção ADMIN). A data/hora é a de criação do item (_createdDate).
import { create, find, COLLECTIONS, type Row } from "./db";
import type { Access } from "./access";

export interface ActivityInput {
  action: string; // ex.: "client.created", "content.approved"
  description: string; // frase legível, em português
  entityType?: string;
  entityId?: string;
  clientId?: string | null;
  visibleToClient?: boolean;
}

export async function logActivity(access: Access, input: ActivityInput): Promise<void> {
  await create(COLLECTIONS.activity, {
    action: input.action,
    description: input.description,
    entityType: input.entityType ?? "",
    entityId: input.entityId ?? "",
    clientId: input.clientId ?? "",
    visibleToClient: !!input.visibleToClient,
    actorEmail: access.email,
    actorName: access.name,
    actorRole: access.role,
  });
}

/** Timeline do perfil: admin vê tudo; equipe vê os clientes que atende; cliente só o que foi marcado para ele. */
export async function timelineFor(access: Access, visibleClientIds: string[], limit = 50): Promise<Row[]> {
  const sort = [{ fieldName: "_createdDate", order: "DESC" as const }];
  if (access.role === "admin") return find(COLLECTIONS.activity, {}, { limit, sort });
  if (access.role === "client")
    return find(COLLECTIONS.activity, { clientId: access.clientId, visibleToClient: true }, { limit, sort });
  return find(
    COLLECTIONS.activity,
    { $or: [{ clientId: { $in: visibleClientIds } }, { actorEmail: access.email }] },
    { limit, sort },
  );
}
