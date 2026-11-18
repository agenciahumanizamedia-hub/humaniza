// Calendário de conteúdo: mês em grade com as postagens (dos projetos) e os compromissos
// (captações, reuniões). Pode ser geral (agência) ou de um cliente.
import { useMemo, useState } from "react";
import { api, type CalEvent, type Content, type Me } from "./api";
import { Area, Button, Card, ErrorText, Field, Modal, Pill, Select, TYPE_SHORT, brDate, monthLabel, shiftMonth, thisMonth, useLoad, useToast } from "./ui";

const WEEK = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const COLORS: Record<string, string> = { roteiro: "#5B56FF", carrossel: "#9B6BFF", estatico: "#3BA7FF" };

export function MonthCalendar({ me, clientId, go }: { me: Me; clientId?: string; go: (p: string) => void }) {
  const [month, setMonth] = useState(thisMonth());
  const [filter, setFilter] = useState(clientId ?? "");
  const [type, setType] = useState("Todos");
  const contents = useLoad(() => api.contents({ month, clientId: filter || undefined }), [month, filter]);
  const events = useLoad(() => api.events(month), [month]);
  const clients = useLoad(api.clients);
  const [adding, setAdding] = useState<string | null>(null);
  const [toast, say] = useToast();
  const days = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    const first = new Date(y, m - 1, 1).getDay();
    const total = new Date(y, m, 0).getDate();
    return [...Array(first).fill(null), ...Array.from({ length: total }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`)];
  }, [month]);
  const byDay = (d: string) => ({
    posts: (contents.data ?? []).filter((c) => c.postDate === d && (type === "Todos" || c.type === type)),
    evs: (events.data ?? []).filter((e) => e.date === d && (!filter || e.clientId === filter)),
  });
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button small variant="ghost" onClick={() => setMonth(shiftMonth(month, -1))}>←</Button>
          <h2 className="min-w-48 text-center text-2xl font-extrabold capitalize">{monthLabel(month)}</h2>
          <Button small variant="ghost" onClick={() => setMonth(shiftMonth(month, 1))}>→</Button>
          <Button small variant="ghost" onClick={() => setMonth(thisMonth())}>Hoje</Button>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          {!clientId && <Select label="Cliente" value={filter} onChange={setFilter} options={[{ value: "", label: "Todos" }, ...(clients.data ?? []).map((c) => ({ value: c._id, label: c.name }))]} />}
          <Select label="Formato" value={type} onChange={setType} options={[{ value: "Todos", label: "Todos" }, { value: "roteiro", label: "Reels" }, { value: "carrossel", label: "Carrossel" }, { value: "estatico", label: "Estático" }]} />
          {me.role !== "client" && <Button onClick={() => setAdding(today.startsWith(month) ? today : `${month}-01`)}>+ Compromisso</Button>}
        </div>
      </div>
      <ErrorText>{contents.error || events.error}</ErrorText>
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        {Object.entries(COLORS).map(([k, c]) => <span key={k} className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-full" style={{ background: c }} />{TYPE_SHORT[k]}</span>)}
        <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-full bg-amber-400" />Captação / compromisso</span>
      </div>
      <div className="overflow-x-auto">
        <div className="grid min-w-[760px] grid-cols-7 gap-px overflow-hidden rounded-lg border border-border bg-border">
          {WEEK.map((w) => <div key={w} className="bg-secondary p-2 text-center text-xs font-semibold text-muted-foreground">{w}</div>)}
          {days.map((d, i) => {
            if (!d) return <div key={`e${i}`} className="min-h-28 bg-card/50" />;
            const { posts, evs } = byDay(d);
            return (
              <div key={d} className={`min-h-28 bg-card p-1.5 ${d === today ? "ring-2 ring-inset ring-primary" : ""}`}
                onDoubleClick={() => me.role !== "client" && setAdding(d)}>
                <p className={`mb-1 text-xs font-bold ${d === today ? "text-[#c9c7ff]" : "text-muted-foreground"}`}>{Number(d.slice(8))}</p>
                <div className="grid gap-1">
                  {evs.map((e) => <EventChip key={e._id} e={e} me={me} onDeleted={() => { events.reload(); say("Compromisso removido."); }} />)}
                  {posts.map((c) => <PostChip key={c._id} c={c} showClient={!filter} onOpen={() => go(`projeto/${c.projectId}`)} />)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">As postagens vêm da data de postagem de cada roteiro. {me.role !== "client" && "Clique duas vezes num dia para agendar um compromisso."}</p>
      {adding && <NewEvent date={adding} clientId={filter} clients={clients.data ?? []} onClose={() => setAdding(null)} onDone={() => { setAdding(null); events.reload(); say("Compromisso agendado."); }} />}
      {toast}
    </div>
  );
}

function PostChip({ c, showClient, onOpen }: { c: Content; showClient: boolean; onOpen: () => void }) {
  return (
    <button onClick={onOpen} title={`${TYPE_SHORT[c.type]} · ${c.title}`} className="rounded px-1.5 py-1 text-left text-[11px] leading-tight text-white hover:brightness-110"
      style={{ background: COLORS[c.type] ?? "#5B56FF", opacity: c.status === "Postado" ? 0.6 : 1 }}>
      <span className="line-clamp-2 font-semibold">{c.clientApproval === "Aprovado" ? "✓ " : c.clientApproval === "Ajustes" ? "⚠ " : ""}{c.title || TYPE_SHORT[c.type]}</span>
      {showClient && c.clientName && <span className="block truncate opacity-80">{c.clientName}</span>}
    </button>
  );
}

function EventChip({ e, me, onDeleted }: { e: CalEvent; me: Me; onDeleted: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className="rounded bg-amber-400 px-1.5 py-1 text-left text-[11px] font-semibold leading-tight text-black">
        <span className="line-clamp-2">{e.startTime ? `${e.startTime} ` : ""}{e.title}</span>
      </button>
      {open && (
        <Modal title={e.title} onClose={() => setOpen(false)}>
          <div className="grid gap-2 text-sm">
            <p><b>{brDate(e.date)}</b> {e.startTime && `· ${e.startTime}${e.endTime ? `–${e.endTime}` : ""}`}</p>
            <div className="flex flex-wrap gap-2"><Pill>{e.format || "Compromisso"}</Pill><Pill>{e.status || "Agendado"}</Pill>{e.visibleToClient && <Pill>Visível ao cliente</Pill>}</div>
            {e.clientName && <p>Cliente: {e.clientName}</p>}
            {e.location && <p>Local: {e.location}</p>}
            {e.responsibleName && <p>Responsável: {e.responsibleName}</p>}
            {e.teamNote && <p className="whitespace-pre-wrap rounded-control bg-secondary p-2 text-muted-foreground">{e.teamNote}</p>}
            {me.role !== "client" && <div className="mt-2 flex justify-end"><Button variant="danger" small onClick={async () => { await api.deleteEvent(e._id); setOpen(false); onDeleted(); }}>Remover compromisso</Button></div>}
          </div>
        </Modal>
      )}
    </>
  );
}

function NewEvent({ date, clientId, clients, onClose, onDone }: { date: string; clientId: string; clients: { _id: string; name: string }[]; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ title: "", date, startTime: "", endTime: "", format: "Captação", clientId, location: "", teamNote: "", visibleToClient: false });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Modal title="Novo compromisso" onClose={onClose}>
      <div className="grid gap-3">
        <Field label="Título" value={f.title} onChange={(v) => setF({ ...f, title: v })} placeholder="Ex.: Captação clínica" required />
        <div className="grid grid-cols-3 gap-2">
          <Field label="Data" type="date" value={f.date} onChange={(v) => setF({ ...f, date: v })} />
          <Field label="Início" type="time" value={f.startTime} onChange={(v) => setF({ ...f, startTime: v })} />
          <Field label="Fim" type="time" value={f.endTime} onChange={(v) => setF({ ...f, endTime: v })} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Select label="Tipo" value={f.format} onChange={(v) => setF({ ...f, format: v })} options={["Captação", "Reunião", "Entrega", "Gravação", "Evento", "Outro"]} />
          <Select label="Cliente" value={f.clientId} onChange={(v) => setF({ ...f, clientId: v })} options={[{ value: "", label: "Interno (agência)" }, ...clients.map((c) => ({ value: c._id, label: c.name }))]} />
        </div>
        <Field label="Local" value={f.location} onChange={(v) => setF({ ...f, location: v })} />
        <Area label="Observação da equipe" value={f.teamNote} onChange={(v) => setF({ ...f, teamNote: v })} rows={2} />
        {f.clientId && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.visibleToClient} onChange={(e) => setF({ ...f, visibleToClient: e.target.checked })} />Mostrar para o cliente</label>}
        <ErrorText>{err}</ErrorText>
        <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button disabled={busy || !f.title} onClick={async () => { setBusy(true); try { await api.createEvent(f); onDone(); } catch (x) { setErr(x instanceof Error ? x.message : String(x)); setBusy(false); } }}>{busy ? "Salvando…" : "Agendar"}</Button></div>
      </div>
    </Modal>
  );
}

export function CalendarPage({ me, go }: { me: Me; go: (p: string) => void }) {
  return (
    <div className="grid gap-4">
      <div><p className="eyebrow">Planejamento</p><h1 className="text-3xl font-extrabold">Calendário de conteúdo</h1></div>
      <Card><MonthCalendar me={me} clientId={me.role === "client" ? me.clientId ?? undefined : undefined} go={go} /></Card>
    </div>
  );
}
