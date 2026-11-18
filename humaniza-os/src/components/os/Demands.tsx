// Demandas da equipe em quadro (estilo Trello): arraste os cartões entre as colunas.
import { useMemo, useState } from "react";
import { api, type Demand, type Me, type TeamMember } from "./api";
import { Area, Button, ErrorText, Field, ImagePicker, Modal, Pill, Select, Skeleton, brDate, useLoad, useToast } from "./ui";

export const COLUMNS = ["A fazer", "Em andamento", "Em revisão", "Aguardando cliente", "Concluído"];
const PRIORITY_COLOR: Record<string, string> = { Baixa: "#6B7280", Média: "#5B56FF", Alta: "#F59E0B", Urgente: "#EF4444" };

export function DemandsBoard({ me }: { me: Me }) {
  const { data, error, reload, setData } = useLoad(() => api.demands(), []);
  const team = useLoad(api.team);
  const clients = useLoad(api.clients);
  const [who, setWho] = useState(me.role === "team" ? me.email : "");
  const [client, setClient] = useState("");
  const [open, setOpen] = useState<Demand | "new" | null>(null);
  const [drag, setDrag] = useState<string | null>(null);
  const [toast, say] = useToast();
  const list = useMemo(() => (data ?? []).filter((d) => (!who || d.assignees.includes(who)) && (!client || d.clientId === client)), [data, who, client]);
  const name = (email: string) => team.data?.find((t) => t.email === email)?.name ?? email.split("@")[0];
  const today = new Date().toISOString().slice(0, 10);

  const drop = async (column: string) => {
    if (!drag) return;
    const d = data?.find((x) => x._id === drag);
    setDrag(null);
    if (!d || d.column === column) return;
    setData((data ?? []).map((x) => (x._id === d._id ? { ...x, column } : x)));
    try { await api.updateDemand(d._id, { column }); } catch (x) { say(x instanceof Error ? x.message : String(x)); reload(); }
  };

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="eyebrow">Operação</p><h1 className="text-2xl font-extrabold sm:text-3xl">Demandas da equipe</h1></div>
        <div className="grid w-full grid-cols-2 items-end gap-2 sm:flex sm:w-auto sm:flex-wrap">
          <Select label="Pessoa" value={who} onChange={setWho} options={[{ value: "", label: "Todos" }, ...(team.data ?? []).map((t) => ({ value: t.email, label: t.name }))]} />
          <Select label="Cliente" value={client} onChange={setClient} options={[{ value: "", label: "Todos" }, ...(clients.data ?? []).map((c) => ({ value: c._id, label: c.name }))]} />
          <Button onClick={() => setOpen("new")}>+ Nova demanda</Button>
        </div>
      </div>
      <ErrorText>{error}</ErrorText>
      {!data && !error && <Skeleton />}
      <div className="-mx-3 flex snap-x snap-mandatory gap-3 overflow-x-auto px-3 pb-4 sm:mx-0 sm:px-0">
        {COLUMNS.map((col) => {
          const cards = list.filter((d) => d.column === col);
          return (
            <div key={col} onDragOver={(e) => e.preventDefault()} onDrop={() => drop(col)}
              className={`flex w-[85vw] max-w-[18rem] shrink-0 snap-start flex-col rounded-lg border bg-card/70 ${drag ? "border-primary/40" : "border-border"}`}>
              <div className="flex items-center justify-between border-b border-border p-3">
                <h2 className="text-sm font-bold">{col}</h2><span className="rounded-full bg-secondary px-2 text-xs text-muted-foreground">{cards.length}</span>
              </div>
              <div className="grid min-h-24 gap-2 p-2">
                {cards.map((d) => {
                  const late = d.dueDate && d.dueDate < today && d.column !== "Concluído";
                  const done = d.checklist.filter((x) => x.done).length;
                  return (
                    <div key={d._id} draggable onDragStart={() => setDrag(d._id)} onDragEnd={() => setDrag(null)} onClick={() => setOpen(d)}
                      className="cursor-grab rounded-control border border-border bg-secondary p-3 text-sm shadow-sm transition hover:border-primary/60 active:cursor-grabbing">
                      {d.imageUrl && <img src={d.imageUrl} alt="" className="mb-2 h-28 w-full rounded object-cover" />}
                      <div className="mb-1 h-1 w-10 rounded-full" style={{ background: PRIORITY_COLOR[d.priority] ?? "#5B56FF" }} title={`Prioridade ${d.priority}`} />
                      <p className="font-semibold">{d.title}</p>
                      {d.clientName && <p className="text-xs text-[#c9c7ff]">{d.clientName}</p>}
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        {d.dueDate && <span className={late ? "font-bold text-red-300" : ""}>📅 {brDate(d.dueDate)}</span>}
                        {d.checklist.length > 0 && <span>☑ {done}/{d.checklist.length}</span>}
                        {d.comments.length > 0 && <span>💬 {d.comments.length}</span>}
                        <span className="ml-auto flex -space-x-1">
                          {d.assignees.slice(0, 3).map((a) => <span key={a} title={name(a)} className="flex h-6 w-6 items-center justify-center rounded-full border border-card bg-primary text-[10px] font-bold text-white">{name(a).slice(0, 2).toUpperCase()}</span>)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      {open && (
        <DemandModal demand={open === "new" ? null : open} team={team.data ?? []} clients={clients.data ?? []} me={me}
          onClose={() => setOpen(null)} onDone={(m) => { setOpen(null); reload(); say(m); }} />
      )}
      {toast}
    </div>
  );
}

function DemandModal({ demand, team, clients, me, onClose, onDone }: {
  demand: Demand | null; team: TeamMember[]; clients: { _id: string; name: string }[]; me: Me; onClose: () => void; onDone: (m: string) => void;
}) {
  const [f, setF] = useState({
    title: demand?.title ?? "", description: demand?.description ?? "", clientId: demand?.clientId ?? "", column: demand?.column ?? COLUMNS[0],
    priority: demand?.priority ?? "Média", dueDate: demand?.dueDate ?? "", imageUrl: demand?.imageUrl ?? "",
  });
  const [assignees, setAssignees] = useState<string[]>(demand?.assignees ?? (me.role === "team" ? [me.email] : []));
  const [links, setLinks] = useState((demand?.links ?? []).join("\n"));
  const [check, setCheck] = useState(demand?.checklist ?? []);
  const [newItem, setNewItem] = useState("");
  const [comment, setComment] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true); setErr("");
    const body = { ...f, assignees, links: links.split(/\s+/).filter(Boolean), checklist: check, comment };
    try {
      if (demand) await api.updateDemand(demand._id, body);
      else {
        const { _id } = await api.createDemand(body);
        if (check.length || body.links.length || f.imageUrl) await api.updateDemand(_id, { checklist: check, links: body.links, imageUrl: f.imageUrl });
      }
      onDone(demand ? "Demanda salva." : "Demanda criada.");
    } catch (x) { setErr(x instanceof Error ? x.message : String(x)); setBusy(false); }
  };
  return (
    <Modal wide title={demand ? "Demanda" : "Nova demanda"} onClose={onClose}>
      <div className="grid gap-4 md:grid-cols-[1.5fr_1fr]">
        <div className="grid content-start gap-3">
          <Field label="Título" value={f.title} onChange={(v) => setF({ ...f, title: v })} required />
          <Area label="Descrição" value={f.description} onChange={(v) => setF({ ...f, description: v })} rows={4} />
          <div>
            <p className="mb-1 text-sm text-muted-foreground">Checklist</p>
            <div className="grid gap-1">
              {check.map((x, i) => (
                <label key={i} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={x.done} onChange={(e) => setCheck(check.map((y, j) => (j === i ? { ...y, done: e.target.checked } : y)))} />
                  <span className={x.done ? "text-muted-foreground line-through" : ""}>{x.label}</span>
                  <button className="ml-auto text-muted-foreground hover:text-red-300" onClick={() => setCheck(check.filter((_, j) => j !== i))}>×</button>
                </label>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <input value={newItem} onChange={(e) => setNewItem(e.target.value)} placeholder="Novo item" className="flex-1 rounded-control border border-border bg-secondary p-2 text-sm"
                onKeyDown={(e) => { if (e.key === "Enter" && newItem.trim()) { setCheck([...check, { label: newItem.trim(), done: false }]); setNewItem(""); } }} />
              <Button small variant="ghost" onClick={() => { if (newItem.trim()) { setCheck([...check, { label: newItem.trim(), done: false }]); setNewItem(""); } }}>Adicionar</Button>
            </div>
          </div>
          <Area label="Links (um por linha)" value={links} onChange={setLinks} rows={2} />
          {demand && (
            <div>
              <p className="mb-1 text-sm text-muted-foreground">Comentários</p>
              <div className="grid max-h-48 gap-2 overflow-y-auto">
                {demand.comments.map((c, i) => <div key={i} className="rounded-control bg-secondary p-2 text-sm"><b>{c.by}</b> <span className="text-xs text-muted-foreground">{new Date(c.at).toLocaleString("pt-BR")}</span><p className="whitespace-pre-wrap">{c.text}</p></div>)}
              </div>
              <Area label="Novo comentário" value={comment} onChange={setComment} rows={2} />
            </div>
          )}
        </div>
        <div className="grid content-start gap-3">
          <Select label="Coluna" value={f.column} onChange={(v) => setF({ ...f, column: v })} options={COLUMNS} />
          <Select label="Prioridade" value={f.priority} onChange={(v) => setF({ ...f, priority: v })} options={["Baixa", "Média", "Alta", "Urgente"]} />
          <Field label="Prazo" type="date" value={f.dueDate} onChange={(v) => setF({ ...f, dueDate: v })} />
          <Select label="Cliente" value={f.clientId} onChange={(v) => setF({ ...f, clientId: v })} options={[{ value: "", label: "Interno" }, ...clients.map((c) => ({ value: c._id, label: c.name }))]} />
          <div>
            <p className="mb-1 text-sm text-muted-foreground">Responsáveis</p>
            <div className="grid gap-1">
              {team.map((t) => (
                <label key={t._id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={assignees.includes(t.email)} onChange={(e) => setAssignees(e.target.checked ? [...assignees, t.email] : assignees.filter((a) => a !== t.email))} />
                  {t.name}<span className="text-xs text-muted-foreground">{t.jobTitle}</span>
                </label>
              ))}
            </div>
          </div>
          {f.imageUrl && <img src={f.imageUrl} alt="" className="rounded-control" />}
          <ImagePicker label={f.imageUrl ? "Trocar imagem" : "Anexar imagem"} onUploaded={(url) => setF({ ...f, imageUrl: url })} />
          {demand?.createdBy && <p className="text-xs text-muted-foreground">Criada por {demand.createdBy}</p>}
          {demand && <Pill>{demand.column}</Pill>}
        </div>
      </div>
      <ErrorText>{err}</ErrorText>
      <div className="mt-4 flex flex-wrap justify-between gap-2">
        {demand ? <Button variant="danger" onClick={async () => { await api.trashDemand(demand._id); onDone("Demanda na lixeira."); }}>Mandar para a lixeira</Button> : <span />}
        <div className="flex gap-2"><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button disabled={busy || !f.title.trim()} onClick={save}>{busy ? "Salvando…" : "Salvar"}</Button></div>
      </div>
    </Modal>
  );
}
