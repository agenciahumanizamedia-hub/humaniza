// Acesso ao banco (Wix CMS) SOMENTE no servidor.
//
// Todas as coleções "os*" foram criadas com permissão ADMIN em leitura e escrita: o navegador de
// um cliente ou funcionário não consegue ler nada direto. Os dados só saem pelos endpoints em
// src/pages/api/, que primeiro descobrem quem é a pessoa (access.ts) e depois chamam estas funções
// com permissão elevada (auth.elevate). Nunca exponha estas funções a um componente do navegador.
//
// Documentação: https://dev.wix.com/docs/go-headless/authentication/admin/elevate-api-call-permissions-with-the-astro-integration
//               https://dev.wix.com/docs/api-reference/business-solutions/cms/data-items/query-data-items?apiView=SDK
import { auth } from "@wix/essentials";
import { items } from "@wix/data";

export const COLLECTIONS = {
  users: "osUsers",
  clients: "osClients",
  activity: "osActivity",
} as const;

type CollectionId = (typeof COLLECTIONS)[keyof typeof COLLECTIONS];
export type Row = Record<string, any> & { _id: string };

const elevatedQuery = auth.elevate(items.query);
const elevatedInsert = auth.elevate(items.insert);
const elevatedGet = auth.elevate(items.get);
const elevatedUpdate = auth.elevate(items.update);

/** Lê itens de uma coleção com filtro (sintaxe de filtro do Wix: { campo: valor } ou { campo: { $in: [...] } }). */
export async function find(
  collection: CollectionId,
  filter: Record<string, unknown> = {},
  opts: { limit?: number; sort?: { fieldName: string; order: "ASC" | "DESC" }[] } = {},
): Promise<Row[]> {
  const res: any = await elevatedQuery(collection, {
    filter,
    sort: opts.sort,
    paging: { limit: opts.limit ?? 100, offset: 0 },
  } as any);
  const list = res?.items ?? res?.dataItems?.map((d: any) => ({ _id: d.id, ...d.data })) ?? [];
  return list as Row[];
}

export async function getOne(collection: CollectionId, id: string): Promise<Row | null> {
  try {
    return ((await elevatedGet(collection, id)) as Row) ?? null;
  } catch {
    return null;
  }
}

export async function create(collection: CollectionId, data: Record<string, unknown>): Promise<Row> {
  return (await elevatedInsert(collection, data as any)) as Row;
}

/** Atualiza um item inteiro: leia antes, mude, e envie o item completo. */
export async function replace(collection: CollectionId, row: Row): Promise<Row> {
  return (await elevatedUpdate(collection, row as any)) as Row;
}
