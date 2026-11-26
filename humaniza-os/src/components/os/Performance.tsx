// Desempenho do cliente: filtro de período, gráfico de evolução, Visão geral (o que entregou, o que
// trouxe resultado, próximo passo), Gerenciamento, Tráfego pago, revisão da equipe e conexões do Meta.
// Dado ausente nunca vira zero: aparece como "Dado indisponível" / "Sem dados no período".
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api, type Client, type Me, type MetaStatus, type Performance, type Post, type Suggestion2 } from "./api";
import { Area, Button, Card, ErrorText, Field, Modal, Pill, Select, Skeleton, brDate, useLoad, useToast } from "./ui";

/* ---------------- formatação ---------------- */
const nf = (v: number | null | undefined, d = 0) => (v === null || v === undefined ? null : v.toLocaleString("pt-BR", { maximumFractionDigits: d, minimumFractionDigits: d }));
const brl = (v: number | null | undefined) => (v === null || v === undefined ? null : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
const pct = (v: number | null | undefined) => (v === null || v === undefined ? null : `${(v * 100).toFixed(1).replace(".", ",")}%`);
const variation = (cur: number | null | undefined, prev: number | null | undefined) => (cur === null || cur === undefined || !prev ? null : (cur - prev) / prev);
const dt = (iso: string) => (iso ? new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "");

/* ---------------- período ---------------- */
export type Period = { de: string; ate: string; label: string; preset: string };
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const todayIso = () => iso(new Date());
export function presetPeriod(preset: string, base = new Date()): Period {
  const y = base.getFullYear(), m = base.getMonth(), d = base.getDate();
  const t = todayIso();
  const clip = (x: string) => (x > t ? t : x);
  const mlabel = (dd: Date) => dd.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  switch (preset) {
    case "mes-anterior": { const s = new Date(y, m - 1, 1), e = new Date(y, m, 0); return { de: iso(s), ate: iso(e), label: mlabel(s), preset }; }
    case "ciclo": { const s = d >= 20 ? new Date(y, m, 20) : new Date(y, m - 1, 20); const e = new Date(s.getFullYear(), s.getMonth() + 1, 19); return { de: iso(s), ate: clip(iso(e)), label: `Ciclo ${brDate(iso(s)).slice(0, 5)} a ${brDate(iso(e)).slice(0, 5)}`, preset }; }
    case "ciclo-anterior": { const cur = presetPeriod("ciclo", base); const s = new Date(cur.de + "T12:00"); s.setMonth(s.getMonth() - 1); const e = new Date(cur.de + "T12:00"); e.setDate(e.getDate() - 1); return { de: iso(s), ate: iso(e), label: `Ciclo ${brDate(iso(s)).slice(0, 5)} a ${brDate(iso(e)).slice(0, 5)}`, preset }; }
    default: { const s = new Date(y, m, 1); return { de: iso(s), ate: t, label: mlabel(s), preset: "mes" }; }
  }
}

export function PeriodBar({ period, onChange, publishedOnly }: { period: Period; onChange: (p: Period) => void; publishedOnly?: { periodKey: string }[] }) {
  const [custom, setCustom] = useState({ de: period.de, ate: period.ate });
  if (publishedOnly) {
    return (
      <Select label="Período" value={`${period.de}_${period.ate}`} onChange={(v) => { const [de, ate] = v.split("_"); onChange({ de, ate, label: `${brDate(de)} a ${brDate(ate)}`, preset: "custom" }); }}
        options={publishedOnly.length ? publishedOnly.map((r) => { const [de, ate] = r.periodKey.split("_"); return { value: r.periodKey, label: `${brDate(de)} a ${brDate(ate)}` }; }) : [{ value: `${period.de}_${period.ate}`, label: "Nenhum período liberado ainda" }]} />
    );
  }
  return (
    <div className="flex flex-wrap items-end gap-2">
      <Select label="Período" value={period.preset} onChange={(v) => (v === "custom" ? onChange({ ...period, preset: "custom" }) : onChange(presetPeriod(v)))}
        options={[{ value: "mes", label: "Este mês" }, { value: "mes-anterior", label: "Mês anterior" }, { value: "ciclo", label: "Ciclo 20 a 20 (atual)" }, { value: "ciclo-anterior", label: "Ciclo 20 a 20 (anterior)" }, { value: "custom", label: "Intervalo personalizado" }]} />
      {period.preset === "custom" && (
        <>
          <Field label="De" type="date" value={custom.de} onChange={(v) => setCustom({ ...custom, de: v })} />
          <Field label="Até" type="date" value={custom.ate} onChange={(v) => setCustom({ ...custom, ate: v })} />
          <Button small onClick={() => custom.de && custom.ate && custom.de <= custom.ate && onChange({ de: custom.de, ate: custom.ate, label: `${brDate(custom.de)} a ${brDate(custom.ate)}`, preset: "custom" })}>Aplicar</Button>
        </>
      )}
    </div>
  );
}

/** Carrega o desempenho do período escolhido (compartilhado entre as abas do cliente). */
export function usePerformance(client: Client, me: Me) {
  const isClient = me.role === "client";
  const reports = useLoad(() => (isClient ? api.reports(client._id) : Promise.resolve([])), [client._id]);
  const [period, setPeriod] = useState<Period>(presetPeriod("mes"));
  useEffect(() => {
    if (isClient && reports.data?.length) {
      const [de, ate] = reports.data[0].periodKey.split("_");
      setPeriod({ de, ate, label: `${brDate(de)} a ${brDate(ate)}`, preset: "custom" });
    }
  }, [reports.data, isClient]);
  const [tick, setTick] = useState(0);
  const perf = useLoad(() => api.performance(client._id, period.de, period.ate), [client._id, period.de, period.ate, tick]);
  return { period, setPeriod, perf, reload: () => setTick((t) => t + 1), published: isClient ? reports.data ?? [] : undefined };
}

/* ---------------- peças ---------------- */
function SourceTag({ children }: { children: string }) {
  return <span className="mt-1 inline-block rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">{children}</span>;
}
export function Kpi({ label, value, prev, current, source, invert, hint, empty = "Dado indisponível" }: {
  label: string; value: string | null; prev?: number | null; current?: number | null; source: string; invert?: boolean; hint?: string; empty?: string;
}) {
  const v = variation(current, prev);
  const good = v === null ? null : invert ? v <= 0 : v >= 0;
  return (
    <div className="rounded-lg border border-border bg-card p-4" title={hint}>
      <p className="text-xs text-muted-foreground">{label}</p>
      {value === null ? <p className="mt-1 text-sm font-semibold text-muted-foreground">{empty}</p> : <p className="mt-1 text-2xl font-extrabold tabular-nums">{value}</p>}
      {v !== null && value !== null && (
        <p className={`text-xs font-semibold ${good ? "text-emerald-300" : "text-amber-300"}`}>{v >= 0 ? "▲" : "▼"} {Math.abs(v * 100).toFixed(0)}% vs período anterior</p>
      )}
      <SourceTag>{source}</SourceTag>
    </div>
  );
}

/** Gráfico de linha leve e acessível: período atual (roxo) x anterior (cinza tracejado). */
export function EvolutionChart({ points, prevPoints = [], format, title, dates }: { points: (number | null)[]; prevPoints?: (number | null)[]; format: (v: number) => string; title: string; dates: string[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const all = [...points, ...prevPoints].filter((x): x is number => typeof x === "number");
  if (!all.length) return <div className="flex h-48 items-center justify-center rounded-control border border-dashed border-border text-sm text-muted-foreground">Sem dados no período</div>;
  const max = Math.max(...all) * 1.1 || 1;
  const W = 600, H = 200, n = Math.max(points.length, 2);
  const x = (i: number) => (i / (n - 1)) * W;
  const y = (v: number) => H - (v / max) * H;
  const path = (arr: (number | null)[]) => {
    let d = "", pen = false;
    arr.forEach((v, i) => {
      if (v === null || v === undefined) { pen = false; return; }
      d += `${pen ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)} `;
      pen = true;
    });
    return d;
  };
  const move = (clientX: number) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const i = Math.round(((clientX - r.left) / r.width) * (n - 1));
    setHover(Math.min(points.length - 1, Math.max(0, i)));
  };
  const ticks = [0, 0.5, 1].map((f) => max * f);
  return (
    <figure>
      <figcaption className="mb-2 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">{title}</span>
        <span className="flex items-center gap-1"><i className="h-0.5 w-5 bg-primary" />Período atual</span>
        {prevPoints.length > 0 && <span className="flex items-center gap-1"><i className="h-0.5 w-5 border-t-2 border-dashed border-[#8a8a8a]" />Período anterior</span>}
      </figcaption>
      <div className="flex gap-2">
        <div className="flex h-48 flex-col justify-between py-0.5 text-right text-[10px] text-muted-foreground tabular-nums">{[...ticks].reverse().map((t, i) => <span key={i}>{format(t)}</span>)}</div>
        <div ref={ref} className="relative h-48 flex-1 touch-none" onPointerMove={(e) => move(e.clientX)} onPointerDown={(e) => move(e.clientX)} onPointerLeave={() => setHover(null)}>
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible" role="img" aria-label={title}>
            {ticks.map((t, i) => <line key={i} x1="0" x2={W} y1={y(t)} y2={y(t)} stroke="#333" strokeWidth="1" vectorEffect="non-scaling-stroke" />)}
            {prevPoints.length > 0 && <path d={path(prevPoints)} fill="none" stroke="#8a8a8a" strokeWidth="2" strokeDasharray="5 4" vectorEffect="non-scaling-stroke" />}
            <path d={path(points)} fill="none" stroke="#5B56FF" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
            {hover !== null && <line x1={x(hover)} x2={x(hover)} y1="0" y2={H} stroke="#F2F2F0" strokeOpacity="0.4" vectorEffect="non-scaling-stroke" />}
          </svg>
          {hover !== null && (
            <div className="pointer-events-none absolute top-0 z-10 rounded-control border border-border bg-[#161616] px-3 py-2 text-xs shadow-xl"
              style={{ left: `${(hover / (n - 1)) * 100}%`, transform: hover > (n - 1) / 2 ? "translateX(-105%)" : "translateX(5%)" }}>
              <p className="font-semibold">{brDate(dates[hover])}</p>
              <p>Atual: <b>{points[hover] === null || points[hover] === undefined ? "sem dado" : format(points[hover]!)}</b></p>
              {prevPoints.length > 0 && <p className="text-muted-foreground">Anterior: {prevPoints[hover] === null || prevPoints[hover] === undefined ? "sem dado" : format(prevPoints[hover]!)}</p>}
            </div>
          )}
        </div>
      </div>
      <div className="ml-10 mt-1 flex justify-between text-[10px] text-muted-foreground"><span>{brDate(dates[0]).slice(0, 5)}</span><span>{brDate(dates[dates.length - 1]).slice(0, 5)}</span></div>
    </figure>
  );
}

const STATE_LABEL: Record<string, string> = { ok: "Sincronizado", pendente: "Atualização pendente", erro: "Erro na conexão", aguardando: "Conta aguardando conexão" };
export function ConnectionChips({ perf, staff }: { perf: Performance; staff: boolean }) {
  const c = perf.connections;
  if (!c) return null;
  const chip = (name: string, s: any) => (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${s.state === "ok" ? "border-emerald-500/40 text-emerald-300" : s.state === "pendente" ? "border-amber-400/40 text-amber-300" : "border-border text-muted-foreground"}`}
      title={s.message || ""}>
      <i className={`h-1.5 w-1.5 rounded-full ${s.state === "ok" ? "bg-emerald-400" : s.state === "pendente" ? "bg-amber-400" : "bg-white/30"}`} />
      {name}{s.label ? ` ${s.label}` : ""}: {s.linked ? STATE_LABEL[s.state] : "Conta aguardando conexão"}
      {s.lastSuccess ? ` · última sincronização ${dt(s.lastSuccess)}` : ""}
    </span>
  );
  return (
    <div className="flex flex-wrap gap-2">
      {chip("Instagram", c.instagram)}
      {chip("Anúncios", c.ads)}
      {staff && c.instagram.state === "pendente" && c.instagram.message && <span className="text-xs text-amber-300">{c.instagram.message}</span>}
      {staff && c.ads.state === "pendente" && c.ads.message && <span className="text-xs text-amber-300">{c.ads.message}</span>}
    </div>
  );
}

function Coverage({ c }: { c?: { days: number; withData: number } }) {
  if (!c || c.withData === c.days) return null;
  return <p className="text-xs text-amber-300">Dados parciais: {c.withData} de {c.days} dias sincronizados.</p>;
}

/* ---------------- Visão geral ---------------- */
export function PerformanceOverview({ me, client, ctx, goTab }: { me: Me; client: Client; ctx: ReturnType<typeof usePerformance>; goTab: (t: string) => void }) {
  const staff = me.role !== "client";
  const { perf, period, setPeriod } = ctx;
  const p = perf.data;
  const [metric, setMetric] = useState("reach");
  const head = (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <PeriodBar period={period} onChange={setPeriod} publishedOnly={staff ? undefined : ctx.published} />
      {p && <ConnectionChips perf={p} staff={staff} />}
    </div>
  );
  if (perf.error) return <div className="grid gap-4">{head}<ErrorText>{perf.error}</ErrorText></div>;
  if (!p) return <div className="grid gap-4">{head}<Skeleton rows={2} /></div>;
  if (!staff && !p.published) return <div className="grid gap-4">{head}<Card><p className="text-sm text-muted-foreground">{p.message}</p></Card></div>;
  const ig = p.instagram, pig = p.previousInstagram, ads = p.ads, pads = p.previousAds, del = p.delivery!;
  const best = ig ? [...ig.posts].filter((x) => x.interactions !== null && x.type !== "Story").sort((a, b) => (b.interactions ?? 0) - (a.interactions ?? 0)).slice(0, 3) : [];
  const steps = (p.report?.suggestions ?? []).filter((s) => staff || s.approved);
  const metricDefs: Record<string, { label: string; get: (r: any) => number | null; fmt: (v: number) => string; prev?: any[]; cur?: any[] }> = {
    reach: { label: "Alcance por dia (Instagram)", get: (r) => r.reach ?? null, fmt: (v) => nf(v)! },
    views: { label: "Visualizações por dia (Instagram)", get: (r) => r.views ?? null, fmt: (v) => nf(v)! },
    total_interactions: { label: "Interações por dia (Instagram)", get: (r) => r.total_interactions ?? null, fmt: (v) => nf(v)! },
    spend: { label: "Investimento por dia (Meta Ads)", get: (r) => r.spend ?? null, fmt: (v) => brl(v)! },
  };
  const def = metricDefs[metric];
  const curSeries = metric === "spend" ? ads?.series ?? [] : ig?.series ?? [];
  const prevSeries = metric === "spend" ? pads?.series ?? [] : pig?.series ?? [];
  return (
    <div className="grid gap-6">
      {head}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <p className="eyebrow">1 · O que a Humaniza entregou</p>
          <p className="mt-2 text-3xl font-extrabold tabular-nums">{del.total}<span className="ml-2 text-sm font-semibold text-muted-foreground">conteúdos no período</span></p>
          <p className="text-sm text-muted-foreground">{del.byType.filter((t) => t.count).map((t) => `${t.count} ${t.type === "roteiro" ? "Reels" : t.type === "carrossel" ? "carrosséis" : "estáticos"}`).join(" · ") || "Nenhum conteúdo com data neste período"}</p>
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-control bg-secondary p-2"><b className="tabular-nums">{del.postedInternal}</b> marcados como postados<SourceTag>Humaniza OS (status interno)</SourceTag></div>
            <div className="rounded-control bg-secondary p-2"><b className="tabular-nums">{ig ? del.confirmedByInstagram : "—"}</b> confirmados no Instagram<SourceTag>{ig ? "Instagram (Meta)" : "Conta aguardando conexão"}</SourceTag></div>
          </div>
        </Card>
        <Card>
          <p className="eyebrow">2 · O que trouxe resultado</p>
          {best[0] ? (
            <a href={best[0].permalink} target="_blank" rel="noreferrer" className="mt-2 flex gap-3">
              {best[0].thumb && <img src={best[0].thumb} alt="" className="h-20 w-16 shrink-0 rounded object-cover" />}
              <span className="text-sm"><b>{best[0].type} de {brDate(best[0].date)}</b><br />{nf(best[0].interactions)} interações · {nf(best[0].reach) ?? "alcance indisponível"} de alcance<br /><span className="text-xs text-muted-foreground">Conteúdo com mais interações</span></span>
            </a>
          ) : <p className="mt-2 text-sm text-muted-foreground">{ig ? "Sem publicações no período." : "Conta do Instagram aguardando conexão."}</p>}
          {ads?.campaigns.find((c) => c.costPerResult !== null) && (() => {
            const c = [...ads.campaigns].filter((x) => x.costPerResult !== null).sort((a, b) => a.costPerResult! - b.costPerResult!)[0];
            return <p className="mt-3 rounded-control bg-secondary p-2 text-sm">📣 <b>{c.name}</b>: {nf(c.results)} {c.resultLabel.toLowerCase()} a {brl(c.costPerResult)} cada<SourceTag>Gerenciador de Anúncios (Meta)</SourceTag></p>;
          })()}
        </Card>
        <Card>
          <p className="eyebrow">3 · Próximo passo</p>
          <ul className="mt-2 grid gap-2 text-sm">
            {(p.report?.nextSteps ?? []).filter((s) => !s.done).slice(0, 3).map((s, i) => <li key={i}>→ {s.text}</li>)}
            {!(p.report?.nextSteps ?? []).some((s) => !s.done) && steps.filter((s) => s.kind === "teste" || s.kind === "melhorar").slice(0, 2).map((s) => <li key={s.id}>→ {s.text}</li>)}
            {!(p.report?.nextSteps ?? []).length && !steps.length && <li className="text-muted-foreground">{staff ? "Revise as sugestões abaixo e aprove os próximos passos." : "A equipe vai publicar os próximos passos aqui."}</li>}
          </ul>
          {p.upcoming?.[0] && <p className="mt-3 rounded-control border border-primary/40 p-2 text-sm">📌 Próxima data: <b>{p.upcoming[0].title}</b> em {brDate(p.upcoming[0].date)}</p>}
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <Kpi label="Seguidores" value={ig ? nf(ig.followers) : null} current={ig?.followers} prev={pig?.followers} source="Instagram (Meta)" empty={ig ? "Dado indisponível" : "Conta aguardando conexão"} />
        <Kpi label="Alcance diário médio" value={ig ? nf(ig.totals.reachDailyAvg) : null} current={ig?.totals.reachDailyAvg} prev={pig?.totals.reachDailyAvg} source="Instagram (Meta)" hint="Média de contas alcançadas por dia no período" empty={ig ? "Sem dados no período" : "Conta aguardando conexão"} />
        <Kpi label="Visualizações" value={ig ? nf(ig.totals.views) : null} current={ig?.totals.views} prev={pig?.totals.views} source="Instagram (Meta)" empty={ig ? "Sem dados no período" : "Conta aguardando conexão"} />
        <Kpi label="Interações" value={ig ? nf(ig.totals.total_interactions) : null} current={ig?.totals.total_interactions} prev={pig?.totals.total_interactions} source="Instagram (Meta)" empty={ig ? "Sem dados no período" : "Conta aguardando conexão"} />
        <Kpi label="Investimento em anúncios" value={ads ? brl(ads.totals.spend) : null} current={ads?.totals.spend} prev={pads?.totals.spend} source="Gerenciador de Anúncios (Meta)" empty={ads ? "Sem dados no período" : "Conta aguardando conexão"} />
        <Kpi label="Conversas pelos anúncios" value={ads ? nf(ads.totals.conversations) : null} current={ads?.totals.conversations} prev={pads?.totals.conversations} source="Gerenciador de Anúncios (Meta)" empty={ads ? "Dado indisponível" : "Conta aguardando conexão"} />
      </div>

      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="eyebrow">Evolução no período</p>
          <select value={metric} onChange={(e) => setMetric(e.target.value)} className="rounded-control border border-border bg-secondary p-1.5 text-sm">
            {Object.entries(metricDefs).map(([k, d]) => <option key={k} value={k}>{d.label}</option>)}
          </select>
        </div>
        <EvolutionChart title={def.label} dates={curSeries.map((r: any) => r.date)} points={curSeries.map(def.get)} prevPoints={prevSeries.map(def.get)} format={def.fmt} />
        <Coverage c={metric === "spend" ? ads?.coverage : ig?.coverage} />
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <Card>
          <div className="flex items-center justify-between"><p className="eyebrow">Conteúdos em destaque</p><Button small variant="ghost" onClick={() => goTab("gerenciamento")}>Gerenciamento →</Button></div>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">{best.map((x, i) => <PostTile key={x.id} p={x} badge={`#${i + 1} em interações`} />)}</div>
          {!best.length && <p className="mt-2 text-sm text-muted-foreground">{ig ? "Sem publicações no período." : "Conta aguardando conexão."}</p>}
        </Card>
        <Card>
          <div className="flex items-center justify-between"><p className="eyebrow">Próximas datas</p><Button small variant="ghost" onClick={() => goTab("datas")}>Datas e campanhas →</Button></div>
          <ul className="mt-3 grid gap-2">
            {(p.upcoming ?? []).map((u) => (
              <li key={u._id} className="flex items-center gap-3 rounded-control border border-border p-2 text-sm">
                <span className="w-12 text-center"><b className="block leading-none">{u.date.slice(8)}</b><span className="text-[11px] text-muted-foreground">{new Date(u.date + "T12:00").toLocaleDateString("pt-BR", { month: "short" })}</span></span>
                <span className="min-w-0 flex-1"><b className="block truncate">{u.title}</b><span className="text-xs text-muted-foreground">{u.kind} · {u.status}</span></span>
              </li>
            ))}
            {!(p.upcoming ?? []).length && <li className="text-sm text-muted-foreground">Nenhuma data liberada para os próximos 60 dias.</li>}
          </ul>
        </Card>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="ghost" onClick={() => goTab("gerenciamento")}>📱 Gerenciamento</Button>
        <Button variant="ghost" onClick={() => goTab("trafego")}>📣 Tráfego pago</Button>
        <Button variant="ghost" onClick={() => goTab("datas")}>📌 Datas e campanhas</Button>
      </div>
      <Review me={me} client={client} perf={p} onSaved={ctx.reload} />
    </div>
  );
}

function PostTile({ p, badge }: { p: Post; badge?: string }) {
  return (
    <a href={p.permalink} target="_blank" rel="noreferrer" className="group overflow-hidden rounded-control border border-border bg-secondary transition hover:border-primary/60">
      <div className="relative aspect-[4/5] bg-black/40">
        {p.thumb ? <img src={p.thumb} alt={`Capa do ${p.type}`} loading="lazy" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Capa indisponível</div>}
        {badge && <span className="absolute left-2 top-2 rounded-full bg-primary px-2 py-0.5 text-[11px] font-bold text-white">{badge}</span>}
        <span className="absolute right-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[11px]">{p.type}</span>
      </div>
      <div className="p-2.5 text-xs">
        <p className="font-semibold">{brDate(p.date)}</p>
        <p className="text-muted-foreground">👁 {nf(p.reach) ?? "—"} · ❤ {nf(p.likes) ?? "—"} · 💬 {nf(p.comments) ?? "—"} · 🔖 {nf(p.saves) ?? "—"} · ↗ {nf(p.shares) ?? "—"}</p>
        <p className="mt-1 line-clamp-2">{p.caption || "Sem legenda"}</p>
      </div>
    </a>
  );
}

/* ---------------- Gerenciamento ---------------- */
const RANKS: { key: keyof Post | "engagementRate"; label: string }[] = [
  { key: "reach", label: "Alcance" }, { key: "interactions", label: "Interações" }, { key: "views", label: "Visualizações" },
  { key: "saves", label: "Salvamentos" }, { key: "shares", label: "Compartilhamentos" }, { key: "engagementRate", label: "Taxa de interação" },
];
const TYPE_PT: Record<string, string> = { roteiro: "Reels / Roteiro", carrossel: "Carrossel", estatico: "Estático" };

export function ManagementTab({ me, client, ctx }: { me: Me; client: Client; ctx: ReturnType<typeof usePerformance> }) {
  const staff = me.role !== "client";
  const { perf, period, setPeriod } = ctx;
  const p = perf.data;
  const [rank, setRank] = useState<string>("interactions");
  const [fmtFilter, setFmt] = useState("Todos");
  const posts = useMemo(() => {
    const list = (p?.instagram?.posts ?? []).filter((x) => x.type !== "Story" && (fmtFilter === "Todos" || x.type === fmtFilter));
    return [...list].sort((a: any, b: any) => (b[rank] ?? -1) - (a[rank] ?? -1));
  }, [p, rank, fmtFilter]);
  const head = (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <PeriodBar period={period} onChange={setPeriod} publishedOnly={staff ? undefined : ctx.published} />
      {p && <ConnectionChips perf={p} staff={staff} />}
    </div>
  );
  if (perf.error) return <div className="grid gap-4">{head}<ErrorText>{perf.error}</ErrorText></div>;
  if (!p) return <div className="grid gap-4">{head}<Skeleton rows={2} /></div>;
  if (!staff && !p.published) return <div className="grid gap-4">{head}<Card><p className="text-sm text-muted-foreground">{p.message}</p></Card></div>;
  const ig = p.instagram, pig = p.previousInstagram, del = p.delivery!;
  const leaders = RANKS.map((r) => {
    const top = [...(ig?.posts ?? [])].filter((x: any) => x.type !== "Story" && typeof x[r.key] === "number").sort((a: any, b: any) => b[r.key] - a[r.key])[0];
    return { ...r, top };
  });
  const types = [...new Set((ig?.posts ?? []).filter((x) => x.type !== "Story").map((x) => x.type))];
  return (
    <div className="grid gap-6">
      {head}
      <Card>
        <p className="eyebrow">Entregas da Humaniza no período</p>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-sm font-semibold">Por formato</p>
            <Bars rows={del.byType.map((t) => ({ label: TYPE_PT[t.type], value: t.count }))} />
          </div>
          <div>
            <p className="text-sm font-semibold">Por status</p>
            <Bars rows={del.byStatus.map((s) => ({ label: s.status, value: s.count }))} />
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Status internos do Humaniza OS. Publicações confirmadas pelo Instagram: <b className="text-foreground">{ig ? `${del.confirmedByInstagram} de ${del.total}` : "conta aguardando conexão"}</b>.</p>
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Publicações no Instagram" value={ig ? nf(ig.posts.filter((x) => x.type !== "Story").length) : null} source="Instagram (Meta)" empty="Conta aguardando conexão" />
        <Kpi label="Alcance diário médio" value={ig ? nf(ig.totals.reachDailyAvg) : null} current={ig?.totals.reachDailyAvg} prev={pig?.totals.reachDailyAvg} source="Instagram (Meta)" empty={ig ? "Sem dados no período" : "Conta aguardando conexão"} />
        <Kpi label="Visualizações" value={ig ? nf(ig.totals.views) : null} current={ig?.totals.views} prev={pig?.totals.views} source="Instagram (Meta)" empty={ig ? "Sem dados no período" : "Conta aguardando conexão"} />
        <Kpi label="Interações" value={ig ? nf(ig.totals.total_interactions) : null} current={ig?.totals.total_interactions} prev={pig?.totals.total_interactions} source="Instagram (Meta)" empty={ig ? "Sem dados no período" : "Conta aguardando conexão"} />
        <Kpi label="Salvamentos" value={ig ? nf(ig.totals.saves) : null} current={ig?.totals.saves} prev={pig?.totals.saves} source="Instagram (Meta)" />
        <Kpi label="Compartilhamentos" value={ig ? nf(ig.totals.shares) : null} current={ig?.totals.shares} prev={pig?.totals.shares} source="Instagram (Meta)" />
        <Kpi label="Novos seguidores" value={ig ? nf(ig.totals.follows) : null} current={ig?.totals.follows} prev={pig?.totals.follows} source="Instagram (Meta)" />
        <Kpi label="Visitas ao perfil" value={ig ? nf(ig.totals.profile_views) : null} current={ig?.totals.profile_views} prev={pig?.totals.profile_views} source="Instagram (Meta)" />
      </div>
      <Coverage c={ig?.coverage} />

      {ig && (
        <Card>
          <p className="eyebrow">Quem liderou em cada objetivo</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {leaders.map((l) => (
              <a key={String(l.key)} href={l.top?.permalink || undefined} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-control border border-border p-2 text-sm hover:border-primary/60">
                {l.top?.thumb ? <img src={l.top.thumb} alt="" className="h-14 w-11 rounded object-cover" /> : <span className="flex h-14 w-11 items-center justify-center rounded bg-secondary text-xs">—</span>}
                <span><span className="text-xs text-muted-foreground">{l.label}</span><br />{l.top ? <><b>{l.key === "engagementRate" ? pct(l.top.engagementRate) : nf((l.top as any)[l.key])}</b> · {l.top.type} de {brDate(l.top.date)}</> : <span className="text-muted-foreground">Dado indisponível</span>}</span>
              </a>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="eyebrow">Publicações reais do Instagram ({posts.length})</p>
          <div className="flex flex-wrap gap-2">
            <select value={fmtFilter} onChange={(e) => setFmt(e.target.value)} className="rounded-control border border-border bg-secondary p-1.5 text-sm"><option>Todos</option>{types.map((t) => <option key={t}>{t}</option>)}</select>
            <select value={rank} onChange={(e) => setRank(e.target.value)} className="rounded-control border border-border bg-secondary p-1.5 text-sm">{RANKS.map((r) => <option key={String(r.key)} value={String(r.key)}>Ranking: {r.label}</option>)}</select>
          </div>
        </div>
        {!ig && <p className="mt-3 text-sm text-muted-foreground">Conta aguardando conexão.</p>}
        {ig && !posts.length && <p className="mt-3 text-sm text-muted-foreground">Sem publicações no período.</p>}
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{posts.map((x, i) => <PostTile key={x.id} p={x} badge={`#${i + 1}`} />)}</div>
        {ig && <p className="mt-3 text-xs text-muted-foreground">Métricas de cada publicação acumuladas até a última sincronização. Fonte: Instagram (Meta).</p>}
      </Card>
      <ManualPlatforms staff={staff} client={client} perf={p} onSaved={ctx.reload} />
    </div>
  );
}

function Bars({ rows }: { rows: { label: string; value: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (!rows.some((r) => r.value)) return <p className="mt-2 text-sm text-muted-foreground">Sem dados no período</p>;
  return (
    <div className="mt-2 grid gap-2">
      {rows.map((r) => (
        <div key={r.label} title={`${r.label}: ${r.value}`}>
          <div className="flex justify-between text-sm"><span>{r.label}</span><b className="tabular-nums">{r.value}</b></div>
          <div className="mt-1 h-2 rounded-full bg-white/5"><div className="h-2 rounded-full bg-primary" style={{ width: `${(r.value / max) * 100}%` }} /></div>
        </div>
      ))}
    </div>
  );
}

/* ---------------- Tráfego pago ---------------- */
export function PaidTab({ me, client, ctx }: { me: Me; client: Client; ctx: ReturnType<typeof usePerformance> }) {
  const staff = me.role !== "client";
  const { perf, period, setPeriod } = ctx;
  const p = perf.data;
  const head = (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <PeriodBar period={period} onChange={setPeriod} publishedOnly={staff ? undefined : ctx.published} />
      {p && <ConnectionChips perf={p} staff={staff} />}
    </div>
  );
  if (perf.error) return <div className="grid gap-4">{head}<ErrorText>{perf.error}</ErrorText></div>;
  if (!p) return <div className="grid gap-4">{head}<Skeleton rows={2} /></div>;
  if (!staff && !p.published) return <div className="grid gap-4">{head}<Card><p className="text-sm text-muted-foreground">{p.message}</p></Card></div>;
  const ads = p.ads, prev = p.previousAds;
  if (!ads) return <div className="grid gap-4">{head}<Card><p className="text-sm text-muted-foreground">{p.connections?.ads.linked ? "Sem dados no período — a primeira sincronização ainda não terminou." : "Conta de anúncios aguardando conexão."}</p></Card></div>;
  const t = ads.totals;
  return (
    <div className="grid gap-6">
      {head}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi label="Investimento" value={brl(t.spend)} current={t.spend} prev={prev?.totals.spend} source="Gerenciador de Anúncios (Meta)" empty="Sem dados no período" />
        <Kpi label="Conversas atribuídas" value={nf(t.conversations)} current={t.conversations} prev={prev?.totals.conversations} source="Gerenciador de Anúncios (Meta)" hint="Conversas por mensagem iniciadas (janela de 7 dias)" />
        <Kpi label="Custo por conversa" value={brl(t.costPerConversation)} current={t.costPerConversation} prev={prev?.totals.costPerConversation} invert source="Gerenciador de Anúncios (Meta)" />
        <Kpi label="Impressões" value={nf(t.impressions)} current={t.impressions} prev={prev?.totals.impressions} source="Gerenciador de Anúncios (Meta)" />
        <Kpi label="Cliques no link" value={nf(t.clicks)} current={t.clicks} prev={prev?.totals.clicks} source="Gerenciador de Anúncios (Meta)" />
      </div>
      <Coverage c={ads.coverage} />
      <Card>
        <EvolutionChart title="Investimento por dia" dates={ads.series.map((r) => r.date)} points={ads.series.map((r) => r.spend)} prevPoints={prev?.series.map((r) => r.spend)} format={(v) => brl(v)!} />
      </Card>
      <Card>
        <p className="eyebrow">Campanhas no período</p>
        <p className="mt-1 text-xs text-muted-foreground">“Resultado” é o que cada campanha foi configurada para buscar no Gerenciador de Anúncios. Resultados de campanhas diferentes não são somados.</p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="text-muted-foreground"><tr><th className="p-2">Campanha</th><th className="p-2">O que mede</th><th className="p-2 text-right">Investido</th><th className="p-2 text-right">Resultados</th><th className="p-2 text-right">Custo/resultado</th><th className="p-2 text-right">Conversas</th><th className="p-2 text-right">Custo/conversa</th><th className="p-2 text-right">CTR</th></tr></thead>
            <tbody>
              {ads.campaigns.map((c) => (
                <tr key={c.id} className="border-t border-border">
                  <td className="p-2 font-semibold">{c.name}</td>
                  <td className="p-2"><Pill>{c.resultLabel}</Pill></td>
                  <td className="p-2 text-right tabular-nums">{brl(c.spend)}</td>
                  <td className="p-2 text-right tabular-nums">{nf(c.results) ?? <span className="text-muted-foreground">indisponível</span>}</td>
                  <td className="p-2 text-right tabular-nums">{brl(c.costPerResult) ?? "—"}</td>
                  <td className="p-2 text-right tabular-nums">{nf(c.conversations) ?? <span className="text-muted-foreground">n/a</span>}</td>
                  <td className="p-2 text-right tabular-nums">{brl(c.costPerConversation) ?? "—"}</td>
                  <td className="p-2 text-right tabular-nums">{c.ctr === null ? "—" : `${c.ctr.toFixed(2).replace(".", ",")}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!ads.campaigns.length && <p className="p-2 text-sm text-muted-foreground">Sem dados no período.</p>}
        </div>
      </Card>
    </div>
  );
}

/* ---------------- Outras plataformas (manual) ---------------- */
const PLATFORMS: [string, string, [string, string][]][] = [
  ["tiktok", "TikTok", [["followers", "Seguidores"], ["posts", "Posts"], ["views", "Visualizações"], ["interactions", "Interações"]]],
  ["youtube", "YouTube", [["followers", "Inscritos"], ["posts", "Vídeos"], ["views", "Visualizações"]]],
  ["googleAds", "Google Ads", [["spend", "Investimento (R$)"], ["clicks", "Cliques"], ["leads", "Conversões"]]],
  ["google", "Perfil no Google", [["views", "Visualizações"], ["clicks", "Ligações/rotas/site"]]],
  ["site", "Site / vendas", [["views", "Visitas"], ["leads", "Leads"], ["sales", "Vendas"]]],
];
function ManualPlatforms({ staff, client, perf, onSaved }: { staff: boolean; client: Client; perf: Performance; onSaved: () => void }) {
  const manual = perf.report?.manual ?? {};
  const [m, setM] = useState<Record<string, Record<string, any>>>(manual);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => setM(manual), [perf]);
  const filled = PLATFORMS.filter(([k]) => manual[k] && Object.keys(manual[k]).length);
  if (!staff && !filled.length) return null;
  return (
    <Card>
      <div className="flex items-center justify-between"><p className="eyebrow">🌐 Outras plataformas</p>{staff && <Button small variant="ghost" onClick={() => setEditing(!editing)}>{editing ? "Fechar" : "Lançar números"}</Button>}</div>
      <p className="mt-1 text-xs text-muted-foreground">Fonte: lançamento manual da equipe (sem conexão automática).</p>
      {!editing && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {filled.length === 0 && <p className="text-sm text-muted-foreground">Nenhum número lançado para este período.</p>}
          {filled.map(([k, label, fields]) => (
            <div key={k}><p className="text-sm font-semibold">{label}</p>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">{fields.filter(([f]) => manual[k][f] !== undefined).map(([f, l]) => <span key={f}><span className="text-muted-foreground">{l}:</span> <b className="tabular-nums">{f === "spend" ? brl(manual[k][f]) : nf(manual[k][f])}</b></span>)}</div>
            </div>
          ))}
        </div>
      )}
      {editing && (
        <div className="mt-3 grid gap-4">
          {PLATFORMS.map(([k, label, fields]) => (
            <div key={k}><p className="text-sm font-semibold">{label}</p>
              <div className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-4">{fields.map(([f, l]) => <Field key={f} label={l} type="number" value={m[k]?.[f] !== undefined ? String(m[k][f]) : ""} onChange={(v) => setM({ ...m, [k]: { ...(m[k] ?? {}), [f]: v } })} />)}</div>
            </div>
          ))}
          <div className="flex justify-end"><Button disabled={busy} onClick={async () => { setBusy(true); try { await api.saveReport(client._id, { de: perf.de, ate: perf.ate, manual: m }); setEditing(false); onSaved(); } finally { setBusy(false); } }}>{busy ? "Salvando…" : "Salvar"}</Button></div>
        </div>
      )}
    </Card>
  );
}

/* ---------------- Revisão da equipe ---------------- */
const KIND: Record<string, [string, string]> = { funcionou: ["✓ O que funcionou", "text-emerald-300"], repetir: ["↻ Vale repetir", "text-sky-300"], melhorar: ["! Pode melhorar", "text-amber-300"], teste: ["⚗ Teste para o próximo período", "text-[#c9c7ff]"] };

function Review({ me, client, perf, onSaved }: { me: Me; client: Client; perf: Performance; onSaved: () => void }) {
  const staff = me.role !== "client";
  const saved = perf.report!;
  const [analysis, setAnalysis] = useState(saved.analysis);
  const [items, setItems] = useState<Suggestion2[]>(() => mergeSuggestions(saved.suggestions, perf.suggestions ?? []));
  const [steps, setSteps] = useState(saved.nextSteps);
  const [newStep, setNewStep] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [toast, say] = useToast();
  useEffect(() => { setAnalysis(saved.analysis); setItems(mergeSuggestions(saved.suggestions, perf.suggestions ?? [])); setSteps(saved.nextSteps); }, [perf]);
  const save = async (extra: Record<string, unknown> = {}, msg = "Análise salva.") => {
    setBusy(true); setErr("");
    try { await api.saveReport(client._id, { de: perf.de, ate: perf.ate, analysis, suggestions: items, nextSteps: steps, ...extra }); say(msg); onSaved(); }
    catch (x) { setErr(x instanceof Error ? x.message : String(x)); } finally { setBusy(false); }
  };
  if (!staff) {
    const approved = saved.suggestions;
    if (!saved.analysis && !approved.length && !steps.length) return null;
    return (
      <Card>
        <p className="eyebrow">Análise da Humaniza</p>
        {saved.analysis && <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{saved.analysis}</p>}
        <div className="mt-3 grid gap-3 md:grid-cols-2">{approved.map((s) => <SuggestionCard key={s.id} s={s} />)}</div>
        {steps.length > 0 && (<><p className="mt-4 text-sm font-semibold">Próximos passos</p><ul className="mt-1 grid gap-1 text-sm">{steps.map((s, i) => <li key={i} className={s.done ? "text-muted-foreground line-through" : ""}>→ {s.text}</li>)}</ul></>)}
      </Card>
    );
  }
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><p className="eyebrow">Revisão da equipe</p><h2 className="text-lg font-bold">Análise do período</h2></div>
        <div className="flex items-center gap-2">
          <Pill>{perf.published ? `Liberada ao cliente${saved.publishedAt ? ` em ${brDate(saved.publishedAt)}` : ""}` : "Rascunho (cliente não vê)"}</Pill>
          {perf.published
            ? <Button small variant="ghost" disabled={busy} onClick={() => save({ published: false }, "Análise escondida do cliente.")}>Esconder do cliente</Button>
            : <Button small variant="green" disabled={busy} onClick={() => save({ published: true }, "Análise aprovada e liberada ao cliente.")}>Aprovar e liberar ao cliente</Button>}
        </div>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">As sugestões abaixo são geradas a partir dos números do período. Edite o texto e marque “Aprovar” nas que o cliente deve ver.</p>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {items.map((s, i) => (
          <div key={s.id} className={`rounded-control border p-3 ${s.approved ? "border-emerald-500/40" : "border-border"}`}>
            <p className={`text-xs font-semibold ${KIND[s.kind][1]}`}>{KIND[s.kind][0]}</p>
            <textarea value={s.text} rows={2} onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} className="mt-1 w-full rounded-control border border-border bg-secondary p-2 text-sm" />
            <Evidence s={s} />
            <label className="mt-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={!!s.approved} onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, approved: e.target.checked } : x)))} />Aprovar para o cliente</label>
          </div>
        ))}
        {!items.length && <p className="text-sm text-muted-foreground">Sem sugestões automáticas: faltam dados sincronizados neste período.</p>}
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Area label="Análise da agência (texto livre)" value={analysis} onChange={setAnalysis} rows={6} />
        <div>
          <p className="text-sm text-muted-foreground">Próximos passos</p>
          <ul className="mt-1 grid gap-1">
            {steps.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <input type="checkbox" className="mt-1" checked={s.done} onChange={(e) => setSteps(steps.map((x, j) => (j === i ? { ...x, done: e.target.checked } : x)))} />
                <span className={`flex-1 ${s.done ? "text-muted-foreground line-through" : ""}`}>{s.text}</span>
                <button className="text-muted-foreground hover:text-red-300" onClick={() => setSteps(steps.filter((_, j) => j !== i))}>×</button>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex gap-2">
            <input value={newStep} onChange={(e) => setNewStep(e.target.value)} placeholder="Novo passo" className="flex-1 rounded-control border border-border bg-secondary p-2 text-sm" />
            <Button small variant="ghost" onClick={() => { if (newStep.trim()) { setSteps([...steps, { text: newStep.trim(), done: false }]); setNewStep(""); } }}>Adicionar</Button>
          </div>
        </div>
      </div>
      <ErrorText>{err}</ErrorText>
      <div className="mt-3 flex justify-end"><Button disabled={busy} onClick={() => save()}>{busy ? "Salvando…" : "Salvar rascunho"}</Button></div>
      {toast}
    </Card>
  );
}
function mergeSuggestions(saved: Suggestion2[], auto: Suggestion2[]) {
  const ids = new Set(saved.map((s) => s.id));
  return [...saved, ...auto.filter((a) => !ids.has(a.id)).map((a) => ({ ...a, approved: false }))];
}
function Evidence({ s }: { s: Suggestion2 }) {
  return (
    <ul className="mt-2 grid gap-0.5 text-[11px] text-muted-foreground">
      {s.evidence.map((e, i) => <li key={i}>📊 {e.label}: <b className="text-foreground">{e.value}</b> <span>· {e.source}</span></li>)}
    </ul>
  );
}
function SuggestionCard({ s }: { s: Suggestion2 }) {
  return (
    <div className="rounded-control border border-border p-3">
      <p className={`text-xs font-semibold ${KIND[s.kind][1]}`}>{KIND[s.kind][0]}</p>
      <p className="mt-1 text-sm">{s.text}</p>
      <Evidence s={s} />
    </div>
  );
}

/* ---------------- Conexões do Meta (admin) ---------------- */
export function MetaConnections({ client, onClose, onDone }: { client: Client; onClose: () => void; onDone: () => void }) {
  const [status, setStatus] = useState<MetaStatus | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [app, setApp] = useState({ appId: "", appSecret: "", configId: "" });
  const [token, setToken] = useState("");
  const integ = client.integrations ?? {};
  const [ig, setIg] = useState(integ.igUserId ?? "");
  const [ad, setAd] = useState(integ.adAccountId ?? "");
  const [syncMsg, setSyncMsg] = useState("");
  const load = () => api.metaStatus(true).then((s) => { setStatus(s); setApp((a) => ({ ...a, appId: s.app?.appId ?? "", configId: s.app?.configId ?? "" })); }).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);
  const run = async (fn: () => Promise<unknown>) => { setBusy(true); setErr(""); try { await fn(); } catch (x) { setErr(x instanceof Error ? x.message : String(x)); } finally { setBusy(false); } };
  const igOpt = status?.assets?.instagram ?? [];
  const adOpt = status?.assets?.adAccounts ?? [];
  const back = `/painel#/cliente/${client._id}`;
  return (
    <Modal wide title={`Conexões do Meta — ${client.name}`} onClose={onClose}>
      <div className="grid gap-4">
        <section className="rounded-control border border-border p-4">
          <p className="font-semibold">1. App da agência no Meta for Developers</p>
          <p className="mt-1 text-xs text-muted-foreground">Uma vez só. Em developers.facebook.com → Meus apps → app da agência (tipo Empresa) → Configurações do app → Básico: copie o ID do app e a Chave secreta. Em Login do Facebook para Empresas → Configurações, adicione como URI de redirecionamento OAuth válido:</p>
          <code className="mt-1 block break-all rounded bg-secondary p-2 text-xs">{status?.redirectUri ?? "…"}</code>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <Field label="ID do app" value={app.appId} onChange={(v) => setApp({ ...app, appId: v })} />
            <label className="text-sm"><span className="text-muted-foreground">Chave secreta {status?.app?.hasSecret && "(já salva)"}</span>
              <input type="password" autoComplete="off" value={app.appSecret} onChange={(e) => setApp({ ...app, appSecret: e.target.value })} placeholder={status?.app?.hasSecret ? "•••••• (manter)" : ""} className="mt-1 w-full rounded-control border border-border bg-secondary p-2" /></label>
            <Field label="ID da configuração (opcional)" value={app.configId} onChange={(v) => setApp({ ...app, configId: v })} />
          </div>
          <div className="mt-2 flex justify-end"><Button small disabled={busy || !app.appId} onClick={() => run(async () => { await api.saveMetaApp(app); setApp({ ...app, appSecret: "" }); await load(); })}>Salvar app</Button></div>
        </section>

        <section className="rounded-control border border-border p-4">
          <p className="font-semibold">2. Autorizar a leitura (login oficial do Facebook)</p>
          {status?.connected
            ? <p className="mt-1 text-sm text-emerald-300">Conectado como {status.accountName} ({status.method === "system_user" ? "usuário do sistema" : "login do Facebook"}){status.expiresAt ? ` · validade: ${status.expiresAt === "nunca" ? "sem vencimento" : brDate(status.expiresAt)}` : ""}</p>
            : <p className="mt-1 text-sm text-amber-300">Ainda não autorizado.</p>}
          {!!status?.missingScopes?.length && <p className="mt-1 text-xs text-amber-300">Permissões que faltam: {status.missingScopes.join(", ")}</p>}
          <p className="mt-2 text-xs text-muted-foreground">Clique, entre com o Facebook de quem administra o Business Manager da agência e marque a Página, o Instagram e a conta de anúncios da {client.name}. Só leitura: {status?.scopesNeeded?.join(", ")}.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a href={`/api/meta/conectar?voltar=${encodeURIComponent(back)}`} className={`rounded-control bg-[#1877F2] px-4 py-2 text-sm font-semibold text-white ${!status?.app?.hasSecret ? "pointer-events-none opacity-50" : ""}`}>Conectar com Facebook</a>
          </div>
          <details className="mt-3 text-xs text-muted-foreground">
            <summary className="cursor-pointer">Alternativa: token de usuário do sistema (não vence)</summary>
            <p className="mt-2">Business Manager → Configurações do negócio → Usuários do sistema → seu usuário → Gerar token (app da agência, permissões acima, “Nunca expira”). Cole aqui; ele fica só no servidor.</p>
            <div className="mt-2 flex gap-2">
              <input type="password" autoComplete="off" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Token do usuário do sistema" className="flex-1 rounded-control border border-border bg-secondary p-2 text-sm text-foreground" />
              <Button small disabled={busy || token.length < 50} onClick={() => run(async () => { await api.saveMetaToken(token); setToken(""); await load(); })}>Salvar</Button>
            </div>
          </details>
        </section>

        <section className="rounded-control border border-border p-4">
          <p className="font-semibold">3. Contas da {client.name}</p>
          {!status?.connected ? <p className="mt-1 text-sm text-muted-foreground">Autorize primeiro (passo 2).</p> : (
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <Select label="Instagram profissional" value={ig} onChange={setIg} options={[{ value: "", label: "Nenhum" }, ...igOpt.map((o) => ({ value: o.igUserId, label: `@${o.username} — Página ${o.pageName}` }))]} />
              <Select label="Conta de anúncios" value={ad} onChange={setAd} options={[{ value: "", label: "Nenhuma" }, ...adOpt.map((o) => ({ value: o.id, label: `${o.name}${o.active ? "" : " (inativa)"}` }))]} />
              {(status.assets?.errors ?? []).map((e, i) => <p key={i} className="text-xs text-amber-300 sm:col-span-2">{e}</p>)}
              {igOpt.length === 0 && adOpt.length === 0 && <p className="text-xs text-muted-foreground sm:col-span-2">A autorização não enxerga nenhuma conta. Refaça o passo 2 marcando os ativos da {client.name}, ou atribua-os ao usuário do sistema no Business Manager.</p>}
            </div>
          )}
          {syncMsg && <p className="mt-2 text-sm text-emerald-300">{syncMsg}</p>}
        </section>
        <ErrorText>{err}</ErrorText>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Fechar</Button>
          <Button disabled={busy || !status?.connected} onClick={() => run(async () => {
            const igSel = igOpt.find((o) => o.igUserId === ig);
            const adSel = adOpt.find((o) => o.id === ad);
            await api.saveIntegrations(client._id, { igUserId: ig, igUsername: igSel ? `@${igSel.username}` : "", pageId: igSel?.pageId ?? "", adAccountId: ad, adAccountName: adSel?.name ?? "" });
            setSyncMsg("Contas salvas. Buscando os dados no Meta…");
            await api.syncNow(client._id, true);
            setSyncMsg("Primeira sincronização concluída.");
            onDone();
          })}>{busy ? "Sincronizando…" : "Salvar e sincronizar agora"}</Button>
        </div>
      </div>
    </Modal>
  );
}

export function SyncButton({ client, onDone }: { client: Client; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  return (
    <span className="flex items-center gap-2">
      <Button small variant="ghost" disabled={busy} onClick={async () => { setBusy(true); setMsg(""); try { await api.syncNow(client._id); onDone(); setMsg("Atualizado."); } catch (e) { setMsg(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); } }}>
        {busy ? "Sincronizando…" : "↻ Sincronizar agora"}
      </Button>
      {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
    </span>
  );
}

export type { ReactNode };
