// GET  /api/quotes — orçamentos novos (somente admin), do mais recente ao mais antigo.
// POST /api/quotes — cria um orçamento. Com { copyFrom } duplica um orçamento novo; com
//      { copyFromLegacy } usa um orçamento do sistema antigo como modelo.
import type { APIRoute } from "astro";
import { requireAccess, HttpError } from "../../../server/access";
import { create, getOne, findAll, COLLECTIONS } from "../../../server/db";
import { logActivity } from "../../../server/activity";
import { handle, json } from "../../../server/http";
import { readJson, historyLine } from "../../../server/util";
import { cleanQuote, fromLegacy, newToken, totals } from "../../../server/quotes";

export const GET: APIRoute = handle(async () => {
  await requireAccess(["admin"]);
  const rows = await findAll(COLLECTIONS.quotes);
  rows.sort((a, b) => String(b._createdDate ?? "").localeCompare(String(a._createdDate ?? "")));
  return json(rows);
});

export const POST: APIRoute = handle(async (request) => {
  const access = await requireAccess(["admin"]);
  const b = await readJson(request);
  let base: Record<string, any> = b;
  let origin = "";
  if (b.copyFrom) {
    const src = await getOne(COLLECTIONS.quotes, String(b.copyFrom));
    if (!src) throw new HttpError(404, "Orçamento não encontrado.");
    base = { ...src, status: "rascunho" };
    origin = ` (cópia de ${src.prospectName})`;
  } else if (b.copyFromLegacy) {
    const src = await getOne(COLLECTIONS.legacy, String(b.copyFromLegacy));
    if (!src || src.sourceCollection !== "quotes") throw new HttpError(404, "Orçamento antigo não encontrado.");
    base = { ...fromLegacy(src.data ?? {}), status: "rascunho" };
    origin = ` (modelo: ${src.data?.prospectName ?? "orçamento antigo"})`;
  }
  const q = cleanQuote(base);
  // Datas de captação e validade não fazem sentido numa cópia: ficam em branco para preencher.
  if (b.copyFrom || b.copyFromLegacy) Object.assign(q, { captureDate: "", captureTime: "", validity: "" });
  const row = await create(COLLECTIONS.quotes, {
    ...q,
    ...totals(q),
    publicToken: newToken(),
    createdBy: access.email,
    history: [historyLine(access.name, `criou o orçamento${origin}`)],
  });
  await logActivity(access, {
    action: "quote.created",
    description: `${access.name} criou o orçamento de ${q.prospectName}${origin}.`,
    entityType: "quote",
    entityId: row._id,
  });
  return json({ _id: row._id }, 201);
});
