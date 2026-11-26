// Clientes: lista com logos e a página "pró" do cliente (capa, logo, paleta, visão geral, projetos,
// calendário do mês e dados). O cliente vê a própria página como "Início".
import { useEffect, useMemo, useState } from "react";
import { api, can, type Brand, type BrandColor, type Client, type Me } from "./api";
import {
  Area, Button, Card, ErrorText, Field, HUMANIZA_PALETTE, ImagePicker, Logo, Modal, Pill, Select, Skeleton, useLoad, useToast,
} from "./ui";
import { ProjectList } from "./Projects";
import { MonthCalendar } from "./Calendar";
import { ManagementTab, MetaConnections, PaidTab, PerformanceOverview, SyncButton, usePerformance } from "./Performance";
import { PlannerTab } from "./Planner";
import { PautaTab } from "./Pauta";

export const mainColor = (c?: Pick<Client, "brand" | "brandColor"> | null) => c?.brand?.colors?.[0]?.hex || c?.brandColor || "#5B56FF";

export function ClientsList({ me, go }: { me: Me; go: (p: string) => void }) {
  const { data, error, reload } = useLoad(api.clients);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("Ativo");
  const [creating, setCreating] = useState(false);
  const list = useMemo(
    () =>
      (data ?? []).filter(
        (c) => c.name.toLowerCase().includes(search.toLowerCase()) && (status === "Todos" || (c.status || "Ativo") === status),
      ),
    [data, search, status],
  );
  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Carteira</p>
          <h1 className="text-2xl font-extrabold sm:text-3xl">{me.role === "admin" ? "Clientes" : "Meus clientes"}</h1>
        </div>
        <div className="grid w-full grid-cols-2 items-end gap-2 sm:flex sm:w-auto sm:flex-wrap sm:gap-3">
          <Field label="Buscar" value={search} onChange={setSearch} placeholder="Nome do cliente" />
          <Select label="Status" value={status} onChange={setStatus} options={["Ativo", "Pausado", "Finalizado", "Todos"]} />
          {me.role === "admin" && <Button onClick={() => setCreating(true)}>+ Novo cliente</Button>}
        </div>
      </div>
      <ErrorText>{error}</ErrorText>
      {!data && !error && <Skeleton />}
      {data && list.length === 0 && <p className="text-muted-foreground">Nenhum cliente com esse filtro.</p>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {list.map((c) => (
          <button key={c._id} onClick={() => go(`cliente/${c._id}`)}
            className="group overflow-hidden rounded-lg border border-border bg-card text-left transition hover:-translate-y-0.5 hover:border-primary/60">
            <div className="brand-hero h-20" style={{ backgroundImage: c.coverUrl ? `url(${c.coverUrl})` : undefined, background: c.coverUrl ? undefined : `linear-gradient(120deg, ${mainColor(c)}, #1C1C1C)` }} />
            <div className="-mt-7 flex items-end gap-3 px-5">
              <div className="rounded-full border-4 border-card"><Logo name={c.name} url={c.logoUrl} color={mainColor(c)} size={56} /></div>
            </div>
            <div className="p-5 pt-3">
              <h2 className="text-lg font-bold group-hover:text-[#c9c7ff]">{c.name}</h2>
              <p className="text-xs text-muted-foreground">{c.serviceType || "Serviço não definido"}{c.instagram ? ` · ${c.instagram}` : ""}</p>
              <div className="mt-3 flex items-center justify-between">
                <Pill>{c.status || "Ativo"}</Pill>
                <span className="flex gap-1">
                  {(c.brand?.colors ?? []).slice(0, 5).map((col) => (
                    <span key={col.hex} className="h-4 w-4 rounded-full border border-white/20" style={{ background: col.hex }} title={col.name || col.hex} />
                  ))}
                </span>
              </div>
            </div>
          </button>
        ))}
      </div>
      {creating && <NewClient onClose={() => setCreating(false)} onDone={(id) => { setCreating(false); reload(); go(`cliente/${id}`); }} />}
    </div>
  );
}

function NewClient({ onClose, onDone }: { onClose: () => void; onDone: (id: string) => void }) {
  const [f, setF] = useState({ name: "", email: "", serviceType: "Pacote completo", instagram: "", whatsapp: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Modal title="Novo cliente" onClose={onClose}>
      <form className="grid gap-3" onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try { onDone((await api.createClient(f))._id); } catch (x) { setErr(x instanceof Error ? x.message : String(x)); setBusy(false); }
      }}>
        <Field label="Nome do cliente / marca" value={f.name} onChange={(v) => setF({ ...f, name: v })} required />
        <Field label="E-mail principal" type="email" value={f.email} onChange={(v) => setF({ ...f, email: v })} />
        <Select label="Serviço contratado" value={f.serviceType} onChange={(v) => setF({ ...f, serviceType: v })}
          options={["Pacote completo", "Somente captação", "Somente gerenciamento", "Captação + gerenciamento", "Personalizado", "Não definido"]} />
        <Field label="Instagram" value={f.instagram} onChange={(v) => setF({ ...f, instagram: v })} placeholder="@marca" />
        <Field label="WhatsApp" value={f.whatsapp} onChange={(v) => setF({ ...f, whatsapp: v })} placeholder="5543999999999" />
        <p className="text-xs text-muted-foreground">Logo, capa e paleta de cores você coloca na página do cliente, logo depois de salvar.</p>
        <ErrorText>{err}</ErrorText>
        <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button type="submit" disabled={busy}>{busy ? "Salvando…" : "Criar e abrir"}</Button></div>
      </form>
    </Modal>
  );
}

type Tab = "visao" | "gerenciamento" | "trafego" | "datas" | "proximos" | "projetos" | "calendario" | "identidade" | "dados";

export function ClientPage({ me, id, go }: { me: Me; id: string; go: (p: string) => void }) {
  const { data: c, error, reload } = useLoad(() => api.client(id), [id]);
  if (error) return <ErrorText>{error}</ErrorText>;
  if (!c) return <Skeleton rows={3} />;
  return <ClientPageBody me={me} c={c} go={go} reload={reload} />;
}

function ClientPageBody({ me, c, go, reload }: { me: Me; c: Client; go: (p: string) => void; reload: () => void }) {
  const [tab, setTab] = useState<Tab>("visao");
  const [toast, say] = useToast();
  const [connect, setConnect] = useState(false);
  const perf = usePerformance(c, me, me.role !== "team" || can(me, "resultados"));
  useEffect(() => {
    const m = new URLSearchParams(window.location.search).get("meta");
    if (!m) return;
    say(m === "ok" ? "Meta autorizado. Agora escolha as contas do cliente." : m === "cancelado" ? "Autorização do Meta cancelada." : "Não foi possível concluir a autorização do Meta.");
    if (m === "ok" && me.role === "admin") setConnect(true);
    window.history.replaceState(null, "", window.location.pathname + window.location.hash);
  }, []);
  const color = mainColor(c);
  const staff = me.role !== "client";
  // Equipe: só as abas das áreas liberadas em Acessos (o servidor também confere).
  const team = me.role === "team";
  const sees = {
    resultados: !team || can(me, "resultados"),
    calendario: !team || can(me, "calendario"),
    projetos: !team || can(me, "projetos"),
    pauta: !team || can(me, "pauta"),
  };
  const tabs: [Tab, string][] = ([
    ["visao", "Visão geral"],
    ...(sees.resultados ? [["gerenciamento", "Gerenciamento"], ["trafego", "Tráfego pago"]] : []),
    ...(sees.calendario ? [["datas", "Datas e campanhas"]] : []),
    ...(staff && sees.pauta ? [["proximos", "✨ Próximos conteúdos"]] : []),
    ...(sees.projetos ? [["projetos", "Projetos e roteiros"]] : []),
    ...(sees.calendario ? [["calendario", "Calendário"]] : []),
    ["identidade", "Identidade visual"],
    ...(me.role === "admin" ? [["dados", "Dados e equipe"]] : []),
  ] as [Tab, string][]);
  return (
    <div className="grid gap-6">
      {staff && <button onClick={() => go("clientes")} className="w-fit text-sm text-muted-foreground hover:text-foreground">← Clientes</button>}
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="relative">
          <div className="brand-hero h-28 sm:h-56"
            style={c.coverUrl ? { backgroundImage: `linear-gradient(to top, rgba(36,36,36,1), rgba(28,28,28,.15) 70%), url(${c.coverUrl})` } : { background: `radial-gradient(circle at 80% 20%, ${color}cc, transparent 55%), linear-gradient(120deg, #5B56FF55, #242424 70%)` }} />
          <div className="-mt-10 flex flex-wrap items-end gap-3 px-4 pb-4 sm:absolute sm:bottom-0 sm:left-0 sm:right-0 sm:mt-0 sm:gap-4 sm:px-5">
            <div className="rounded-full border-4 border-card"><Logo name={c.name} url={c.logoUrl} color={color} size={80} /></div>
            <div className="min-w-0 flex-1 basis-56">
              <p className="eyebrow">{c.serviceType || "Cliente Humaniza"}</p>
              <h1 className="break-words text-2xl font-extrabold leading-tight sm:text-4xl">{c.name}</h1>
              <p className="text-sm text-muted-foreground">
                {[c.instagram, c.responsibleName && `Resp.: ${c.responsibleName}`].filter(Boolean).join(" · ")}
              </p>
            </div>
            <div className="flex gap-1.5">
              {[...(c.brand?.colors ?? []).slice(0, 5)].map((col) => (
                <span key={col.hex} title={`${col.name || ""} ${col.hex}`} className="h-6 w-6 rounded-full border-2 border-white/30 sm:h-7 sm:w-7" style={{ background: col.hex }} />
              ))}
            </div>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto border-t border-border px-3">
          {tabs.map(([t, label]) => (
            <button key={t} onClick={() => setTab(t)}
              className={`whitespace-nowrap border-b-2 px-3 py-3 text-sm font-semibold ${tab === t ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              {label}
            </button>
          ))}
        </nav>
      </div>
      {staff && (
        <div className="no-print -mt-3 flex flex-wrap items-center justify-end gap-2">
          {me.role === "admin" && <SyncButton client={c} onDone={perf.reload} />}
          {me.role === "admin" && <Button small variant="ghost" onClick={() => setConnect(true)}>Conexões do Meta</Button>}
        </div>
      )}
      {tab === "visao" && (
        <div className="grid gap-8">
          {sees.resultados && <PerformanceOverview me={me} client={c} ctx={perf} goTab={(t) => setTab(t as Tab)} />}
          <Overview me={me} client={c} go={go} />
        </div>
      )}
      {tab === "gerenciamento" && sees.resultados && <ManagementTab me={me} client={c} ctx={perf} />}
      {tab === "trafego" && sees.resultados && <PaidTab me={me} client={c} ctx={perf} />}
      {connect && me.role === "admin" && <MetaConnections client={c} onClose={() => setConnect(false)} onDone={() => { setConnect(false); reload(); perf.reload(); say("Conexões salvas e dados sincronizados."); }} />}
      {tab === "datas" && sees.calendario && <PlannerTab me={me} client={c} />}
      {tab === "proximos" && staff && sees.pauta && <PautaTab me={me} client={c} go={go} />}
      {tab === "projetos" && sees.projetos && <ProjectList me={me} clientId={c._id} go={go} />}
      {tab === "calendario" && sees.calendario && <MonthCalendar me={me} clientId={c._id} go={go} />}
      {tab === "identidade" && <BrandEditor client={c} canEdit={staff && (!team || can(me, "identidade"))} onSaved={() => { reload(); say("Identidade visual salva."); }} />}
      {tab === "dados" && me.role === "admin" && <ClientData client={c} onSaved={() => { reload(); say("Dados salvos."); }} />}
      {toast}
    </div>
  );
}

function Overview({ me, client, go }: { me: Me; client: Client; go: (p: string) => void }) {
  const seesProjects = me.role !== "team" || can(me, "projetos");
  const projects = useLoad(() => (seesProjects ? api.projects(client._id) : Promise.resolve([])), [client._id]);
  const upcoming = useLoad(() => (seesProjects ? api.contents({ clientId: client._id }) : Promise.resolve([])), [client._id]);
  const today = new Date().toISOString().slice(0, 10);
  const next = (upcoming.data ?? []).filter((x) => x.postDate && x.postDate >= today).sort((a, b) => a.postDate.localeCompare(b.postDate)).slice(0, 6);
  const current = projects.data?.[0];
  const pending = (upcoming.data ?? []).filter((x) => x.status === "Aguardando aprovação" && !x.clientApproval).length;
  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <div className="grid content-start gap-6">
        {seesProjects && <>
        <Card>
          <p className="eyebrow">Projeto atual</p>
          {projects.loading && <p className="mt-2 text-sm text-muted-foreground">Carregando…</p>}
          {!projects.loading && !current && <p className="mt-2 text-sm text-muted-foreground">Nenhum projeto/mês ainda.</p>}
          {current && (
            <button onClick={() => go(`projeto/${current._id}`)} className="mt-2 w-full text-left">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-2xl font-extrabold">{current.period}</h2>
                <span className="text-sm text-[#c9c7ff]">Abrir →</span>
              </div>
              <StageBar p={current} />
              <p className="mt-3 text-sm text-muted-foreground">
                {current.total} conteúdos · {current.approved} aprovados · {current.adjustments} com ajuste
              </p>
            </button>
          )}
        </Card>
        <Card>
          <div className="flex items-center justify-between"><p className="eyebrow">Próximas postagens</p>{pending > 0 && <Pill>{`${pending} aguardando aprovação`}</Pill>}</div>
          {next.length === 0 && <p className="mt-2 text-sm text-muted-foreground">Nada agendado a partir de hoje.</p>}
          <ul className="mt-3 grid gap-2">
            {next.map((x) => (
              <li key={x._id}>
                <button onClick={() => go(`projeto/${x.projectId}`)} className="flex w-full items-center gap-3 rounded-control border border-border p-3 text-left hover:border-primary/60">
                  <span className="w-14 text-center"><b className="block text-lg leading-none">{x.postDate.slice(8, 10)}</b><span className="text-xs text-muted-foreground">{new Date(x.postDate + "T12:00").toLocaleDateString("pt-BR", { month: "short" })}</span></span>
                  <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{x.title || "Sem tema"}</span><span className="text-xs text-muted-foreground">{x.type === "roteiro" ? "Reels" : x.type === "carrossel" ? "Carrossel" : "Estático"}</span></span>
                  <Pill>{x.clientApproval || x.status || "Em criação"}</Pill>
                </button>
              </li>
            ))}
          </ul>
        </Card>
        </>}
      </div>
      <div className="grid content-start gap-6">
        <BrandCard client={client} />
        {me.role !== "client" && (
          <Card>
            <p className="eyebrow">Contato</p>
            <dl className="mt-2 grid gap-1 text-sm">
              <Row k="Responsável" v={client.responsibleName} />
              <Row k="WhatsApp" v={client.whatsapp || client.responsiblePhone} />
              <Row k="E-mail" v={client.email} />
              <Row k="Serviço" v={[client.serviceType, client.serviceCustom].filter(Boolean).join(" — ")} />
              {client.driveUrl && <a className="text-[#c9c7ff] underline" href={client.driveUrl} target="_blank" rel="noreferrer">Abrir pasta do Drive</a>}
            </dl>
            {client.notes && <p className="mt-3 whitespace-pre-wrap rounded-control bg-secondary p-3 text-sm text-muted-foreground">{client.notes}</p>}
          </Card>
        )}
      </div>
    </div>
  );
}
const Row = ({ k, v }: { k: string; v?: string | null }) => (v ? <div className="flex justify-between gap-4"><dt className="text-muted-foreground">{k}</dt><dd className="text-right">{v}</dd></div> : null);

export function StageBar({ p }: { p: { strategicStatus: string; productionStatus: string; calendarStatus: string; approvalStatus: string } }) {
  const steps: [string, string][] = [["Planejamento", p.strategicStatus], ["Desenvolvimento", p.productionStatus], ["Calendário", p.calendarStatus], ["Aprovação", p.approvalStatus]];
  const done = (s: string) => s === "Aprovado" || s === "Finalizado";
  return (
    <div className="mt-3 grid grid-cols-4 gap-1">
      {steps.map(([label, s]) => (
        <div key={label}>
          <div className={`h-1.5 rounded-full ${done(s) ? "bg-emerald-400" : !s || s === "Bloqueado" ? "bg-white/10" : s.includes("Ajuste") ? "bg-amber-400" : "bg-primary"}`} />
          <p className="mt-1 truncate text-[11px] text-muted-foreground">{label}</p>
        </div>
      ))}
    </div>
  );
}

function BrandCard({ client }: { client: Client }) {
  const b = client.brand;
  return (
    <Card>
      <p className="eyebrow">Identidade da marca</p>
      <div className="mt-3 flex h-16 overflow-hidden rounded-control border border-border">
        {(b?.colors?.length ? b.colors : [{ hex: "#5B56FF", name: "Roxo Humaniza", role: "" }]).map((c) => (
          <div key={c.hex} className="flex flex-1 items-end p-1.5 text-[10px] font-semibold" style={{ background: c.hex, color: contrast(c.hex) }}>{c.hex}</div>
        ))}
      </div>
      {b?.useHumanizaPalette !== false && (
        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <span>Combina com:</span>
          {HUMANIZA_PALETTE.slice(0, 3).map((c) => <span key={c.hex} className="h-3.5 w-3.5 rounded-full border border-white/20" style={{ background: c.hex }} title={c.name} />)}
          <span>paleta Humaniza</span>
        </div>
      )}
      {b?.fonts && <p className="mt-3 text-sm"><span className="text-muted-foreground">Fontes:</span> {b.fonts}</p>}
      {b?.tone && <p className="mt-1 text-sm"><span className="text-muted-foreground">Tom de voz:</span> {b.tone}</p>}
      {!b?.colors?.length && <p className="mt-2 text-xs text-muted-foreground">Paleta ainda não cadastrada.</p>}
    </Card>
  );
}

export function contrast(hex: string) {
  const h = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? "#111" : "#fff";
}

function BrandEditor({ client, canEdit, onSaved }: { client: Client; canEdit: boolean; onSaved: () => void }) {
  const empty: Brand = { colors: [], fonts: "", tone: "", notes: "", useHumanizaPalette: true };
  const [brand, setBrand] = useState<Brand>({ ...empty, ...(client.brand ?? {}) });
  const [logoUrl, setLogo] = useState(client.logoUrl ?? "");
  const [coverUrl, setCover] = useState(client.coverUrl ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const setColor = (i: number, c: Partial<BrandColor>) => setBrand({ ...brand, colors: brand.colors.map((x, j) => (j === i ? { ...x, ...c } : x)) });
  const roles = ["Principal", "Secundária", "Destaque", "Fundo", "Texto"];
  if (!canEdit) return <BrandCard client={client} />;
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <h2 className="text-lg font-bold">Logo e capa</h2>
        <div className="mt-4 flex items-center gap-4">
          <Logo name={client.name} url={logoUrl} color={brand.colors[0]?.hex} size={84} />
          <div className="grid gap-2">
            <ImagePicker label={logoUrl ? "Trocar logo" : "Enviar logo"} onUploaded={setLogo} />
            {logoUrl && <button className="text-left text-xs text-muted-foreground underline" onClick={() => setLogo("")}>Remover logo</button>}
          </div>
        </div>
        <div className="brand-hero mt-5 flex h-32 items-end rounded-control border border-border p-3"
          style={coverUrl ? { backgroundImage: `url(${coverUrl})` } : { background: `linear-gradient(120deg, ${brand.colors[0]?.hex || "#5B56FF"}, #1C1C1C)` }}>
          <ImagePicker label={coverUrl ? "Trocar capa" : "Enviar imagem de capa"} onUploaded={setCover} />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Capa ideal: foto horizontal (1600×600). Logo: PNG com fundo transparente.</p>
      </Card>
      <Card>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Paleta do cliente</h2>
          {brand.colors.length < 8 && <Button small variant="ghost" onClick={() => setBrand({ ...brand, colors: [...brand.colors, { hex: "#5B56FF", name: "", role: roles[brand.colors.length] ?? "" }] })}>+ Cor</Button>}
        </div>
        {brand.colors.length === 0 && <p className="mt-3 text-sm text-muted-foreground">Adicione as cores da marca. A primeira vira a cor principal da página do cliente.</p>}
        <div className="mt-3 grid gap-2">
          {brand.colors.map((c, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2 rounded-control border border-border p-2">
              <input type="color" value={c.hex} onChange={(e) => setColor(i, { hex: e.target.value.toUpperCase() })} className="h-10 w-12 cursor-pointer rounded border-0 bg-transparent" />
              <input value={c.hex} onChange={(e) => setColor(i, { hex: e.target.value })} className="w-24 rounded border border-border bg-secondary p-1.5 font-mono text-sm" />
              <input value={c.name} placeholder="Nome (ex.: Verde-oliva)" onChange={(e) => setColor(i, { name: e.target.value })} className="min-w-0 flex-1 rounded border border-border bg-secondary p-1.5 text-sm" />
              <select value={c.role} onChange={(e) => setColor(i, { role: e.target.value })} className="rounded border border-border bg-secondary p-1.5 text-sm">
                <option value="">Função…</option>{roles.map((r) => <option key={r}>{r}</option>)}
              </select>
              <button className="px-2 text-muted-foreground hover:text-red-300" onClick={() => setBrand({ ...brand, colors: brand.colors.filter((_, j) => j !== i) })} aria-label="Remover cor">×</button>
            </div>
          ))}
        </div>
        <label className="mt-4 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={brand.useHumanizaPalette} onChange={(e) => setBrand({ ...brand, useHumanizaPalette: e.target.checked })} />
          Combinar com a paleta Humaniza
          <span className="flex gap-1">{HUMANIZA_PALETTE.map((c) => <span key={c.hex} className="h-4 w-4 rounded-full border border-white/20" style={{ background: c.hex }} title={c.name} />)}</span>
        </label>
        {brand.colors.length > 0 && (
          <div className="mt-4 overflow-hidden rounded-control border border-border">
            <p className="bg-secondary px-3 py-1.5 text-xs text-muted-foreground">Prévia combinada</p>
            <div className="flex h-12">
              {[...brand.colors.map((c) => c.hex), ...(brand.useHumanizaPalette ? ["#5B56FF", "#1C1C1C", "#F2F2F0"] : [])].map((h, i) => <div key={i} className="flex-1" style={{ background: h }} />)}
            </div>
          </div>
        )}
      </Card>
      <Card className="lg:col-span-2">
        <h2 className="text-lg font-bold">Tipografia e tom</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <Field label="Fontes da marca" value={brand.fonts} onChange={(v) => setBrand({ ...brand, fonts: v })} placeholder="Ex.: Montserrat / Playfair Display" />
          <Area label="Tom de voz" value={brand.tone} onChange={(v) => setBrand({ ...brand, tone: v })} rows={2} placeholder="Ex.: acolhedor, técnico sem ser frio" />
          <Area label="Observações de identidade" value={brand.notes} onChange={(v) => setBrand({ ...brand, notes: v })} rows={2} placeholder="O que evitar, referências…" />
        </div>
        <ErrorText>{err}</ErrorText>
        <div className="mt-4 flex justify-end">
          <Button disabled={busy} onClick={async () => {
            setBusy(true); setErr("");
            try { await api.updateClient(client._id, { brand, logoUrl, coverUrl }); onSaved(); } catch (x) { setErr(x instanceof Error ? x.message : String(x)); } finally { setBusy(false); }
          }}>{busy ? "Salvando…" : "Salvar identidade visual"}</Button>
        </div>
      </Card>
    </div>
  );
}

function ClientData({ client, onSaved }: { client: Client; onSaved: () => void }) {
  const team = useLoad(api.team);
  const [f, setF] = useState({
    name: client.name ?? "", email: client.email ?? "", status: client.status ?? "Ativo", serviceType: client.serviceType ?? "", serviceCustom: client.serviceCustom ?? "",
    instagram: client.instagram ?? "", responsibleName: client.responsibleName ?? "", whatsapp: client.whatsapp ?? "", driveUrl: client.driveUrl ?? "", notes: client.notes ?? "",
  });
  const [teamEmails, setTeam] = useState<string[]>(client.teamEmails ?? []);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k: keyof typeof f) => (v: string) => setF({ ...f, [k]: v });
  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <Card>
        <h2 className="text-lg font-bold">Dados do cliente</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Nome" value={f.name} onChange={set("name")} required />
          <Field label="E-mail" value={f.email} onChange={set("email")} type="email" />
          <Select label="Status" value={f.status} onChange={set("status")} options={["Ativo", "Pausado", "Finalizado"]} />
          <Select label="Serviço" value={f.serviceType} onChange={set("serviceType")} options={["", "Pacote completo", "Somente captação", "Somente gerenciamento", "Captação + gerenciamento", "Personalizado", "Não definido"]} />
          <Field label="Detalhe do serviço" value={f.serviceCustom} onChange={set("serviceCustom")} className="sm:col-span-2" />
          <Field label="Instagram" value={f.instagram} onChange={set("instagram")} />
          <Field label="Responsável na Humaniza" value={f.responsibleName} onChange={set("responsibleName")} />
          <Field label="WhatsApp" value={f.whatsapp} onChange={set("whatsapp")} />
          <Field label="Pasta do Drive (link)" value={f.driveUrl} onChange={set("driveUrl")} />
          <div className="sm:col-span-2"><Area label="Observação interna (o cliente não vê)" value={f.notes} onChange={set("notes")} rows={4} /></div>
        </div>
      </Card>
      <Card>
        <h2 className="text-lg font-bold">Equipe que atende</h2>
        <p className="mt-1 text-xs text-muted-foreground">Só quem estiver marcado (e os administradores) enxerga este cliente, os projetos e os roteiros.</p>
        <div className="mt-3 grid gap-2">
          {team.data?.filter((u) => u.role === "team").map((u) => (
            <label key={u._id} className="flex items-center gap-2 rounded-control border border-border p-2 text-sm">
              <input type="checkbox" checked={teamEmails.includes(u.email)} onChange={(e) => setTeam(e.target.checked ? [...teamEmails, u.email] : teamEmails.filter((x) => x !== u.email))} />
              <span className="flex-1">{u.name}</span><span className="text-xs text-muted-foreground">{u.jobTitle}</span>
            </label>
          ))}
          {team.data && !team.data.some((u) => u.role === "team") && <p className="text-sm text-muted-foreground">Nenhuma pessoa de equipe cadastrada. Libere em Acessos.</p>}
        </div>
        <ErrorText>{err}</ErrorText>
        <div className="mt-4 flex justify-end">
          <Button disabled={busy} onClick={async () => {
            setBusy(true); setErr("");
            try { await api.updateClient(client._id, { ...f, teamEmails } as any); onSaved(); } catch (x) { setErr(x instanceof Error ? x.message : String(x)); } finally { setBusy(false); }
          }}>{busy ? "Salvando…" : "Salvar dados"}</Button>
        </div>
      </Card>
    </div>
  );
}
