// Aba "Próximos conteúdos" (só equipe/admin): o Claude pesquisa o que está em alta no mês da captação e
// sugere pautas inéditas (roteiro, carrossel, estático) com data no calendário. Nada chega ao cliente
// antes de a equipe aprovar: ao aprovar, a pauta vira conteúdo no projeto do mês e segue o fluxo normal.
import { useState } from "react";
import { api, type Client, type Me, type PautaIdea, type PautaTrend } from "./api";
import { Area, Button, Card, ErrorText, Field, Modal, Select, Skeleton, brDate, monthLabel, shiftMonth, thisMonth, useLoad, useToast } from "./ui";

const COLOR: Record<string, string> = { roteiro: "#7B76FF", carrossel: "#E0607E", estatico: "#2A9DB0" };
const LABEL: Record<string, string> = { roteiro: "Reels", carrossel: "Carrossel", estatico: "Estático" };
const ICON: Record<string, string> = { roteiro: "🎬", carrossel: "📚", estatico: "🖼️" };
const KIND: Record<string, string> = { formato: "Formato", tema: "Tema", data: "Data", comportamento: "Comportamento", audio: "Áudio" };
const DEV_LABEL: Record<string, string> = { roteiro: "Roteiro (cenas e falas)", carrossel: "Texto dos slides", estatico: "Mensagem da arte" };
const host = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; } };

export function PautaTab({ client, go }: { me: Me; client: Client; go: (p: string) => void }) {
  const [mes, setMes] = useState(shiftMonth(thisMonth(), 1));
  const { data, error, reload } = useLoad(() => api.pauta(client._id, mes), [client._id, mes]);
  const [qtd, setQtd] = useState("8");
  const [mix, setMix] = useState("auto");
  const [foco, setFoco] = useState("");
  const [busy, setBusy] = useState<"" | "tendencias" | "ideias" | string>("");
  const [fail, setFail] = useState("");
  const [note, setNote] = useState<{ checked: number; rejected: { title: string; reason: string }[] } | null>(null);
  const [view, setView] = useState<"sugerida" | "aprovada" | "descartada">("sugerida");
  const [edit, setEdit] = useState<PautaIdea | null>(null);
  const [toast, say] = useToast();

  const months = [0, 1, 2, 3].map((d) => shiftMonth(thisMonth(), d));
  const run = async (what: "tendencias" | "ideias" | "tudo") => {
    setFail(""); setNote(null);
    try {
      if (what !== "ideias") { setBusy("tendencias"); await api.pautaTrends(client._id, mes, foco); }
      if (what !== "tendencias") {
        setBusy("ideias");
        const r = await api.pautaIdeas(client._id, { mes, quantidade: Number(qtd), mix, foco });
        setNote({ checked: r.checkedAgainst, rejected: r.rejected });
        setView("sugerida");
        say(`${r.created.length} pauta(s) nova(s) para revisar.`);
      }
      reload();
    } catch (e: any) {
      setFail(e.message);
      reload();
    } finally { setBusy(""); }
  };
  const act = async (idea: PautaIdea, acao: "aprovar" | "descartar" | "reabrir") => {
    setBusy(idea.id);
    try {
      const r = await api.pautaAction(client._id, { mes, id: idea.id, acao });
      say(acao === "aprovar" ? (r.projectCreated ? `Aprovada. Criei o projeto de ${monthLabel(mes)} com ela.` : "Aprovada e enviada para o projeto do mês.") : acao === "descartar" ? "Pauta descartada." : "Pauta reaberta.");
      reload();
    } catch (e: any) { say(e.message); } finally { setBusy(""); }
  };
  const swap = async (idea: PautaIdea) => {
    setBusy(idea.id);
    try {
      const r = await api.pautaIdeas(client._id, { mes, substituir: idea.id, foco });
      setNote({ checked: r.checkedAgainst, rejected: r.rejected });
      say("Troquei por uma pauta nova.");
      reload();
    } catch (e: any) { say(e.message); } finally { setBusy(""); }
  };
  const approveAll = async () => {
    if (!data) return;
    for (const i of data.ideas.filter((x) => x.status === "sugerida")) {
      setBusy(i.id);
      try { await api.pautaAction(client._id, { mes, id: i.id, acao: "aprovar" }); } catch (e: any) { say(e.message); break; }
    }
    setBusy(""); reload(); say("Pautas aprovadas e enviadas para o projeto do mês.");
  };

  if (error) return <ErrorText>{error}</ErrorText>;
  const trends = data?.trends?.items ?? [];
  const trendById = new Map<string, PautaTrend>(trends.map((t) => [t.id, t] as [string, PautaTrend]));
  const ideas = (data?.ideas ?? []).filter((i) => i.status === view);
  const counts = { sugerida: 0, aprovada: 0, descartada: 0, ...Object.fromEntries(["sugerida", "aprovada", "descartada"].map((s) => [s, (data?.ideas ?? []).filter((i) => i.status === s).length])) };
  const projectId = data?.ideas.find((i) => i.projectId)?.projectId;

  return (
    <div className="grid gap-6">
      {toast}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Planejamento com o Claude</p>
          <h2 className="text-xl font-bold">Próximos conteúdos</h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            O Claude pesquisa o que está em alta no mês da captação e sugere pautas inéditas para {client.name}, conferidas contra tudo o que já foi feito.
            Só vira roteiro depois que a equipe aprova; o cliente vê no projeto do mês, como sempre.
          </p>
        </div>
        <div className="flex gap-1 overflow-x-auto rounded-control border border-border bg-secondary p-1">
          {months.map((m) => (
            <button key={m} onClick={() => { setMes(m); setNote(null); setFail(""); }}
              className={`whitespace-nowrap rounded-control px-3 py-1.5 text-sm font-semibold capitalize ${m === mes ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              {monthLabel(m)}
            </button>
          ))}
        </div>
      </div>

      {!data ? <Skeleton rows={3} /> : (
        <>
          {!data.aiReady && (
            <Card className="border-amber-400/40"><p className="text-sm">⚠️ O Claude ainda não está conectado. O administrador conecta uma vez na aba <b>Visão geral → ✨ Análise com Claude → Conectar o Claude</b>.</p></Card>
          )}

          <MonthStrip mes={mes} ideas={data.ideas.filter((i) => i.status !== "descartada")} capture={data.capture} dates={data.dates} occupied={data.occupied} />

          <Card>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_2fr_auto] lg:items-end">
              <Select label="Quantas pautas" value={qtd} onChange={setQtd} options={["4", "6", "8", "10", "12"]} />
              <Select label="Formatos" value={mix} onChange={setMix} options={[
                { value: "auto", label: "Automático (pelo desempenho)" }, { value: "equilibrado", label: "Equilibrado" },
                { value: "reels", label: "Mais Reels" }, { value: "carrossel", label: "Mais carrossel" }, { value: "so-reels", label: "Só Reels" },
              ]} />
              <Field label="Foco do mês (opcional)" value={foco} onChange={setFoco} placeholder="Ex.: lançamento da coleção, Natal, autoridade do especialista…" />
              <div className="flex flex-wrap gap-2">
                <Button disabled={!!busy || !data.aiReady} onClick={() => run(data.trends ? "ideias" : "tudo")}>
                  {busy === "tendencias" ? "Pesquisando o que está em alta…" : busy === "ideias" ? "Criando pautas inéditas…" : data.trends ? "✨ Gerar pautas" : "✨ Pesquisar e gerar pautas"}
                </Button>
                {data.trends && <Button variant="ghost" disabled={!!busy || !data.aiReady} onClick={() => run("tendencias")}>Pesquisar de novo</Button>}
              </div>
            </div>
            {busy === "tendencias" || busy === "ideias" ? (
              <p className="mt-3 text-sm text-muted-foreground">
                {busy === "tendencias" ? "1/2 · O Claude está pesquisando na web tendências de Reels, temas do nicho e datas de " : "2/2 · Criando as pautas e conferindo cada uma com os roteiros já feitos para "}
                <span className="capitalize">{monthLabel(mes)}</span>. Isso leva até 1 minuto.
              </p>
            ) : null}
            {fail && <p className="mt-3 text-sm text-red-300">{fail}</p>}
            {note && (
              <p className="mt-3 text-sm text-muted-foreground">
                ✅ Conferido com {note.checked} roteiros e pautas existentes.
                {note.rejected.length > 0 && ` ${note.rejected.length} ideia(s) descartada(s) automaticamente por repetição: ${note.rejected.map((r) => `"${r.title}" (${r.reason})`).join("; ")}.`}
              </p>
            )}
          </Card>

          {data.trends && <Trends data={data.trends} />}

          <div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex gap-1">
                {(["sugerida", "aprovada", "descartada"] as const).map((s) => (
                  <button key={s} onClick={() => setView(s)}
                    className={`rounded-full border px-3 py-1 text-sm font-semibold ${view === s ? "border-primary bg-primary/20 text-foreground" : "border-border text-muted-foreground"}`}>
                    {s === "sugerida" ? "Para aprovar" : s === "aprovada" ? "Aprovadas" : "Descartadas"} · {(counts as any)[s]}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                {projectId && <Button small variant="ghost" onClick={() => go(`projeto/${projectId}`)}>Abrir projeto de {monthLabel(mes)}</Button>}
                {view === "sugerida" && counts.sugerida > 1 && <Button small variant="green" disabled={!!busy} onClick={approveAll}>Aprovar todas</Button>}
              </div>
            </div>
            {ideas.length === 0 ? (
              <Card><p className="text-sm text-muted-foreground">
                {view === "sugerida" ? (data.ideas.length ? "Nenhuma pauta esperando aprovação." : "Ainda não há pautas para este mês. Clique em \"Pesquisar e gerar pautas\".") : view === "aprovada" ? "Nenhuma pauta aprovada ainda." : "Nenhuma pauta descartada."}
              </p></Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {ideas.map((i) => (
                  <IdeaCard key={i.id} idea={i} trend={trendById.get(i.trendId)} busy={busy === i.id} locked={!!busy}
                    onApprove={() => act(i, "aprovar")} onDiscard={() => act(i, "descartar")} onReopen={() => act(i, "reabrir")}
                    onSwap={() => swap(i)} onEdit={() => setEdit(i)} onOpen={() => i.projectId && go(`projeto/${i.projectId}`)} />
                ))}
              </div>
            )}
          </div>
        </>
      )}
      {edit && (
        <EditIdea idea={edit} mes={mes} onClose={() => setEdit(null)}
          onSave={async (v) => { await api.pautaAction(client._id, { mes, id: edit.id, acao: "salvar", ideia: v }); setEdit(null); reload(); say("Pauta salva."); }} />
      )}
    </div>
  );
}

function MonthStrip({ mes, ideas, capture, dates, occupied }: {
  mes: string; ideas: PautaIdea[]; capture: { date: string; title: string }[]; dates: { date: string; title: string; kind: string }[]; occupied: { date: string; type: string; title: string }[];
}) {
  const [y, m] = mes.split("-").map(Number);
  const days = new Date(y, m, 0).getDate();
  const first = new Date(y, m - 1, 1).getDay();
  const iso = (d: number) => `${mes}-${String(d).padStart(2, "0")}`;
  const total = { roteiro: 0, carrossel: 0, estatico: 0 } as Record<string, number>;
  ideas.forEach((i) => (total[i.type] = (total[i.type] ?? 0) + 1));
  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="eyebrow capitalize">{monthLabel(mes)} em um olhar</p>
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          {Object.entries(LABEL).map(([k, l]) => <span key={k} className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full" style={{ background: COLOR[k] }} />{l} · {total[k] ?? 0}</span>)}
          <span>🎥 Captação</span><span>📌 Data do mês</span><span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full border border-muted-foreground" />Já programado</span>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-muted-foreground">
        {["D", "S", "T", "Q", "Q", "S", "S"].map((d, i) => <span key={i}>{d}</span>)}
        {Array.from({ length: first }).map((_, i) => <span key={`b${i}`} />)}
        {Array.from({ length: days }, (_, k) => k + 1).map((d) => {
          const day = iso(d);
          const mine = ideas.filter((i) => i.postDate === day);
          const cap = capture.filter((c) => c.date === day);
          const evs = dates.filter((x) => x.date === day && x.kind !== "Captação");
          const occ = occupied.filter((o) => o.date === day);
          const tip = [...cap.map((c) => `🎥 ${c.title}`), ...evs.map((e) => `📌 ${e.title}`), ...mine.map((i) => `${LABEL[i.type]}: ${i.title}`), ...occ.map((o) => `Já programado: ${o.title}`)].join("\n");
          return (
            <div key={d} title={tip} className={`min-h-12 rounded-control border p-1 text-left ${cap.length ? "border-primary bg-primary/15" : "border-border bg-secondary"}`}>
              <div className="flex items-center justify-between"><span className="font-semibold text-foreground">{d}</span><span>{cap.length ? "🎥" : evs.length ? "📌" : ""}</span></div>
              <div className="mt-1 flex flex-wrap gap-0.5">
                {mine.map((i) => <span key={i.id} className="h-2 w-2 rounded-full" style={{ background: COLOR[i.type], opacity: i.status === "aprovada" ? 1 : 0.65 }} />)}
                {occ.map((o, n) => <span key={`o${n}`} className="h-2 w-2 rounded-full border border-muted-foreground" />)}
              </div>
            </div>
          );
        })}
      </div>
      {capture.length === 0 && <p className="mt-3 text-xs text-muted-foreground">Nenhuma captação marcada neste mês. Marque em <b>Datas e campanhas → Captação</b> para o Claude organizar as pautas em volta dela.</p>}
    </Card>
  );
}

function Trends({ data }: { data: NonNullable<import("./api").Pauta["trends"]> }) {
  const [open, setOpen] = useState(false);
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="eyebrow">🔎 O que está em alta</p>
          <p className="mt-1 max-w-3xl text-sm">{data.summary || "Pesquisa concluída."}</p>
          <p className="mt-1 text-xs text-muted-foreground">Pesquisado na web pelo Claude em {new Date(data.at).toLocaleString("pt-BR")} por {data.by} · {data.searches} buscas · {data.sources.length} páginas lidas</p>
        </div>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {data.items.map((t: PautaTrend) => (
          <div key={t.id} className="rounded-control border border-border bg-secondary p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#bdbaff]">{KIND[t.kind] ?? t.kind}</p>
            <p className="mt-1 font-semibold">{t.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t.description}</p>
            {t.apply && <p className="mt-2 text-sm"><b>Para o cliente:</b> {t.apply}</p>}
            <div className="mt-2 flex flex-wrap gap-1">
              {t.sources.length ? t.sources.map((s) => (
                <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer" title={s.title} className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground">↗ {host(s.url)}</a>
              )) : <span className="text-xs text-muted-foreground">Sem fonte confirmada</span>}
            </div>
          </div>
        ))}
      </div>
      {data.sources.length > 0 && (
        <div className="mt-3">
          <button onClick={() => setOpen(!open)} className="text-xs text-muted-foreground hover:text-foreground">{open ? "Esconder" : "Ver"} todas as páginas consultadas</button>
          {open && (
            <ul className="mt-2 grid gap-1 text-xs">
              {data.sources.map((s) => <li key={s.url}><a href={s.url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground underline hover:text-foreground">{s.title}</a> · {host(s.url)}</li>)}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
}

function IdeaCard({ idea, trend, busy, locked, onApprove, onDiscard, onReopen, onSwap, onEdit, onOpen }: {
  idea: PautaIdea; trend?: PautaTrend; busy: boolean; locked: boolean;
  onApprove: () => void; onDiscard: () => void; onReopen: () => void; onSwap: () => void; onEdit: () => void; onOpen: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`hz-rise flex flex-col rounded-lg border bg-card p-4 ${busy ? "opacity-60" : ""}`} style={{ borderColor: `${COLOR[idea.type]}66` }}>
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="rounded-full px-2 py-0.5 font-semibold text-white" style={{ background: COLOR[idea.type] }}>{ICON[idea.type]} {LABEL[idea.type]}</span>
        <span className="text-muted-foreground">📅 {idea.postDate ? brDate(idea.postDate) : "Sem data"}</span>
      </div>
      <h3 className="mt-3 font-bold leading-snug">{idea.title}</h3>
      {idea.gancho && <p className="mt-2 border-l-2 pl-3 text-sm italic" style={{ borderColor: COLOR[idea.type] }}>“{idea.gancho}”</p>}
      {idea.tema && <p className="mt-2 text-sm text-muted-foreground"><b className="text-foreground">Tema:</b> {idea.tema}</p>}
      {trend && <p className="mt-2 text-xs text-[#bdbaff]">🔥 Tendência: {trend.title}</p>}
      {idea.why && <p className="mt-2 text-xs text-muted-foreground"><b>Por quê:</b> {idea.why}</p>}
      <button onClick={() => setOpen(!open)} className="mt-3 w-fit text-xs font-semibold text-muted-foreground hover:text-foreground">{open ? "▲ Esconder roteiro" : "▼ Ver roteiro completo"}</button>
      {open && (
        <div className="mt-2 grid gap-2 rounded-control bg-secondary p-3 text-sm">
          {idea.objetivo && <p><b>Objetivo:</b> {idea.objetivo}</p>}
          {idea.desenvolvimento && <div><b>{DEV_LABEL[idea.type]}:</b><p className="whitespace-pre-line text-muted-foreground">{idea.desenvolvimento}</p></div>}
          {idea.legenda && <div><b>Legenda:</b><p className="whitespace-pre-line text-muted-foreground">{idea.legenda}</p></div>}
          {idea.cta && <p><b>CTA:</b> {idea.cta}</p>}
          {idea.captacao && <div><b>🎥 Para a captação:</b><p className="whitespace-pre-line text-muted-foreground">{idea.captacao}</p></div>}
          {idea.editedBy && <p className="text-xs text-muted-foreground">Editada por {idea.editedBy}</p>}
        </div>
      )}
      <div className="mt-auto flex flex-wrap gap-2 pt-4">
        {idea.status === "sugerida" && (
          <>
            <Button small variant="green" disabled={locked} onClick={onApprove}>✓ Aprovar</Button>
            <Button small variant="ghost" disabled={locked} onClick={onEdit}>✎ Editar</Button>
            <Button small variant="ghost" disabled={locked} onClick={onSwap} title="O Claude troca por outra pauta inédita do mesmo formato">↻ Trocar</Button>
            <Button small variant="danger" disabled={locked} onClick={onDiscard}>Descartar</Button>
          </>
        )}
        {idea.status === "aprovada" && <Button small variant="ghost" onClick={onOpen}>Abrir no projeto →</Button>}
        {idea.status === "descartada" && <Button small variant="ghost" disabled={locked} onClick={onReopen}>Reabrir</Button>}
      </div>
    </div>
  );
}

function EditIdea({ idea, mes, onClose, onSave }: { idea: PautaIdea; mes: string; onClose: () => void; onSave: (v: Partial<PautaIdea>) => Promise<void> }) {
  const [v, setV] = useState<PautaIdea>(idea);
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (k: keyof PautaIdea) => (x: string) => setV({ ...v, [k]: x });
  return (
    <Modal title="Editar pauta" onClose={onClose} wide>
      <div className="grid gap-3">
        <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr]">
          <Field label="Título" value={v.title} onChange={set("title")} />
          <Select label="Formato" value={v.type} onChange={set("type")} options={[{ value: "roteiro", label: "Reels" }, { value: "carrossel", label: "Carrossel" }, { value: "estatico", label: "Estático" }]} />
          <Field label="Data de postagem" type="date" value={v.postDate} onChange={set("postDate")} />
        </div>
        <Field label="Tema" value={v.tema} onChange={set("tema")} />
        <Field label="Objetivo" value={v.objetivo} onChange={set("objetivo")} />
        <Area label="Gancho" value={v.gancho} onChange={set("gancho")} rows={2} />
        <Area label={DEV_LABEL[v.type]} value={v.desenvolvimento} onChange={set("desenvolvimento")} rows={8} />
        <Area label="Legenda" value={v.legenda} onChange={set("legenda")} rows={4} />
        <Field label="CTA" value={v.cta} onChange={set("cta")} />
        <Area label="Para a captação" value={v.captacao} onChange={set("captacao")} rows={3} />
        {v.postDate && !v.postDate.startsWith(mes) && <p className="text-sm text-amber-300">A data precisa ficar dentro de {monthLabel(mes)}.</p>}
        {err && <p className="text-sm text-red-300">{err}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button disabled={saving} onClick={async () => { setSaving(true); setErr(""); try { await onSave(v); } catch (e: any) { setErr(e.message); setSaving(false); } }}>Salvar</Button>
        </div>
      </div>
    </Modal>
  );
}
