// Equipe, Lixeira e Orçamentos (arquivo do sistema antigo).
import { useState } from "react";
import { api, type Me, type Quote } from "./api";
import { Area, Button, Card, ErrorText, Field, Modal, Pill, Select, Skeleton, TYPE_SHORT, brDate, useLoad, useToast } from "./ui";

export function TeamPage({ go }: { go: (p: string) => void }) {
  const team = useLoad(api.team);
  const demands = useLoad(() => api.demands(), []);
  const clients = useLoad(api.clients);
  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="eyebrow">Pessoas</p><h1 className="text-2xl font-extrabold sm:text-3xl">Equipe</h1></div>
        <Button variant="ghost" onClick={() => go("acessos")}>Liberar novo acesso</Button>
      </div>
      <ErrorText>{team.error}</ErrorText>
      {!team.data && <Skeleton />}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {team.data?.map((t) => {
          const mine = (demands.data ?? []).filter((d) => d.assignees.includes(t.email));
          const open = mine.filter((d) => d.column !== "Concluído");
          const late = open.filter((d) => d.dueDate && d.dueDate < new Date().toISOString().slice(0, 10));
          const serves = (clients.data ?? []).filter((c) => (c.teamEmails ?? []).includes(t.email));
          return (
            <Card key={t._id}>
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-lg font-bold text-white">{t.name.slice(0, 2).toUpperCase()}</span>
                <div><h2 className="font-bold">{t.name}</h2><p className="text-xs text-muted-foreground">{t.jobTitle || (t.role === "admin" ? "Administrador" : "Equipe")} · {t.email}</p></div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-control bg-secondary p-2"><b className="text-xl">{open.length}</b><p className="text-[11px] text-muted-foreground">abertas</p></div>
                <div className="rounded-control bg-secondary p-2"><b className={`text-xl ${late.length ? "text-red-300" : ""}`}>{late.length}</b><p className="text-[11px] text-muted-foreground">atrasadas</p></div>
                <div className="rounded-control bg-secondary p-2"><b className="text-xl">{serves.length}</b><p className="text-[11px] text-muted-foreground">clientes</p></div>
              </div>
              {open.length > 0 && (
                <ul className="mt-3 grid gap-1 text-sm">
                  {open.slice(0, 4).map((d) => <li key={d._id} className="flex justify-between gap-2"><span className="truncate">{d.title}</span><span className="text-xs text-muted-foreground">{d.column}</span></li>)}
                </ul>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export function TrashPage({ me }: { me: Me }) {
  const contents = useLoad(() => api.contents({ trash: true }), []);
  const demands = useLoad(() => api.demands(true), []);
  const [toast, say] = useToast();
  const act = async (fn: () => Promise<unknown>, msg: string) => { await fn(); contents.reload(); demands.reload(); say(msg); };
  return (
    <div className="grid gap-6">
      <div><p className="eyebrow">Recuperação</p><h1 className="text-2xl font-extrabold sm:text-3xl">Lixeira</h1>
        <p className="text-sm text-muted-foreground">Nada é apagado de verdade até alguém escolher “Apagar de vez”{me.role !== "admin" && " (só o administrador pode)"}.</p></div>
      <Card>
        <h2 className="text-lg font-bold">Roteiros e conteúdos</h2>
        {contents.data?.length === 0 && <p className="mt-2 text-sm text-muted-foreground">Vazio.</p>}
        <ul className="mt-3 grid gap-2">
          {contents.data?.map((c) => (
            <li key={c._id} className="flex flex-wrap items-center gap-2 rounded-control border border-border p-3 text-sm">
              <span className="flex-1"><b>{c.title || "Sem tema"}</b> <span className="text-muted-foreground">· {TYPE_SHORT[c.type]} · {c.clientName}</span></span>
              <span className="text-xs text-muted-foreground">apagado em {brDate(c.trashedAt)}</span>
              <Button small variant="ghost" onClick={() => act(() => api.trashContent(c._id, "restore"), "Restaurado.")}>Restaurar</Button>
              {me.role === "admin" && <Button small variant="danger" onClick={() => window.confirm("Apagar de vez? Não dá para desfazer.") && act(() => api.trashContent(c._id, "forever"), "Apagado de vez.")}>Apagar de vez</Button>}
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <h2 className="text-lg font-bold">Demandas</h2>
        {demands.data?.length === 0 && <p className="mt-2 text-sm text-muted-foreground">Vazio.</p>}
        <ul className="mt-3 grid gap-2">
          {demands.data?.map((d) => (
            <li key={d._id} className="flex flex-wrap items-center gap-2 rounded-control border border-border p-3 text-sm">
              <span className="flex-1"><b>{d.title}</b> <span className="text-muted-foreground">· {d.clientName || "Interno"}</span></span>
              <Button small variant="ghost" onClick={() => act(() => api.trashDemand(d._id, "restore"), "Restaurada.")}>Restaurar</Button>
              {me.role === "admin" && <Button small variant="danger" onClick={() => window.confirm("Apagar de vez? Não dá para desfazer.") && act(() => api.trashDemand(d._id, "forever"), "Apagada de vez.")}>Apagar de vez</Button>}
            </li>
          ))}
        </ul>
      </Card>
      {toast}
    </div>
  );
}

const money = (n: unknown) => (Number(n) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const STATUS_LABEL: Record<Quote["status"], string> = { rascunho: "Rascunho", enviado: "Enviado", aprovado: "Aprovado", recusado: "Recusado" };
const PAYMENT_LABEL: Record<string, string> = { pix: "Pix", cartao: "Cartão", boleto: "Boleto", transferencia: "Transferência", dinheiro: "Dinheiro" };
const publicLink = (q: Pick<Quote, "publicToken">) => `${window.location.origin}/orcamento/${q.publicToken}`;

type Draft = Omit<Quote, "_id" | "publicToken" | "subtotal" | "discountAmount" | "total"> & { _id?: string };
const EMPTY: Draft = {
  prospectName: "", clientId: "", email: "", whatsapp: "", service: "", segment: "", macro: "", objective: "", deliverables: "", notes: "",
  items: [{ description: "", quantity: 1, unitPrice: 0 }], discountType: "valor", discountValue: 0, discountExplanation: "",
  manualFinalEnabled: false, manualFinal: 0, captureDate: "", captureTime: "", validity: "", paymentMethods: ["pix"], paymentTerms: "", status: "rascunho",
};

/** Mesma conta do servidor, só para mostrar enquanto edita (o servidor recalcula ao salvar). */
function calc(d: Pick<Draft, "items" | "discountType" | "discountValue" | "manualFinalEnabled" | "manualFinal">) {
  const subtotal = d.items.reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0), 0);
  const discount = Math.min(subtotal, d.discountType === "percentual" ? (subtotal * (Number(d.discountValue) || 0)) / 100 : Number(d.discountValue) || 0);
  return { subtotal, discount, total: d.manualFinalEnabled ? Number(d.manualFinal) || 0 : subtotal - discount };
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    window.prompt("Copie o link:", text);
    return false;
  }
}

function QuoteEditor({ initial, clients, onClose, onSaved }: { initial: Draft; clients: { _id: string; name: string }[]; onClose: () => void; onSaved: (msg: string) => void }) {
  const [d, setD] = useState<Draft>(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((cur) => ({ ...cur, [k]: v }));
  const setItem = (i: number, patch: Partial<Draft["items"][number]>) =>
    setD((cur) => ({ ...cur, items: cur.items.map((it, k) => (k === i ? { ...it, ...patch } : it)) }));
  const t = calc(d);

  async function save() {
    setBusy(true);
    setErr("");
    try {
      const { _id, ...data } = d;
      if (_id) await api.updateQuote(_id, data);
      else await api.createQuote(data);
      onSaved(_id ? "Orçamento salvo." : "Orçamento criado.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal wide title={d._id ? `Editar orçamento · ${initial.prospectName}` : "Novo orçamento"} onClose={onClose}>
      <div className="grid gap-5">
        <section className="grid gap-3 sm:grid-cols-2">
          <Field label="Cliente / responsável" value={d.prospectName} onChange={(v) => set("prospectName", v)} required />
          <Select label="Vincular a um cliente do sistema (opcional)" value={d.clientId} onChange={(v) => set("clientId", v)}
            options={[{ value: "", label: "Nenhum (cliente novo)" }, ...clients.map((c) => ({ value: c._id, label: c.name }))]} />
          <Field label="WhatsApp" value={d.whatsapp} onChange={(v) => set("whatsapp", v)} />
          <Field label="E-mail" type="email" value={d.email} onChange={(v) => set("email", v)} />
          <Field label="Serviço (ex.: Vídeo + Foto)" value={d.service} onChange={(v) => set("service", v)} />
          <Field label="Segmento (ex.: Nutrição)" value={d.segment} onChange={(v) => set("segment", v)} />
        </section>

        <section className="grid gap-3">
          <Area label="Contexto" value={d.macro} onChange={(v) => set("macro", v)} />
          <Area label="Objetivo" value={d.objective} onChange={(v) => set("objective", v)} />
        </section>

        <section className="grid gap-2">
          <h3 className="font-bold">Itens</h3>
          {d.items.map((it, i) => (
            <div key={i} className="grid grid-cols-[1fr_70px_110px_auto] items-end gap-2">
              <Field label={i === 0 ? "Descrição" : ""} value={it.description} onChange={(v) => setItem(i, { description: v })} />
              <Field label={i === 0 ? "Qtd." : ""} type="number" value={String(it.quantity)} onChange={(v) => setItem(i, { quantity: Number(v) })} />
              <Field label={i === 0 ? "Valor un. (R$)" : ""} type="number" value={String(it.unitPrice)} onChange={(v) => setItem(i, { unitPrice: Number(v) })} />
              <button type="button" onClick={() => set("items", d.items.filter((_, k) => k !== i))} className="mb-2 px-2 text-lg text-muted-foreground hover:text-red-300" aria-label="Remover item">×</button>
            </div>
          ))}
          <div><Button small variant="ghost" onClick={() => set("items", [...d.items, { description: "", quantity: 1, unitPrice: 0 }])}>+ Adicionar item</Button></div>
        </section>

        <section className="grid gap-3 rounded-lg border border-border p-4 sm:grid-cols-3">
          <Select label="Desconto em" value={d.discountType} onChange={(v) => set("discountType", v as Draft["discountType"])}
            options={[{ value: "valor", label: "Reais (R$)" }, { value: "percentual", label: "Porcentagem (%)" }]} />
          <Field label={d.discountType === "percentual" ? "Desconto (%)" : "Desconto (R$)"} type="number" value={String(d.discountValue)} onChange={(v) => set("discountValue", Number(v))} />
          <label className="flex items-center gap-2 self-end pb-2 text-sm">
            <input type="checkbox" checked={d.manualFinalEnabled} onChange={(e) => set("manualFinalEnabled", e.target.checked)} />
            Definir o valor final à mão
          </label>
          {d.manualFinalEnabled && <Field label="Valor final (R$)" type="number" value={String(d.manualFinal)} onChange={(v) => set("manualFinal", Number(v))} />}
          <div className="sm:col-span-3"><Area label="Explicação do desconto (aparece para o cliente)" rows={2} value={d.discountExplanation} onChange={(v) => set("discountExplanation", v)} /></div>
          <div className="grid gap-1 text-sm sm:col-span-3 sm:justify-self-end sm:text-right">
            <p><span className="text-muted-foreground">Subtotal:</span> {money(t.subtotal)}</p>
            {t.subtotal - t.total > 0.004 && <p><span className="text-muted-foreground">Desconto:</span> − {money(t.subtotal - t.total)}</p>}
            <p className="text-xl font-extrabold">Total: {money(t.total)}</p>
          </div>
        </section>

        <section className="grid gap-3">
          <Area label="Entregas" rows={4} value={d.deliverables} onChange={(v) => set("deliverables", v)} />
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Data da captação" type="date" value={d.captureDate} onChange={(v) => set("captureDate", v)} />
            <Field label="Horário" type="time" value={d.captureTime} onChange={(v) => set("captureTime", v)} />
            <Field label="Válido até" type="date" value={d.validity} onChange={(v) => set("validity", v)} />
          </div>
          <div className="text-sm">
            <span className="text-muted-foreground">Formas de pagamento</span>
            <div className="mt-1 flex flex-wrap gap-3">
              {Object.entries(PAYMENT_LABEL).map(([k, label]) => (
                <label key={k} className="flex items-center gap-1.5">
                  <input type="checkbox" checked={d.paymentMethods.includes(k)}
                    onChange={(e) => set("paymentMethods", e.target.checked ? [...d.paymentMethods, k] : d.paymentMethods.filter((m) => m !== k))} />
                  {label}
                </label>
              ))}
            </div>
          </div>
          <Area label="Condições de pagamento (ex.: 50% na aprovação e 50% na entrega)" rows={2} value={d.paymentTerms} onChange={(v) => set("paymentTerms", v)} />
          <Area label="Observações (aparecem para o cliente)" rows={2} value={d.notes} onChange={(v) => set("notes", v)} />
          <Select label="Status" value={d.status} onChange={(v) => set("status", v as Draft["status"])}
            options={Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label }))} />
        </section>

        <ErrorText>{err}</ErrorText>
        <div className="flex flex-wrap gap-2">
          <Button onClick={save} disabled={busy}>{busy ? "Salvando…" : "Salvar orçamento"}</Button>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        </div>
      </div>
    </Modal>
  );
}

export function QuotesPage() {
  const quotes = useLoad(api.quotes);
  const legacy = useLoad(() => api.archive("quotes"), []);
  const briefs = useLoad(() => api.archive("projectBriefings"), []);
  const clients = useLoad(api.clients);
  const [editing, setEditing] = useState<Draft | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [filter, setFilter] = useState<"todos" | Quote["status"]>("todos");
  const [toast, say] = useToast();

  const reload = () => quotes.reload();
  const run = async (fn: () => Promise<unknown>, msg: string) => {
    try {
      await fn();
      reload();
      say(msg);
    } catch (e) {
      say(e instanceof Error ? e.message : String(e));
    }
  };
  async function sendLink(q: Quote) {
    await copyText(publicLink(q));
    if (q.status === "rascunho") await api.updateQuote(q._id, { status: "enviado" }).catch(() => undefined);
    reload();
    say("Link de aprovação copiado. Cole no WhatsApp ou e-mail do cliente.");
  }
  async function duplicate(body: { copyFrom: string } | { copyFromLegacy: string }) {
    try {
      const { _id } = await api.createQuote(body);
      const full = (await api.quotes()).find((q) => q._id === _id);
      reload();
      if (full) setEditing(full);
      say("Cópia criada. Ajuste e salve.");
    } catch (e) {
      say(e instanceof Error ? e.message : String(e));
    }
  }

  const list = (quotes.data ?? []).filter((q) => filter === "todos" || q.status === filter);
  const approvedSum = (quotes.data ?? []).filter((q) => q.status === "aprovado").reduce((s, q) => s + (q.total || 0), 0);

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="eyebrow">Comercial</p><h1 className="text-2xl font-extrabold sm:text-3xl">Orçamentos</h1>
          <p className="text-sm text-muted-foreground">Crie, duplique e envie o link para o cliente aprovar. Todos ficam salvos aqui.</p></div>
        <Button onClick={() => setEditing({ ...EMPTY, items: [{ description: "", quantity: 1, unitPrice: 0 }] })}>+ Novo orçamento</Button>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        {(["todos", "rascunho", "enviado", "aprovado", "recusado"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`rounded-full border px-3 py-1 ${filter === f ? "border-primary bg-primary/20" : "border-border"}`}>
            {f === "todos" ? "Todos" : STATUS_LABEL[f]} {f !== "todos" && `(${(quotes.data ?? []).filter((q) => q.status === f).length})`}
          </button>
        ))}
        {approvedSum > 0 && <span className="ml-auto text-muted-foreground">Aprovados: <b className="text-foreground">{money(approvedSum)}</b></span>}
      </div>

      <ErrorText>{quotes.error}</ErrorText>
      {!quotes.data && <Skeleton />}
      {quotes.data && list.length === 0 && <p className="text-muted-foreground">Nenhum orçamento {filter !== "todos" ? `com status “${STATUS_LABEL[filter]}”` : "criado ainda"}.</p>}
      {list.map((q) => (
        <Card key={q._id}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div><h2 className="text-xl font-bold">{q.prospectName}</h2><p className="text-sm text-muted-foreground">{[q.service, q.segment].filter(Boolean).join(" · ") || "Sem serviço"}</p></div>
            <div className="text-right"><p className="text-2xl font-extrabold">{money(q.total)}</p><Pill>{STATUS_LABEL[q.status] ?? q.status}</Pill></div>
          </div>
          <div className="mt-3 grid gap-2 text-sm md:grid-cols-3">
            <p><span className="text-muted-foreground">Captação:</span> {q.captureDate ? `${brDate(q.captureDate)} ${q.captureTime}` : "a combinar"}</p>
            <p><span className="text-muted-foreground">Validade:</span> {q.validity ? brDate(q.validity) : "—"}</p>
            <p><span className="text-muted-foreground">Subtotal:</span> {money(q.subtotal)} {q.subtotal - q.total > 0.004 ? `(desconto ${money(q.subtotal - q.total)})` : ""}</p>
          </div>
          {q.decidedAt && (
            <p className="mt-2 text-sm">{q.status === "aprovado" ? "✓ Aprovado" : "Recusado"} por <b>{q.decisionName}</b> em {new Date(q.decidedAt).toLocaleString("pt-BR")}{q.decisionNote ? ` · “${q.decisionNote}”` : ""}</p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button small onClick={() => sendLink(q)}>Copiar link de aprovação</Button>
            <Button small variant="ghost" onClick={() => window.open(`/orcamento/${q.publicToken}?pdf=1`, "_blank")}>Baixar PDF</Button>
            <Button small variant="ghost" onClick={() => window.open(`/orcamento/${q.publicToken}`, "_blank")}>Ver como o cliente</Button>
            <Button small variant="ghost" onClick={() => setEditing({ ...q })}>Editar</Button>
            <Button small variant="ghost" onClick={() => duplicate({ copyFrom: q._id })}>Duplicar</Button>
            {q.status !== "aprovado" && <Button small variant="green" onClick={() => run(() => api.updateQuote(q._id, { status: "aprovado" }), "Marcado como aprovado.")}>Marcar aprovado</Button>}
            <Button small variant="danger" onClick={() => window.confirm(`Apagar o orçamento de ${q.prospectName}?`) && run(() => api.deleteQuote(q._id), "Orçamento apagado.")}>Apagar</Button>
          </div>
        </Card>
      ))}

      {(legacy.data?.length ?? 0) > 0 && (
        <div className="grid gap-4">
          <div><h2 className="text-lg font-bold">Do sistema antigo</h2><p className="text-sm text-muted-foreground">Ficam guardados como estavam. Use “Usar como modelo” para criar um novo a partir deles.</p></div>
          {legacy.data?.map((r) => {
            const q = r.data;
            return (
              <Card key={r._id}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div><h2 className="text-xl font-bold">{q.prospectName || "Sem nome"}</h2><p className="text-sm text-muted-foreground">{q.service} · {q.segment}</p></div>
                  <div className="text-right"><p className="text-2xl font-extrabold">{money(q.manualFinalEnabled ? q.manualFinal : q.total)}</p>
                    <Pill>{q.status === "approved" ? "Aprovado" : q.status === "declined" ? "Recusado" : "Enviado"}</Pill></div>
                </div>
                <div className="mt-3 grid gap-2 text-sm md:grid-cols-3">
                  <p><span className="text-muted-foreground">Captação:</span> {brDate(q.captureDate)} {q.captureTime}</p>
                  <p><span className="text-muted-foreground">Validade:</span> {brDate(q.validity)}</p>
                  <p><span className="text-muted-foreground">Subtotal:</span> {money(q.subtotal)} {q.discountAmount ? `(desconto ${money(q.discountAmount)})` : ""}</p>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <Button small variant="ghost" onClick={() => duplicate({ copyFromLegacy: r._id })}>Usar como modelo</Button>
                  <button className="text-sm text-[#c9c7ff] underline" onClick={() => setOpen(open === r._id ? null : r._id)}>{open === r._id ? "Esconder detalhes" : "Ver detalhes"}</button>
                </div>
                {open === r._id && (
                  <div className="mt-3 grid gap-3 text-sm">
                    {q.macro && <p><b>Contexto:</b> {q.macro}</p>}
                    {q.objective && <p><b>Objetivo:</b> {q.objective}</p>}
                    {q.deliverables && <p className="whitespace-pre-wrap"><b>Entregas:</b> {q.deliverables}</p>}
                    {q.discountExplanation && <p><b>Desconto:</b> {q.discountExplanation}</p>}
                    {q.notes && <p><b>Observações:</b> {q.notes}</p>}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
      {(briefs.data?.length ?? 0) > 0 && (
        <Card>
          <h2 className="text-lg font-bold">Briefings de projeto</h2>
          {briefs.data?.map((b) => <p key={b._id} className="mt-2 whitespace-pre-wrap text-sm"><b>{b.data.clientName}</b>{"\n"}{b.data.briefingText}</p>)}
        </Card>
      )}

      {editing && (
        <QuoteEditor initial={editing} clients={clients.data ?? []} onClose={() => setEditing(null)}
          onSaved={(msg) => { setEditing(null); reload(); say(msg); }} />
      )}
      {toast}
    </div>
  );
}
