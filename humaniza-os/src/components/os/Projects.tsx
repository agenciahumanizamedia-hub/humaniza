// Projetos/mês e roteiros (Hub Humaniza dentro do Humaniza OS).
// Fluxo: 01 Planejamento → 02 Desenvolvimento (Reels, carrossel, estático) → 03 Calendário → 04 Aprovação.
// Equipe/admin editam; o cliente vê o que foi liberado e aprova, pede ajuste ou sugere outra ordem.
import { useMemo, useState } from "react";
import { api, type Content, type Me, type Project, type ProjectDetail } from "./api";
import {
  Area, Button, Card, ErrorText, Field, Logo, Modal, Pill, RichEditor, RichView, Select, Skeleton, TYPE_LABEL, TYPE_SHORT, brDate, useLoad, useToast,
} from "./ui";
import { StageBar, mainColor } from "./Clients";

const STATUS = ["Bloqueado", "Em desenvolvimento", "Liberado ao cliente", "Aguardando aprovação", "Ajustes solicitados", "Aprovado", "Finalizado"];
const CONTENT_STATUS = ["Em criação", "Aguardando aprovação", "Aprovado", "Ajustes", "Em produção", "Agendado", "Postado"];
const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

export function ProjectList({ me, clientId, go }: { me: Me; clientId?: string; go: (p: string) => void }) {
  const { data, error, reload } = useLoad(() => api.projects(clientId), [clientId]);
  const clients = useLoad(api.clients);
  const [creating, setCreating] = useState(false);
  const names = new Map((clients.data ?? []).map((c) => [c._id, c]));
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold">{clientId ? "Projetos/mês" : "Todos os projetos"}</h2>
        {me.role !== "client" && <Button onClick={() => setCreating(true)}>+ Novo projeto/mês</Button>}
      </div>
      <ErrorText>{error}</ErrorText>
      {!data && !error && <Skeleton />}
      {data?.length === 0 && <p className="text-sm text-muted-foreground">Nenhum projeto ainda.</p>}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {data?.map((p) => {
          const c = names.get(p.clientId);
          return (
            <button key={p._id} onClick={() => go(`projeto/${p._id}`)} className="rounded-lg border border-border bg-card p-4 text-left transition hover:border-primary/60">
              {!clientId && c && <div className="mb-2 flex items-center gap-2 text-sm"><Logo name={c.name} url={c.logoUrl} color={mainColor(c)} size={22} /><span className="truncate text-muted-foreground">{c.name}</span></div>}
              <h3 className="text-lg font-bold">{p.period}</h3>
              <StageBar p={p} />
              <p className="mt-2 text-xs text-muted-foreground">{p.total} conteúdos · {p.approved} aprovados{p.adjustments ? ` · ${p.adjustments} ajustes` : ""}</p>
            </button>
          );
        })}
      </div>
      {creating && (
        <NewProject clientId={clientId} existing={data ?? []} clients={clients.data ?? []} onClose={() => setCreating(false)}
          onDone={(id) => { setCreating(false); reload(); go(`projeto/${id}`); }} />
      )}
    </div>
  );
}

function NewProject({ clientId, existing, clients, onClose, onDone }: {
  clientId?: string; existing: { _id: string; period: string; clientId: string }[]; clients: { _id: string; name: string }[]; onClose: () => void; onDone: (id: string) => void;
}) {
  const now = new Date();
  const [cid, setCid] = useState(clientId ?? "");
  const [month, setMonth] = useState(String(now.getMonth() + 2 > 12 ? 1 : now.getMonth() + 2));
  const [year, setYear] = useState(String(now.getMonth() + 2 > 12 ? now.getFullYear() + 1 : now.getFullYear()));
  const [extra, setExtra] = useState("");
  const [copyFrom, setCopy] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const period = `${MONTHS[Number(month) - 1]} ${year}${extra ? ` ${extra}` : ""}`;
  return (
    <Modal title="Novo projeto/mês" onClose={onClose}>
      <div className="grid gap-3">
        {!clientId && <Select label="Cliente" value={cid} onChange={setCid} options={[{ value: "", label: "Escolha…" }, ...clients.map((c) => ({ value: c._id, label: c.name }))]} />}
        <div className="grid grid-cols-3 gap-2">
          <Select label="Mês" value={month} onChange={setMonth} options={MONTHS.map((m, i) => ({ value: String(i + 1), label: m }))} />
          <Field label="Ano" value={year} onChange={setYear} />
          <Field label="Complemento" value={extra} onChange={setExtra} placeholder="Ex.: Cap#2" />
        </div>
        <Select label="Começar" value={copyFrom} onChange={setCopy}
          options={[{ value: "", label: "Em branco" }, ...existing.filter((p) => p.clientId === cid).map((p) => ({ value: p._id, label: `Duplicar ${p.period}` }))]} />
        <p className="text-sm text-muted-foreground">Nome do projeto: <b className="text-foreground">{period}</b></p>
        <ErrorText>{err}</ErrorText>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button disabled={busy || !cid} onClick={async () => {
            setBusy(true);
            try {
              onDone((await api.createProject({ clientId: cid, period, periodSort: `${year}-${month.padStart(2, "0")}`, copyFrom: copyFrom || undefined }))._id);
            } catch (x) { setErr(x instanceof Error ? x.message : String(x)); setBusy(false); }
          }}>{busy ? "Criando…" : "Criar projeto"}</Button>
        </div>
      </div>
    </Modal>
  );
}

export function ProjectPage({ me, id, go }: { me: Me; id: string; go: (p: string) => void }) {
  const { data, error, reload, setData } = useLoad(() => api.project(id), [id]);
  const [toast, say] = useToast();
  if (error) return <ErrorText>{error}</ErrorText>;
  if (!data) return <Skeleton rows={3} />;
  const { project: p, client: c, contents } = data;
  const staff = me.role !== "client";
  const color = mainColor(c as any);
  const refresh = (msg?: string) => { reload(); if (msg) say(msg); };
  return (
    <div className="grid gap-6">
      <button onClick={() => go(staff ? `cliente/${c._id}` : "")} className="no-print w-fit text-sm text-muted-foreground hover:text-foreground">← {staff ? c.name : "Início"}</button>
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="flex flex-wrap items-center gap-3 p-4 sm:gap-4 sm:p-5" style={{ background: `linear-gradient(110deg, ${color}40, transparent 60%)` }}>
          <Logo name={c.name} url={c.logoUrl} color={color} size={56} />
          <div className="min-w-0 flex-1">
            <p className="eyebrow">{c.name}</p>
            <h1 className="text-2xl font-extrabold leading-tight sm:text-3xl">Projeto {p.period}</h1>
          </div>
          <div className="no-print flex flex-wrap gap-2">
            <Button variant="ghost" small onClick={() => window.print()}>Imprimir / PDF</Button>
            {me.role === "admin" && <Button variant="danger" small onClick={async () => {
              if (!confirmText(`Mandar o projeto ${p.period} para a lixeira?`)) return;
              await api.trashProject(p._id); go(`cliente/${c._id}`);
            }}>Lixeira</Button>}
          </div>
        </div>
        <Flow p={p} />
      </div>

      <Strategic me={me} p={p} onChange={refresh} />
      <Production me={me} p={p} contents={contents} brandColor={color} onChange={refresh}
        onLocal={(list) => setData({ ...(data as ProjectDetail), contents: list })} />
      <CalendarStage me={me} p={p} contents={contents} onChange={refresh} />
      <ApprovalStage me={me} p={p} onChange={refresh} />
      <Card>
        <h2 className="text-lg font-bold">Histórico do projeto</h2>
        <ol className="mt-3 grid max-h-80 gap-2 overflow-y-auto border-l-2 border-primary pl-4 text-sm">
          {p.history.map((h, i) => <li key={i} className="text-muted-foreground">{h}</li>)}
        </ol>
      </Card>
      {toast}
    </div>
  );
}

const confirmText = (msg: string) => window.confirm(msg);

function Flow({ p }: { p: Project }) {
  const steps: [string, string][] = [["01 Planejamento", p.strategicStatus], ["02 Desenvolvimento", p.productionStatus], ["03 Calendário", p.calendarStatus], ["04 Aprovação", p.approvalStatus]];
  return (
    <div className="grid grid-cols-2 gap-px border-t border-border bg-border md:grid-cols-4">
      {steps.map(([label, s]) => (
        <div key={label} className="bg-card p-4">
          <p className="text-sm font-bold">{label}</p>
          <div className="mt-1"><Pill>{s || "Bloqueado"}</Pill></div>
        </div>
      ))}
    </div>
  );
}

/** Controles da etapa: equipe muda o status; cliente aprova ou pede ajuste. */
function StageControls({ me, p, stage, onChange }: { me: Me; p: Project; stage: "strategic" | "production" | "calendar" | "approval"; onChange: (m?: string) => void }) {
  const key = `${stage}Status` as keyof Project;
  const status = (p[key] as string) || "Bloqueado";
  const [note, setNote] = useState("");
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const run = async (fn: () => Promise<unknown>, msg: string) => {
    setBusy(true); setErr("");
    try { await fn(); onChange(msg); setAsking(false); setNote(""); } catch (x) { setErr(x instanceof Error ? x.message : String(x)); } finally { setBusy(false); }
  };
  const canDecide = status !== "Bloqueado" && status !== "Aprovado" && status !== "Finalizado";
  return (
    <div className="no-print mt-4 grid gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {me.role !== "client" && (
          <select value={status} disabled={busy} onChange={(e) => run(() => api.updateProject(p._id, { [key]: e.target.value }), "Etapa atualizada.")}
            className="rounded-control border border-border bg-secondary p-2 text-sm">
            {STATUS.map((s) => <option key={s}>{s}</option>)}
          </select>
        )}
        {me.role !== "client" && status !== "Liberado ao cliente" && status !== "Aprovado" && status !== "Finalizado" && (
          <Button small variant="ghost" disabled={busy} onClick={() => run(() => api.updateProject(p._id, { [key]: "Liberado ao cliente" }), "Liberado para o cliente aprovar.")}>Liberar ao cliente</Button>
        )}
        {canDecide && (me.role === "client" || status === "Liberado ao cliente" || status === "Aguardando aprovação") && (
          <>
            <Button small variant="green" disabled={busy} onClick={() => run(() => api.decide(p._id, { decision: "approve", stage }), "Etapa aprovada.")}>Aprovar etapa</Button>
            <Button small variant="yellow" disabled={busy} onClick={() => setAsking(!asking)}>Solicitar ajuste</Button>
          </>
        )}
      </div>
      {asking && (
        <div className="grid gap-2 rounded-control border border-amber-400/30 bg-amber-400/5 p-3">
          <Area label="O que precisa mudar?" value={note} onChange={setNote} rows={3} />
          <div className="flex gap-2"><Button small variant="yellow" disabled={busy || !note.trim()} onClick={() => run(() => api.decide(p._id, { decision: "adjust", stage, note }), "Ajuste enviado para a equipe.")}>Enviar ajuste</Button>
            <Button small variant="ghost" onClick={() => setAsking(false)}>Cancelar</Button></div>
        </div>
      )}
      <ErrorText>{err}</ErrorText>
    </div>
  );
}

function Locked({ text }: { text: string }) {
  return <p className="mt-3 rounded-control border border-dashed border-border p-4 text-sm text-muted-foreground">🔒 {text}</p>;
}

function Strategic({ me, p, onChange }: { me: Me; p: Project; onChange: (m?: string) => void }) {
  const staff = me.role !== "client";
  const [s, setS] = useState<Record<string, string>>(p.strategic ?? {});
  const [busy, setBusy] = useState(false);
  const blocks: [string, string][] = [["macro", "Visão macro"], ["editorial", "Linha editorial"], ["themes", "Temas do mês"], ["creative", "Direção criativa"]];
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-xl font-bold">01 Planejamento estratégico</h2><Pill>{p.strategicStatus || "Bloqueado"}</Pill></div>
      {!p.strategic ? <Locked text="O planejamento aparece aqui quando a Humaniza liberar." /> : (
        <>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {blocks.map(([k, label]) => (
              <div key={k}>
                <p className="mb-1 text-sm font-semibold text-[#c9c7ff]">{label}</p>
                {staff ? <RichEditor value={s[k] ?? ""} onChange={(v) => setS({ ...s, [k]: v })} /> : <div className="rounded-control bg-secondary p-3"><RichView html={p.strategic?.[k] ?? ""} /></div>}
              </div>
            ))}
          </div>
          {staff && <div className="no-print mt-3 flex justify-end"><Button disabled={busy} onClick={async () => { setBusy(true); try { await api.updateProject(p._id, { strategic: s }); onChange("Planejamento salvo."); } finally { setBusy(false); } }}>{busy ? "Salvando…" : "Salvar planejamento"}</Button></div>}
        </>
      )}
      <StageControls me={me} p={p} stage="strategic" onChange={onChange} />
    </Card>
  );
}

function Production({ me, p, contents, brandColor, onChange, onLocal }: {
  me: Me; p: Project; contents: Content[]; brandColor: string; onChange: (m?: string) => void; onLocal: (list: Content[]) => void;
}) {
  const staff = me.role !== "client";
  const [type, setType] = useState("Todos");
  const [status, setStatus] = useState("Todos");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"cards" | "grade">(staff ? "cards" : "grade");
  const [open, setOpen] = useState<Content | null>(null);
  const [adding, setAdding] = useState(false);
  const locked = !staff && (!p.productionStatus || p.productionStatus === "Bloqueado");
  const list = useMemo(
    () => contents.filter((c) => (type === "Todos" || c.type === type) && (status === "Todos" || c.status === status || c.clientApproval === status) &&
      (!search || (c.title + " " + Object.values(c.fields ?? {}).join(" ")).toLowerCase().includes(search.toLowerCase()))),
    [contents, type, status, search],
  );
  const add = async (t: string) => {
    setAdding(true);
    try { await api.createContent({ projectId: p._id, type: t }); onChange("Conteúdo adicionado."); } finally { setAdding(false); }
  };
  const move = async (c: Content, dir: -1 | 1) => {
    const i = contents.findIndex((x) => x._id === c._id);
    const j = i + dir;
    if (j < 0 || j >= contents.length) return;
    const next = [...contents];
    [next[i], next[j]] = [next[j], next[i]];
    onLocal(next.map((x, k) => ({ ...x, order: k })));
    await Promise.all([api.updateContent(next[i]._id, { order: i }), api.updateContent(next[j]._id, { order: j })]);
  };
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-bold">02 Desenvolvimento criativo</h2>
        <Pill>{p.productionStatus || "Bloqueado"}</Pill>
      </div>
      {locked ? <Locked text="Os roteiros aparecem aqui depois que o planejamento for aprovado e a Humaniza liberar." /> : (
        <>
          <div className="no-print mt-4 grid grid-cols-2 items-end gap-2 sm:flex sm:flex-wrap">
            <Select label="Formato" value={type} onChange={setType} options={[{ value: "Todos", label: "Todos" }, { value: "roteiro", label: "Reels / Roteiro" }, { value: "carrossel", label: "Carrossel" }, { value: "estatico", label: "Estático" }]} />
            <Select label="Status" value={status} onChange={setStatus} options={["Todos", ...CONTENT_STATUS]} />
            <Field label="Buscar" value={search} onChange={setSearch} placeholder="Tema, legenda…" />
            <div className="flex gap-1 rounded-control border border-border p-1 sm:ml-auto">
              <button onClick={() => setView("cards")} className={`rounded px-3 py-1.5 text-sm ${view === "cards" ? "bg-primary text-white" : ""}`}>Roteiros</button>
              <button onClick={() => setView("grade")} className={`rounded px-3 py-1.5 text-sm ${view === "grade" ? "bg-primary text-white" : ""}`}>Feed</button>
            </div>
          </div>
          {staff && (
            <div className="no-print mt-3 flex flex-wrap gap-2">
              <Button small disabled={adding} onClick={() => add("roteiro")}>+ Reels / Roteiro</Button>
              <Button small disabled={adding} onClick={() => add("carrossel")}>+ Carrossel</Button>
              <Button small disabled={adding} onClick={() => add("estatico")}>+ Estático</Button>
            </div>
          )}
          <p className="mt-3 text-xs text-muted-foreground">{list.length} de {contents.length} conteúdos</p>
          {view === "grade" ? (
            <div className="mx-auto mt-3 grid max-w-xl grid-cols-3 gap-1">
              {list.map((c) => (
                <button key={c._id} onClick={() => setOpen(c)} className="relative aspect-[4/5] overflow-hidden p-2 text-left text-[11px] leading-tight transition hover:opacity-90"
                  style={{ background: c.type === "roteiro" ? `linear-gradient(160deg, ${brandColor}, #1C1C1C)` : c.type === "carrossel" ? "linear-gradient(160deg, #5B56FF, #2A2A2A)" : "#2E2E2E", color: "#fff" }}>
                  <span className="absolute right-1.5 top-1.5 text-xs">{c.type === "roteiro" ? "▶" : c.type === "carrossel" ? "❐" : ""}</span>
                  <span className="line-clamp-5 font-bold">{c.title || "Sem tema"}</span>
                  <span className="absolute bottom-1.5 left-2 right-2 flex items-center justify-between opacity-80"><span>{c.postDate ? brDate(c.postDate).slice(0, 5) : ""}</span>
                    {c.clientApproval === "Aprovado" && <span>✓</span>}{c.clientApproval === "Ajustes" && <span>⚠</span>}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="mt-3 grid gap-3">
              {list.map((c) => (
                <ContentCard key={c._id} me={me} p={p} c={c} onOpen={() => setOpen(c)} onMove={staff ? (d) => move(c, d) : undefined} onChange={onChange} />
              ))}
            </div>
          )}
          {list.length === 0 && <p className="mt-3 text-sm text-muted-foreground">Nenhum conteúdo com esses filtros.</p>}
        </>
      )}
      <StageControls me={me} p={p} stage="production" onChange={onChange} />
      {open && <ContentModal me={me} p={p} c={open} onClose={() => setOpen(null)} onChange={(m) => { setOpen(null); onChange(m); }} />}
    </Card>
  );
}

function fieldsFor(type: string): [string, string][] {
  if (type === "carrossel") return [["tema", "Tema"], ["objetivo", "Objetivo"], ["slides", "Slides"], ["legenda", "Legenda"], ["cta", "CTA"]];
  if (type === "estatico") return [["tema", "Tema"], ["mensagem", "Mensagem principal"], ["legenda", "Legenda"], ["cta", "CTA"]];
  return [["tema", "Tema"], ["objetivo", "Objetivo"], ["gancho", "Gancho"], ["desenvolvimento", "Desenvolvimento / cenas"], ["legenda", "Legenda"], ["cta", "CTA"]];
}

function ContentCard({ me, p, c, onOpen, onMove, onChange }: { me: Me; p: Project; c: Content; onOpen: () => void; onMove?: (d: -1 | 1) => void; onChange: (m?: string) => void }) {
  const done = (c.checklist ?? []).filter((x) => x.done).length;
  const total = (c.checklist ?? []).length;
  return (
    <div className={`rounded-lg border bg-secondary/40 p-4 ${c.clientApproval === "Ajustes" ? "border-amber-400/50" : c.clientApproval === "Aprovado" ? "border-emerald-400/40" : "border-border"}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <button onClick={onOpen} className="min-w-0 flex-1 text-left">
          <p className="text-xs font-semibold text-[#c9c7ff]">{TYPE_LABEL[c.type] ?? c.type} · {brDate(c.postDate)}{c.week ? ` · ${c.week}` : ""}</p>
          <h3 className="mt-0.5 break-words text-base font-bold hover:underline sm:text-lg">{c.title || "Sem tema"}</h3>
        </button>
        <div className="flex items-center gap-2">
          <Pill>{c.status || "Em criação"}</Pill>
          {c.clientApproval && <Pill>{c.clientApproval === "Ajustes" ? "Cliente pediu ajuste" : c.clientApproval === "Aprovado" ? "Cliente aprovou" : c.clientApproval}</Pill>}
          {onMove && <span className="no-print flex"><button className="px-1.5 text-muted-foreground hover:text-foreground" title="Subir" onClick={() => onMove(-1)}>↑</button><button className="px-1.5 text-muted-foreground hover:text-foreground" title="Descer" onClick={() => onMove(1)}>↓</button></span>}
        </div>
      </div>
      {c.clientNote && <p className="mt-2 rounded-control border border-amber-400/30 bg-amber-400/5 p-2 text-sm">💬 <b>Cliente:</b> {c.clientNote}</p>}
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {fieldsFor(c.type).filter(([k]) => k !== "tema").slice(0, 4).map(([k, label]) => (
          <div key={k}><p className="text-xs font-semibold text-muted-foreground">{label}</p><div className="line-clamp-6"><RichView html={c.fields?.[k] ?? ""} /></div></div>
        ))}
      </div>
      <div className="no-print mt-3 flex flex-wrap items-center gap-2">
        <Button small variant="ghost" onClick={onOpen}>{me.role === "client" ? "Ver completo" : "Abrir e editar"}</Button>
        {c.driveLink && <a href={c.driveLink} target="_blank" rel="noreferrer" className="text-xs text-[#c9c7ff] underline">Drive</a>}
        {c.referenceLink && <a href={c.referenceLink} target="_blank" rel="noreferrer" className="text-xs text-[#c9c7ff] underline">Referência</a>}
        {total > 0 && me.role !== "client" && <span className="ml-auto text-xs text-muted-foreground">{done}/{total} etapas{c.responsible ? ` · ${c.responsible}` : ""}</span>}
        {me.role === "client" && <ClientDecision p={p} c={c} onChange={onChange} />}
      </div>
    </div>
  );
}

function ClientDecision({ p, c, onChange }: { p: Project; c: Content; onChange: (m?: string) => void }) {
  const [mode, setMode] = useState<"" | "adjust" | "order">("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const send = async (decision: "approve" | "adjust" | "order") => {
    setBusy(true);
    try { await api.decide(p._id, { decision, contentId: c._id, note }); onChange(decision === "approve" ? "Conteúdo aprovado." : "Recebemos seu pedido. A equipe vai ajustar."); } finally { setBusy(false); }
  };
  return (
    <div className="ml-auto grid w-full gap-2 sm:w-auto">
      <div className="flex flex-wrap justify-end gap-2">
        <Button small variant="green" disabled={busy} onClick={() => send("approve")}>Aprovar</Button>
        <Button small variant="yellow" disabled={busy} onClick={() => setMode(mode === "adjust" ? "" : "adjust")}>Solicitar ajuste</Button>
        <Button small variant="ghost" disabled={busy} onClick={() => setMode(mode === "order" ? "" : "order")}>Sugerir outra ordem</Button>
      </div>
      {mode && (
        <div className="grid gap-2">
          <Area label={mode === "adjust" ? "O que você quer mudar?" : "Em que posição/data você prefere este conteúdo?"} value={note} onChange={setNote} rows={2} />
          <div className="flex justify-end"><Button small disabled={busy || !note.trim()} onClick={() => send(mode)}>Enviar</Button></div>
        </div>
      )}
    </div>
  );
}

function ContentModal({ me, p, c, onClose, onChange }: { me: Me; p: Project; c: Content; onClose: () => void; onChange: (m?: string) => void }) {
  const staff = me.role !== "client";
  const [f, setF] = useState<Record<string, string>>({ ...(c.fields ?? {}) });
  const [meta, setMeta] = useState({ type: c.type as string, postDate: c.postDate || "", week: c.week || "", status: c.status || "Em criação", responsible: c.responsible ?? "", driveLink: c.driveLink, referenceLink: c.referenceLink, note: c.note ?? "" });
  const [check, setCheck] = useState(c.checklist ?? []);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k: keyof typeof meta) => (v: string) => setMeta({ ...meta, [k]: v });
  return (
    <Modal wide title={`${TYPE_LABEL[meta.type] ?? ""} — ${c.title || "Sem tema"}`} onClose={onClose}>
      {staff ? (
        <div className="grid gap-4">
          <div className="grid gap-3 md:grid-cols-4">
            <Select label="Formato" value={meta.type} onChange={set("type")} options={[{ value: "roteiro", label: "Reels / Roteiro" }, { value: "carrossel", label: "Carrossel" }, { value: "estatico", label: "Estático" }]} />
            <Field label="Data de postagem" type="date" value={meta.postDate} onChange={set("postDate")} />
            <Select label="Semana" value={meta.week} onChange={set("week")} options={["", "Semana 1", "Semana 2", "Semana 3", "Semana 4", "Semana 5"]} />
            <Select label="Status" value={meta.status} onChange={set("status")} options={CONTENT_STATUS} />
          </div>
          {c.clientNote && <p className="rounded-control border border-amber-400/30 bg-amber-400/5 p-3 text-sm">💬 <b>Cliente ({c.clientApproval}):</b> {c.clientNote}</p>}
          {fieldsFor(meta.type).map(([k, label]) => (
            <div key={k}><p className="mb-1 text-sm font-semibold text-[#c9c7ff]">{label}</p><RichEditor value={f[k] ?? ""} onChange={(v) => setF({ ...f, [k]: v })} /></div>
          ))}
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="Responsável" value={meta.responsible} onChange={set("responsible")} placeholder="Ex.: Diego, Luana" />
            <Field label="Link do Drive" value={meta.driveLink} onChange={set("driveLink")} />
            <Field label="Link de referência" value={meta.referenceLink} onChange={set("referenceLink")} />
          </div>
          <div>
            <p className="mb-1 text-sm font-semibold">Checklist de produção</p>
            <div className="flex flex-wrap gap-2">
              {check.map((x, i) => (
                <label key={i} className={`flex items-center gap-2 rounded-full border px-3 py-1 text-sm ${x.done ? "border-emerald-400/40 bg-emerald-400/10" : "border-border"}`}>
                  <input type="checkbox" checked={x.done} onChange={(e) => setCheck(check.map((y, j) => (j === i ? { ...y, done: e.target.checked } : y)))} />{x.label}
                </label>
              ))}
            </div>
          </div>
          <Area label="Observação interna" value={meta.note} onChange={set("note")} rows={2} />
          <ErrorText>{err}</ErrorText>
          <div className="flex flex-wrap justify-between gap-2">
            <Button variant="danger" onClick={async () => { if (!confirmText("Mandar este conteúdo para a lixeira?")) return; await api.trashContent(c._id); onChange("Conteúdo na lixeira."); }}>Mandar para a lixeira</Button>
            <div className="flex gap-2"><Button variant="ghost" onClick={onClose}>Fechar</Button>
              <Button disabled={busy} onClick={async () => {
                setBusy(true); setErr("");
                try { await api.updateContent(c._id, { ...meta, fields: f, checklist: check }); onChange("Conteúdo salvo."); } catch (x) { setErr(x instanceof Error ? x.message : String(x)); setBusy(false); }
              }}>{busy ? "Salvando…" : "Salvar"}</Button></div>
          </div>
        </div>
      ) : (
        <div className="grid gap-4">
          <p className="text-sm text-muted-foreground">{TYPE_SHORT[c.type]} · {brDate(c.postDate)}{c.week ? ` · ${c.week}` : ""}</p>
          {fieldsFor(c.type).map(([k, label]) => (
            <div key={k}><p className="mb-1 text-sm font-semibold text-[#c9c7ff]">{label}</p><div className="rounded-control bg-secondary p-3"><RichView html={c.fields?.[k] ?? ""} /></div></div>
          ))}
          {c.referenceLink && <a href={c.referenceLink} target="_blank" rel="noreferrer" className="text-sm text-[#c9c7ff] underline">Ver referência</a>}
          <ClientDecision p={p} c={c} onChange={onChange} />
        </div>
      )}
    </Modal>
  );
}

function CalendarStage({ me, p, contents, onChange }: { me: Me; p: Project; contents: Content[]; onChange: (m?: string) => void }) {
  const staff = me.role !== "client";
  const [cal, setCal] = useState({ content: p.calendar?.content ?? "", note: p.calendar?.note ?? "" });
  const [busy, setBusy] = useState(false);
  const dated = [...contents].filter((c) => c.postDate).sort((a, b) => a.postDate.localeCompare(b.postDate));
  const undated = contents.filter((c) => !c.postDate);
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-xl font-bold">03 Calendário editorial</h2><Pill>{p.calendarStatus || "Bloqueado"}</Pill></div>
      {!p.calendar ? <Locked text="O calendário aparece aqui quando a Humaniza liberar." /> : (
        <>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-muted-foreground"><tr><th className="p-2">Data</th><th className="p-2">Formato</th><th className="p-2">Tema</th><th className="p-2">Status</th></tr></thead>
              <tbody>
                {dated.map((c) => (
                  <tr key={c._id} className="border-t border-border"><td className="p-2 font-semibold">{brDate(c.postDate)}</td><td className="p-2">{TYPE_SHORT[c.type]}</td><td className="p-2">{c.title || "—"}</td><td className="p-2"><Pill>{c.clientApproval || c.status || "Em criação"}</Pill></td></tr>
                ))}
              </tbody>
            </table>
            {dated.length === 0 && <p className="p-2 text-sm text-muted-foreground">Nenhum conteúdo com data de postagem.</p>}
            {staff && undated.length > 0 && <p className="mt-2 text-xs text-amber-300">{undated.length} conteúdo(s) ainda sem data de postagem.</p>}
          </div>
          <div className="mt-4">
            <p className="mb-1 text-sm font-semibold text-[#c9c7ff]">Observações do calendário</p>
            {staff ? <RichEditor value={cal.content} onChange={(v) => setCal({ ...cal, content: v })} /> : <div className="rounded-control bg-secondary p-3"><RichView html={p.calendar.content} /></div>}
          </div>
          {staff && <div className="no-print mt-3 flex justify-end"><Button disabled={busy} onClick={async () => { setBusy(true); try { await api.updateProject(p._id, { calendar: cal }); onChange("Calendário salvo."); } finally { setBusy(false); } }}>{busy ? "Salvando…" : "Salvar calendário"}</Button></div>}
        </>
      )}
      <StageControls me={me} p={p} stage="calendar" onChange={onChange} />
    </Card>
  );
}

function ApprovalStage({ me, p, onChange }: { me: Me; p: Project; onChange: (m?: string) => void }) {
  const staff = me.role !== "client";
  const [notes, setNotes] = useState(p.approvalNotes ?? "");
  const [busy, setBusy] = useState(false);
  const locked = !staff && (!p.approvalStatus || p.approvalStatus === "Bloqueado");
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-xl font-bold">04 Aprovação de artes e vídeos</h2><Pill>{p.approvalStatus || "Bloqueado"}</Pill></div>
      {locked ? <Locked text="Disponível depois do calendário aprovado." /> : staff ? (
        <div className="mt-3 grid gap-2">
          <Area label="Observações da aprovação final (links das artes, vídeos…)" value={notes} onChange={setNotes} rows={3} />
          <div className="no-print flex justify-end"><Button disabled={busy} onClick={async () => { setBusy(true); try { await api.updateProject(p._id, { approvalNotes: notes }); onChange("Salvo."); } finally { setBusy(false); } }}>Salvar</Button></div>
        </div>
      ) : (
        <p className="mt-3 whitespace-pre-wrap text-sm">{p.approvalNotes || "A equipe vai enviar as artes e vídeos por aqui."}</p>
      )}
      <StageControls me={me} p={p} stage="approval" onChange={onChange} />
    </Card>
  );
}

