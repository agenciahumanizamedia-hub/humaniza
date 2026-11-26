// Orçamentos: formato, contas e conversão dos orçamentos do sistema antigo.
// Os valores são sempre recalculados aqui no servidor a partir dos itens; o navegador só sugere.
import { HttpError } from "./access";
import { str } from "./util";

export const QUOTE_STATUS = ["rascunho", "enviado", "aprovado", "recusado"] as const;
export type QuoteStatus = (typeof QUOTE_STATUS)[number];
export const PAYMENT_METHODS = ["pix", "cartao", "boleto", "transferencia", "dinheiro"] as const;

export interface QuoteItem { description: string; quantity: number; unitPrice: number }

export interface QuoteInput {
  prospectName: string; clientId: string; email: string; whatsapp: string; service: string; segment: string;
  macro: string; objective: string; deliverables: string; notes: string;
  items: QuoteItem[];
  discountType: "valor" | "percentual"; discountValue: number; discountExplanation: string;
  manualFinalEnabled: boolean; manualFinal: number;
  captureDate: string; captureTime: string; validity: string;
  paymentMethods: string[]; paymentTerms: string;
  status: QuoteStatus;
}

const num = (v: unknown, max = 1e9) => {
  // "1.234,50" (formato brasileiro) ou 1234.5 (número do campo).
  const n = typeof v === "string" && v.includes(",") ? Number(v.replace(/\./g, "").replace(",", ".")) : Number(v);
  return Number.isFinite(n) ? Math.min(Math.max(n, 0), max) : 0;
};
const round2 = (n: number) => Math.round(n * 100) / 100;
const date = (v: unknown) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v ?? "")) ? String(v) : "");
const time = (v: unknown) => (/^\d{2}:\d{2}$/.test(String(v ?? "")) ? String(v) : "");

/** Limpa o que veio do navegador e devolve só os campos aceitos. */
export function cleanQuote(b: Record<string, any>): QuoteInput {
  const items: QuoteItem[] = (Array.isArray(b.items) ? b.items : [])
    .slice(0, 60)
    .map((i: any) => ({ description: str(i?.description, 300), quantity: num(i?.quantity, 100000), unitPrice: round2(num(i?.unitPrice)) }))
    .filter((i: QuoteItem) => i.description || i.unitPrice);
  const status = QUOTE_STATUS.includes(b.status) ? (b.status as QuoteStatus) : "rascunho";
  const q: QuoteInput = {
    prospectName: str(b.prospectName, 160),
    clientId: str(b.clientId, 60),
    email: str(b.email, 160),
    whatsapp: str(b.whatsapp, 40),
    service: str(b.service, 160),
    segment: str(b.segment, 160),
    macro: str(b.macro, 4000),
    objective: str(b.objective, 4000),
    deliverables: str(b.deliverables, 6000),
    notes: str(b.notes, 4000),
    items,
    discountType: b.discountType === "percentual" ? "percentual" : "valor",
    discountValue: num(b.discountValue),
    discountExplanation: str(b.discountExplanation, 2000),
    manualFinalEnabled: !!b.manualFinalEnabled,
    manualFinal: round2(num(b.manualFinal)),
    captureDate: date(b.captureDate),
    captureTime: time(b.captureTime),
    validity: date(b.validity),
    paymentMethods: (Array.isArray(b.paymentMethods) ? b.paymentMethods : []).filter((m: string) => (PAYMENT_METHODS as readonly string[]).includes(m)),
    paymentTerms: str(b.paymentTerms, 2000),
    status,
  };
  if (!q.prospectName) throw new HttpError(400, "Informe o nome do cliente.");
  if (q.discountType === "percentual" && q.discountValue > 100) q.discountValue = 100;
  return q;
}

/** Subtotal, desconto e total a partir dos itens. */
export function totals(q: Pick<QuoteInput, "items" | "discountType" | "discountValue" | "manualFinalEnabled" | "manualFinal">) {
  const subtotal = round2(q.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0));
  const discountAmount = round2(
    Math.min(subtotal, q.discountType === "percentual" ? (subtotal * q.discountValue) / 100 : q.discountValue),
  );
  const automatic = round2(subtotal - discountAmount);
  const total = q.manualFinalEnabled ? q.manualFinal : automatic;
  return { subtotal, discountAmount, automaticTotal: automatic, total };
}

export function newToken(): string {
  const b = new Uint8Array(18);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

/** Converte um orçamento do sistema antigo (Hub) no formato novo, para usar como modelo. */
export function fromLegacy(d: Record<string, any>): Partial<QuoteInput> {
  const items: QuoteItem[] = [];
  if (Number(d.videoQuantity) > 0)
    items.push({ description: `Vídeo${d.videoHours ? ` (${d.videoHours}h de captação)` : ""}`, quantity: Number(d.videoQuantity), unitPrice: Number(d.videoUnitPrice) || 0 });
  if (Number(d.photoQuantity) > 0)
    items.push({ description: `Fotos${d.photoHours ? ` (${d.photoHours}h de captação)` : ""}`, quantity: Number(d.photoQuantity), unitPrice: Number(d.photoUnitPrice) || 0 });
  for (const e of Array.isArray(d.extras) ? d.extras : [])
    items.push({ description: String(e?.name ?? e?.label ?? e?.description ?? "Extra"), quantity: Number(e?.quantity ?? e?.qty ?? 1) || 1, unitPrice: Number(e?.price ?? e?.value ?? e?.unitPrice ?? 0) || 0 });
  const pm: string[] = (Array.isArray(d.paymentMethods) ? d.paymentMethods : []).map((m: string) => (m === "card" ? "cartao" : m));
  return {
    prospectName: d.prospectName ?? "",
    email: d.email ?? "",
    whatsapp: d.whatsapp ?? "",
    service: d.service ?? "",
    segment: d.segment ?? "",
    macro: d.macro ?? "",
    objective: d.objective ?? "",
    deliverables: d.deliverables ?? "",
    notes: d.notes ?? "",
    items,
    discountType: "valor",
    discountValue: d.manualFinalEnabled ? 0 : Number(d.discountAmount) || 0,
    discountExplanation: d.discountExplanation ?? "",
    manualFinalEnabled: !!d.manualFinalEnabled,
    manualFinal: Number(d.manualFinal) || 0,
    paymentMethods: pm,
    paymentTerms: d.payment ?? "",
  };
}

/** O que o cliente vê no link público (sem anotações internas). */
export function publicView(row: Record<string, any>) {
  return {
    prospectName: row.prospectName ?? "",
    service: row.service ?? "",
    segment: row.segment ?? "",
    macro: row.macro ?? "",
    objective: row.objective ?? "",
    deliverables: row.deliverables ?? "",
    notes: row.notes ?? "",
    items: row.items ?? [],
    subtotal: row.subtotal ?? 0,
    discountAmount: row.discountAmount ?? 0,
    discountExplanation: row.discountExplanation ?? "",
    total: row.total ?? 0,
    captureDate: row.captureDate ?? "",
    captureTime: row.captureTime ?? "",
    validity: row.validity ?? "",
    paymentMethods: row.paymentMethods ?? [],
    paymentTerms: row.paymentTerms ?? "",
    status: row.status ?? "enviado",
    decidedAt: row.decidedAt ?? "",
    decisionName: row.decisionName ?? "",
    createdAt: row._createdDate ?? "",
  };
}
