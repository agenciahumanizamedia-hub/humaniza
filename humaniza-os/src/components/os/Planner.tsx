// Aba "Datas e campanhas" do cliente: datas importantes e campanhas comerciais dos próximos meses,
// em linha do tempo por mês, com sugestões do calendário comercial e do segmento do cliente.
import { useState } from "react";
import { api, type Client, type Me, type PlannerItem, type Suggestion } from "./api";
import { Area, Button, Card, ErrorText, Field, Modal, Pill, Select, Skeleton, brDate, monthLabel, useLoad, useToast } from "./ui";

const KINDS = ["Data importante", "Campanha comercial", "Lançamento", "Evento", "Sazonal"];
const STATUS = ["Ideia", "Planejada", "Em produção", "No ar", "Concluída"];
const KIND_ICON: Record<string, string> = { "Data importante": "📌", "Campanha comercial": "💰", Lançamento: "🚀", Evento: "🎉", Sazonal: "🍂" };
const daysUntil = (d: string) => Math.round((new Date(d + "T12:00").getTime() - Date.now()) / 86400e3);

export function PlannerTab({ me, client }: { me: Me; client: Client }) {
  const staff = me.role !== "client";
  const { data, error, reload } = useLoad(() => api.planner(client._id), [client._id]);
  const [edit, setEdit] = useState<PlannerItem | Partial<PlannerItem> | null>(null);
  const [showPast, setShowPast] = useState(false);
  const [toast, say] = useToast();
  if (error) return <ErrorText>{error}</ErrorText>;
  if (!data) return <Skeleton rows={2} />;
  const today = new Date().toISOString().slice(0, 10);
  const items = data.items.filter((i) => showPast || (i.endDate || i.date) >= today);
  const months = [...new Set(items.map((i) => i.date.slice(0, 7)))].sort();
  const soon = data.items.filter((i) => i.date >= today && daysUntil(i.date) <= 30);

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="eyebrow">Planejamento</p><h2 className="text-xl font-bold">Datas importantes e campanhas</h2>
          <p className="text-sm text-muted-foreground">Tudo o que não pode ser esquecido nos próximos meses.</p></div>
        <div className="flex flex-wrap gap-2">
          <label className="flex items-center gap-2 text-sm text-muted-foreground"><input type="checkbox" checked={showPast} onChange={(e) => setShowPast(e.target.checked)} />Mostrar passadas</label>
          {staff && <Button onClick={() => setEdit({ kind: "Campanha comercial", status: "Ideia", visibleToClient: true, date: today })}>+ Data ou campanha</Button>}
        </div>
      </div>

      {soon.length > 0 && (
        <Card className="border-primary/40">
          <p className="eyebrow">⏳ Nos próximos 30 dias</p>
          <div className="mt-3 flex gap-3 overflow-x-auto pb-1">
            {soon.map((i) => (
              <div key={i._id} className="min-w-52 rounded-control border border-border bg-secondary p-3">
                <p className="text-2xl font-extrabold">{daysUntil(i.date) === 0 ? "Hoje" : `${daysUntil(i.date)} dias`}</p>
                <p className="font-semibold">{KIND_ICON[i.kind] ?? "📌"} {i.title}</p>
                <p className="text-xs text-muted-foreground">{brDate(i.date)} · {i.status}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="grid content-start gap-5">
          {months.length === 0 && <Card><p className="text-sm text-muted-foreground">{staff ? "Nada planejado ainda. Use as sugestões ao lado para começar." : "A agência ainda vai preencher as próximas datas e campanhas."}</p></Card>}
          {months.map((m) => (
            <div key={m}>
              <h3 className="mb-2 text-lg font-extrabold capitalize">{monthLabel(m)}</h3>
              <ol className="grid gap-2 border-l-2 border-primary/50 pl-4">
                {items.filter((i) => i.date.startsWith(m)).map((i) => (
                  <li key={i._id} className="relative">
                    <span className="absolute -left-[23px] top-4 h-3 w-3 rounded-full border-2 border-card bg-primary" />
                    <button disabled={!staff} onClick={() => setEdit(i)} className="w-full rounded-control border border-border bg-card p-3 text-left transition enabled:hover:border-primary/60">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-bold">{KIND_ICON[i.kind] ?? "📌"} {i.title}</p>
                        <div className="flex flex-wrap gap-1.5"><Pill>{i.kind}</Pill><Pill>{i.status}</Pill>{staff && !i.visibleToClient && <Pill>Só equipe</Pill>}</div>
                      </div>
                      <p className="text-sm text-muted-foreground">{brDate(i.date)}{i.endDate ? ` até ${brDate(i.endDate)}` : ""}{staff && i.budget ? ` · verba ${i.budget}` : ""}{staff && i.channels?.length ? ` · ${i.channels.join(", ")}` : ""}</p>
                      {i.description && <p className="mt-1 whitespace-pre-wrap text-sm">{i.description}</p>}
                      {staff && i.internalNote && <p className="mt-1 text-xs text-muted-foreground">Interno: {i.internalNote}</p>}
                    </button>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
        {staff && (
          <Card className="h-fit">
            <p className="eyebrow">✨ Sugestões para {client.name}</p>
            <p className="mt-1 text-xs text-muted-foreground">Calendário comercial dos próximos meses, filtrado pelo segmento do cliente.</p>
            <ul className="mt-3 grid gap-2">
              {data.suggestions.slice(0, 14).map((s) => <SuggestionRow key={s.date + s.title} s={s} onAdd={() => setEdit({ title: s.title, date: s.date, kind: s.kind === "campanha" ? "Campanha comercial" : "Data importante", status: "Ideia", description: s.tip, visibleToClient: true })} />)}
              {data.suggestions.length === 0 && <li className="text-sm text-muted-foreground">Todas as sugestões já foram usadas.</li>}
            </ul>
          </Card>
        )}
      </div>
      {edit && <PlannerModal client={client} item={edit} onClose={() => setEdit(null)} onDone={(m) => { setEdit(null); reload(); say(m); }} />}
      {toast}
    </div>
  );
}

function SuggestionRow({ s, onAdd }: { s: Suggestion; onAdd: () => void }) {
  return (
    <li className="rounded-control border border-border p-2.5 text-sm">
      <div className="flex items-start justify-between gap-2">
        <div><p className="font-semibold">{s.kind === "campanha" ? "💰" : "📌"} {s.title}</p><p className="text-xs text-muted-foreground">{brDate(s.date)} · em {daysUntil(s.date)} dias</p></div>
        <button onClick={onAdd} className="shrink-0 rounded-control bg-primary/15 px-2 py-1 text-xs font-semibold text-[#c9c7ff] hover:bg-primary/25">+ Adicionar</button>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{s.tip}</p>
    </li>
  );
}

function PlannerModal({ client, item, onClose, onDone }: { client: Client; item: Partial<PlannerItem>; onClose: () => void; onDone: (m: string) => void }) {
  const [f, setF] = useState({
    title: item.title ?? "", date: item.date ?? "", endDate: item.endDate ?? "", kind: item.kind ?? KINDS[1], status: item.status ?? STATUS[0],
    description: item.description ?? "", internalNote: item.internalNote ?? "", budget: item.budget ?? "", channels: (item.channels ?? []).join(", "), visibleToClient: item.visibleToClient !== false,
  });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (v: any) => setF({ ...f, [k]: v });
  const body = { ...f, channels: f.channels.split(",").map((c) => c.trim()).filter(Boolean) };
  return (
    <Modal title={item._id ? "Editar data/campanha" : "Nova data/campanha"} onClose={onClose}>
      <div className="grid gap-3">
        <Field label="Título" value={f.title} onChange={set("title")} required />
        <div className="grid grid-cols-2 gap-2">
          <Field label="Data" type="date" value={f.date} onChange={set("date")} />
          <Field label="Até (opcional)" type="date" value={f.endDate} onChange={set("endDate")} />
          <Select label="Tipo" value={f.kind} onChange={set("kind")} options={KINDS} />
          <Select label="Situação" value={f.status} onChange={set("status")} options={STATUS} />
        </div>
        <Area label="Ideia / descrição (o cliente vê)" value={f.description} onChange={set("description")} rows={3} />
        <div className="grid grid-cols-2 gap-2">
          <Field label="Verba prevista" value={f.budget} onChange={set("budget")} placeholder="R$ 500" />
          <Field label="Canais" value={f.channels} onChange={set("channels")} placeholder="Instagram, anúncios, WhatsApp" />
        </div>
        <Area label="Observação interna" value={f.internalNote} onChange={set("internalNote")} rows={2} />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.visibleToClient} onChange={(e) => set("visibleToClient")(e.target.checked)} />Mostrar para o cliente</label>
        <ErrorText>{err}</ErrorText>
        <div className="flex flex-wrap justify-between gap-2">
          {item._id ? <Button variant="danger" onClick={async () => { await api.deletePlanner(item._id!); onDone("Removido."); }}>Remover</Button> : <span />}
          <div className="flex gap-2"><Button variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button disabled={busy || !f.title || !f.date} onClick={async () => {
              setBusy(true); setErr("");
              try { if (item._id) await api.updatePlanner(item._id, body); else await api.addPlanner(client._id, body); onDone("Salvo."); } catch (x) { setErr(x instanceof Error ? x.message : String(x)); setBusy(false); }
            }}>{busy ? "Salvando…" : "Salvar"}</Button></div>
        </div>
      </div>
    </Modal>
  );
}
