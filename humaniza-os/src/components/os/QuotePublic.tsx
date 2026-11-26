// Página que o cliente abre pelo link do orçamento: vê tudo, aprova ou recusa, e baixa em PDF.
// Também é a versão para PDF do painel (?pdf=1 abre a janela de impressão: "Salvar como PDF").
import { useEffect, useState } from "react";

interface Item { description: string; quantity: number; unitPrice: number }
interface PublicQuote {
  prospectName: string; service: string; segment: string; macro: string; objective: string; deliverables: string; notes: string;
  items: Item[]; subtotal: number; discountAmount: number; discountExplanation: string; total: number;
  captureDate: string; captureTime: string; validity: string; paymentMethods: string[]; paymentTerms: string;
  status: string; decidedAt: string; decisionName: string; createdAt: string; expired: boolean;
}

const money = (n: number) => (Number(n) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const brDate = (d?: string) => (d && /^\d{4}-\d{2}-\d{2}/.test(d) ? d.slice(0, 10).split("-").reverse().join("/") : "");
const PAY: Record<string, string> = { pix: "Pix", cartao: "Cartão", boleto: "Boleto", transferencia: "Transferência", dinheiro: "Dinheiro" };

export default function QuotePublic({ token }: { token: string }) {
  const [q, setQ] = useState<PublicQuote | null>(null);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch(`/api/orcamento?t=${encodeURIComponent(token)}`)
      .then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(body.error ?? "Orçamento não encontrado.");
        setQ(body);
        if (new URLSearchParams(window.location.search).get("pdf") === "1") setTimeout(() => window.print(), 600);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [token]);

  async function decide(decisao: "aprovar" | "recusar") {
    if (!name.trim()) return setMsg("Escreva o seu nome para registrar a resposta.");
    if (decisao === "recusar" && !window.confirm("Recusar este orçamento?")) return;
    setBusy(true);
    setMsg("");
    try {
      const r = await fetch("/api/orcamento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ t: token, decisao, nome: name, obs: note }),
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(body.error ?? "Não foi possível registrar.");
      setQ((cur) => (cur ? { ...cur, status: body.status, decidedAt: body.decidedAt, decisionName: name } : cur));
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (error) return <div className="mx-auto max-w-2xl rounded-lg bg-white p-8 text-center text-neutral-800">{error}</div>;
  if (!q) return <div className="mx-auto h-96 max-w-3xl animate-pulse rounded-lg bg-white/10" />;

  const answered = q.status === "aprovado" || q.status === "recusado";
  return (
    <article className="quote-sheet mx-auto max-w-3xl overflow-hidden rounded-lg bg-white text-neutral-900 shadow-2xl">
      <div className="quote-head flex flex-wrap items-end justify-between gap-4 bg-[#1C1C1C] px-8 py-7 text-white">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#c9c7ff]">Agência Humaniza · Orçamento</p>
          <h1 className="mt-1 text-3xl font-extrabold">{q.prospectName}</h1>
          <p className="text-sm text-white/70">{[q.service, q.segment].filter(Boolean).join(" · ")}</p>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wider text-white/60">Investimento</p>
          <p className="text-3xl font-extrabold text-[#a9a6ff]">{money(q.total)}</p>
        </div>
      </div>

      <div className="grid gap-6 px-8 py-7 text-[15px] leading-relaxed">
        <div className="grid gap-2 text-sm sm:grid-cols-3">
          {q.captureDate && <p><span className="text-neutral-500">Captação:</span> {brDate(q.captureDate)} {q.captureTime}</p>}
          {q.validity && <p><span className="text-neutral-500">Válido até:</span> {brDate(q.validity)}</p>}
          {q.createdAt && <p><span className="text-neutral-500">Emitido em:</span> {brDate(q.createdAt)}</p>}
        </div>

        {q.macro && <section><h2 className="mb-1 font-bold text-[#5B56FF]">Contexto</h2><p className="whitespace-pre-wrap">{q.macro}</p></section>}
        {q.objective && <section><h2 className="mb-1 font-bold text-[#5B56FF]">Objetivo</h2><p className="whitespace-pre-wrap">{q.objective}</p></section>}

        {q.items.length > 0 && (
          <section>
            <h2 className="mb-2 font-bold text-[#5B56FF]">Itens</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-300 text-left text-neutral-500">
                  <th className="py-2">Descrição</th><th className="py-2 text-right">Qtd.</th><th className="py-2 text-right">Valor un.</th><th className="py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {q.items.map((i, k) => (
                  <tr key={k} className="border-b border-neutral-200">
                    <td className="py-2 pr-2">{i.description}</td>
                    <td className="py-2 text-right">{i.quantity}</td>
                    <td className="py-2 text-right">{money(i.unitPrice)}</td>
                    <td className="py-2 text-right">{money(i.quantity * i.unitPrice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="ml-auto mt-3 grid max-w-xs gap-1 text-sm">
              <p className="flex justify-between"><span className="text-neutral-500">Subtotal</span><span>{money(q.subtotal)}</span></p>
              {q.subtotal - q.total > 0.004 && (
                <p className="flex justify-between text-emerald-700"><span>Desconto</span><span>− {money(q.subtotal - q.total)}</span></p>
              )}
              <p className="flex justify-between border-t border-neutral-300 pt-1 text-base font-extrabold"><span>Total</span><span>{money(q.total)}</span></p>
            </div>
            {q.discountExplanation && q.subtotal - q.total > 0.004 && <p className="mt-2 text-sm text-neutral-600">{q.discountExplanation}</p>}
          </section>
        )}

        {q.deliverables && <section><h2 className="mb-1 font-bold text-[#5B56FF]">Entregas</h2><p className="whitespace-pre-wrap">{q.deliverables}</p></section>}
        {(q.paymentMethods.length > 0 || q.paymentTerms) && (
          <section>
            <h2 className="mb-1 font-bold text-[#5B56FF]">Pagamento</h2>
            {q.paymentMethods.length > 0 && <p>Formas: {q.paymentMethods.map((m) => PAY[m] ?? m).join(", ")}</p>}
            {q.paymentTerms && <p className="whitespace-pre-wrap">{q.paymentTerms}</p>}
          </section>
        )}
        {q.notes && <section><h2 className="mb-1 font-bold text-[#5B56FF]">Observações</h2><p className="whitespace-pre-wrap">{q.notes}</p></section>}

        {answered ? (
          <p className={`rounded-lg p-4 text-center font-semibold ${q.status === "aprovado" ? "bg-emerald-50 text-emerald-800" : "bg-neutral-100 text-neutral-700"}`}>
            {q.status === "aprovado" ? "✓ Orçamento aprovado" : "Orçamento recusado"}
            {q.decisionName ? ` por ${q.decisionName}` : ""}
            {q.decidedAt ? ` em ${new Date(q.decidedAt).toLocaleString("pt-BR")}` : ""}.
          </p>
        ) : q.expired ? (
          <p className="no-print rounded-lg bg-amber-50 p-4 text-center text-amber-800">Este orçamento venceu em {brDate(q.validity)}. Fale com a Humaniza para receber um novo.</p>
        ) : (
          <section className="no-print grid gap-3 rounded-lg border border-neutral-200 bg-neutral-50 p-5">
            <h2 className="font-bold">Sua resposta</h2>
            <label className="text-sm">
              <span className="text-neutral-600">Seu nome</span>
              <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-md border border-neutral-300 bg-white p-2" />
            </label>
            <label className="text-sm">
              <span className="text-neutral-600">Observação (opcional)</span>
              <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} className="mt-1 w-full rounded-md border border-neutral-300 bg-white p-2" />
            </label>
            {msg && <p className="text-sm text-red-600">{msg}</p>}
            <div className="flex flex-wrap gap-2">
              <button disabled={busy} onClick={() => decide("aprovar")} className="rounded-md bg-[#5B56FF] px-5 py-2.5 font-semibold text-white disabled:opacity-60">
                {busy ? "Enviando…" : "Aprovar orçamento"}
              </button>
              <button disabled={busy} onClick={() => decide("recusar")} className="rounded-md border border-neutral-300 bg-white px-5 py-2.5 font-semibold text-neutral-700 disabled:opacity-60">
                Recusar
              </button>
            </div>
          </section>
        )}

        <div className="no-print flex justify-end">
          <button onClick={() => window.print()} className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-700">
            Baixar PDF
          </button>
        </div>
      </div>
      <div className="border-t border-neutral-200 px-8 py-4 text-xs text-neutral-500">Agência Humaniza · orçamento gerado pelo Humaniza OS</div>
    </article>
  );
}
