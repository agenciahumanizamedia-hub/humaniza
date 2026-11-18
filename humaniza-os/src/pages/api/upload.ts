// POST /api/upload — gera um endereço de envio de imagem para a Mídia do Wix (admin e equipe).
// O navegador envia o arquivo direto para esse endereço e recebe de volta o link da imagem.
import type { APIRoute } from "astro";
import { auth } from "@wix/essentials";
import { files } from "@wix/media";
import { requireAccess, HttpError } from "../../server/access";
import { handle, json } from "../../server/http";
import { readJson, str } from "../../server/util";

const generate = auth.elevate(files.generateFileUploadUrl);
const TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif", "image/svg+xml", "application/pdf"];

export const POST: APIRoute = handle(async (request) => {
  await requireAccess(["admin", "team"]);
  const b = await readJson(request);
  const mimeType = str(b.mimeType, 60);
  if (!TYPES.includes(mimeType)) throw new HttpError(400, "Envie PNG, JPG, WEBP, GIF, SVG ou PDF.");
  const fileName = str(b.fileName, 120).replace(/[^\w.\- ]/g, "_") || "arquivo";
  const res: any = await generate(mimeType, { fileName, labels: ["humaniza-os"] } as any);
  return json({ uploadUrl: res.uploadUrl, fileName });
});
