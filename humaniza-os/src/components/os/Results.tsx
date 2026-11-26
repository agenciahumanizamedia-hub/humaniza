// Aba "Resultados" do cliente: Instagram (orgânico), tráfego pago (Meta Ads), outras plataformas,
// produção da agência, melhores posts, análise automática, análise da agência e próximos passos.
import { useEffect, useMemo, useState } from "react";
import { api, type Client, type Me, type MetaStatus, type Post, type Results } from "./api";
import { Area, Button, Card, ErrorText, Field, Modal, Pill, Select, Skeleton, monthLabel, shiftMonth, thisMonth, useLoad, useToast } from "./ui";

const n = (v?: number) => Math.round(v ?? 0).toLocaleString("pt-BR");
const brl = (v?: number) => (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pctTxt = (v?: number) => `${((v ?? 0) * 100).toFixed(1).replace(".", ",")}%`;
function delta(cur?: number, prev?: number) {
  if (!prev || cur === undefined) return null;
  return ((cur - prev) / prev) * 100;
}

function Kpi({ label, value, d, hint, invert }: { label: string; value: string; d?: number | null; hint?: string; invert?: boolean }) {
  const good = d === null || d === undefined ? null : invert ? d <= 0 : d >= 0;
  return (
    <div className="rounded-lg border border-border bg-card p-4" title={hint}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-extrabold tabular-nums">{value}</p>
      {d !== null && d !== undefined && (
        <p className={`mt-0.5 text-xs font-semibold ${good ? "text-emerald-300" : "text-amber-300"}`}>
          {good ? "▲" : "▼"} {Math.abs(d).toFixed(0)}% vs mês anterior
        </p>
      )}
    </div>
  );
}

export function ResultsTab({ me, client, onClientChanged }: { me: Me; client: Client; onClientChanged: () => void }) {
  const staff = me.role !== "client";
  const [month, setMonth] = useState(thisMonth());
  const [refresh, setRefresh] = useState(0);
  const { data, error, loading } = useLoad(() => api.results(client._id, month, refresh > 0), [client._id, month, refresh]);
  const [connect, setConnect] = useState(false);
  const [toast, say] = useToast();

  const header = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex w-full items-center gap-2 sm:w-auto">
        <Button small variant="ghost" onClick={() => setMonth(shiftMonth(month, -1))}>←</Button>
        <h2 className="min-w-0 flex-1 text-center text-xl font-extrabold capitalize sm:min-w-48 sm:flex-none">{monthLabel(month)}</h2>
        <Button small variant="ghost" onClick={() => setMonth(shiftMonth(month, 1))} disabled={month >= thisMonth()}>→</Button>
      </div>
      {staff && (
        <div className="flex flex-wrap gap-2">
          <Button small variant="ghost" disabled={loading} onClick={() => setRefresh((r) => r + 1)}>{loading ? "Atualizando…" : "↻ Atualizar agora"}</Button>
          {me.role === "admin" && <Button small variant="ghost" onClick={() => setConnect(true)}>Conexões do Meta</Button>}
        </div>
      )}
    </div>
  );

  if (error) return <div className="grid gap-4">{header}<ErrorText>{error}</ErrorText></div>;
  if (!data) return <div className="grid gap-4">{header}<Skeleton rows={3} /></div>;
  if (!staff && !data.published)
    return <div className="grid gap-4">{header}<Card><p className="text-muted-foreground">{data.message}</p></Card></div>;

  const ig = data.instagram;
  const prev = data.previousInstagram;
  const ads = data.ads;
  const auto = data.auto!;
  const fetched = [ig?.fetchedAt, ads?.fetchedAt].filter(Boolean).sort().pop();

  return (
    <div className="grid gap-6">
      {header}
      {staff && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Pill>{data.connections?.instagram ? `Instagram: ${data.connections.instagram}` : "Instagram não vinculado"}</Pill>
          <Pill>{data.connections?.ads ? `Anúncios: ${data.connections.ads}` : "Anúncios não vinculados"}</Pill>
          {fetched && <span>Dados do Meta de {new Date(fetched).toLocaleString("pt-BR")}</span>}
          {!data.connections?.metaConnected && me.role === "admin" && <Button small onClick={() => setConnect(true)}>Conectar o Meta</Button>}
        </div>
      )}
      {staff && (ig?.error || ads?.error) && <ErrorText>{ig?.error || ads?.error}</ErrorText>}

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div><p className="eyebrow">Resumo do mês</p><h2 className="text-xl font-bold">O que aconteceu em {monthLabel(month)}</h2></div>
          {staff && <PublishToggle client={client} month={month} published={data.published} onDone={(m) => { say(m); setRefresh((r) => r); }} />}
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <p className="mb-2 text-sm font-semibold text-emerald-300">Destaques</p>
            <ul className="grid gap-1.5 text-sm">{auto.highlights.length ? auto.highlights.map((h, i) => <li key={i}>✓ {h}</li>) : <li className="text-muted-foreground">Sem dados suficientes ainda.</li>}</ul>
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold text-amber-300">Pontos de atenção</p>
            <ul className="grid gap-1.5 text-sm">{auto.alerts.length ? auto.alerts.map((h, i) => <li key={i}>! {h}</li>) : <li className="text-muted-foreground">Nenhum ponto crítico.</li>}</ul>
          </div>
        </div>
      </Card>

      {/* Gerenciamento (orgânico) */}
      <section className="grid gap-3">
        <div className="flex items-end justify-between gap-2">
          <h2 className="text-lg font-bold">📱 Gerenciamento de redes {ig?.profile.username && <span className="text-sm font-normal text-muted-foreground">@{ig.profile.username}</span>}</h2>
        </div>
        {!ig ? (
          <Card><p className="text-sm text-muted-foreground">{staff ? "Vincule o Instagram do cliente em “Conexões do Meta” para ver alcance, engajamento e os posts do mês automaticamente." : "Os números do Instagram aparecem aqui em breve."}</p></Card>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Kpi label="Seguidores" value={n(ig.profile.followers)} d={delta(ig.profile.followers, prev?.profile.followers)} />
              <Kpi label="Contas alcançadas" value={n(ig.totals.reach)} d={delta(ig.totals.reach, prev?.totals.reach)} />
              <Kpi label="Visualizações" value={n(ig.totals.views)} d={delta(ig.totals.views, prev?.totals.views)} />
              <Kpi label="Interações" value={n(ig.totals.total_interactions)} d={delta(ig.totals.total_interactions, prev?.totals.total_interactions)} hint="Curtidas, comentários, salvamentos, compartilhamentos e respostas" />
              <Kpi label="Contas engajadas" value={n(ig.totals.accounts_engaged)} d={delta(ig.totals.accounts_engaged, prev?.totals.accounts_engaged)} />
              <Kpi label="Novos seguidores" value={n(ig.totals.follows)} hint={ig.totals.unfollows ? `${n(ig.totals.unfollows)} deixaram de seguir` : undefined} />
              <Kpi label="Visitas ao perfil" value={n(ig.totals.profile_views)} d={delta(ig.totals.profile_views, prev?.totals.profile_views)} />
              <Kpi label="Cliques no link" value={n(ig.totals.website_clicks)} d={delta(ig.totals.website_clicks, prev?.totals.website_clicks)} />
            </div>
            <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
              <Card>
                <p className="eyebrow">Melhores posts do mês</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  {auto.bestPosts.map((p, i) => <PostCard key={p.id} p={p} rank={i + 1} />)}
                  {!auto.bestPosts.length && <p className="text-sm text-muted-foreground">Nenhum post com dados neste mês.</p>}
                </div>
              </Card>
              <Card>
                <p className="eyebrow">Desempenho por formato</p>
                <FormatBars formats={auto.formats} />
                {(auto.bestWeekday || auto.bestHour) && (
                  <p className="mt-4 rounded-control bg-secondary p-3 text-sm">⏰ Melhor momento: <b>{[auto.bestWeekday, auto.bestHour].filter(Boolean).join(", ")}</b></p>
                )}
              </Card>
            </div>
            <AllPosts posts={ig.posts} />
          </>
        )}
      </section>

      {/* Tráfego pago */}
      <section className="grid gap-3">
        <h2 className="text-lg font-bold">📣 Tráfego pago {ads?.account?.name && <span className="text-sm font-normal text-muted-foreground">{ads.account.name}</span>}</h2>
        {!ads ? (
          <Card><p className="text-sm text-muted-foreground">{staff ? "Vincule a conta de anúncios do cliente em “Conexões do Meta”." : "Sem campanhas de anúncios neste mês."}</p></Card>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Kpi label="Investimento" value={brl(ads.totals.spend)} d={delta(ads.totals.spend, data.previousAds?.totals.spend)} />
              <Kpi label="Resultados" value={n(ads.totals.results)} d={delta(ads.totals.results, data.previousAds?.totals.results)} hint="Conversas iniciadas, leads, compras ou cliques no link" />
              <Kpi label="Custo por resultado" value={brl(ads.totals.costPerResult)} d={delta(ads.totals.costPerResult, data.previousAds?.totals.costPerResult)} invert />
              <Kpi label="Alcance" value={n(ads.totals.reach)} d={delta(ads.totals.reach, data.previousAds?.totals.reach)} />
              <Kpi label="Impressões" value={n(ads.totals.impressions)} />
              <Kpi label="Cliques no link" value={n(ads.totals.clicks)} />
              <Kpi label="CTR" value={`${(ads.totals.ctr ?? 0).toFixed(2).replace(".", ",")}%`} hint="Acima de 1% é saudável" />
              <Kpi label="CPC / CPM" value={`${brl(ads.totals.cpc)} / ${brl(ads.totals.cpm)}`} />
            </div>
            {ads.campaigns.length > 0 && (
              <Card>
                <p className="eyebrow">Campanhas</p>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <thead className="text-muted-foreground"><tr><th className="p-2">Campanha</th><th className="p-2 text-right">Investido</th><th className="p-2 text-right">Resultados</th><th className="p-2 text-right">Custo/result.</th><th className="p-2 text-right">CTR</th><th className="p-2 text-right">Alcance</th></tr></thead>
                    <tbody>
                      {ads.campaigns.map((c) => (
                        <tr key={c.name} className="border-t border-border">
                          <td className="p-2 font-semibold">{c.name}</td><td className="p-2 text-right tabular-nums">{brl(c.spend)}</td><td className="p-2 text-right tabular-nums">{n(c.results)}</td>
                          <td className="p-2 text-right tabular-nums">{c.costPerResult ? brl(c.costPerResult) : "—"}</td><td className="p-2 text-right tabular-nums">{c.ctr.toFixed(2).replace(".", ",")}%</td><td className="p-2 text-right tabular-nums">{n(c.reach)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </>
        )}
      </section>

      {/* Produção da agência + outras plataformas */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <p className="eyebrow">🎬 Criação e entregas da agência</p>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Kpi label="Planejados" value={n(data.production?.planned)} />
            <Kpi label="Aprovados" value={n(data.production?.approved)} />
            <Kpi label="Postados" value={n(data.production?.posted)} />
            <Kpi label="Ajustes" value={n(data.production?.adjustments)} />
          </div>
          <p className="mt-3 text-sm text-muted-foreground">{data.production?.byType.map((t) => `${t.count} ${t.type === "roteiro" ? "Reels" : t.type === "carrossel" ? "carrosséis" : "estáticos"}`).join(" · ")}</p>
        </Card>
        <ManualPlatforms staff={staff} client={client} month={month} manual={data.report?.manual ?? {}} onSaved={() => say("Números salvos.")} />
      </div>

      <AgencyAnalysis staff={staff} client={client} month={month} report={data.report!} suggestions={auto.nextSteps} onSaved={(m) => say(m)} />

      {connect && me.role === "admin" && <ConnectMeta client={client} onClose={() => setConnect(false)} onDone={() => { setConnect(false); onClientChanged(); setRefresh((r) => r + 1); say("Conexões salvas."); }} />}
      {toast}
    </div>
  );
}

function PostCard({ p, rank }: { p: Post; rank: number }) {
  return (
    <a href={p.permalink} target="_blank" rel="noreferrer" className="group overflow-hidden rounded-control border border-border bg-secondary transition hover:border-primary/60">
      <div className="relative aspect-[4/5] bg-black/40">
        {p.thumb ? <img src={p.thumb} alt="" loading="lazy" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-3xl">📷</div>}
        <span className="absolute left-2 top-2 rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-white">#{rank}</span>
        <span className="absolute right-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[11px]">{p.type}</span>
      </div>
      <div className="p-3 text-xs">
        <p className="font-semibold text-[#c9c7ff]">{pctTxt(p.engagementRate)} de engajamento</p>
        <p className="mt-1 text-muted-foreground">👁 {n(p.reach)} · ❤ {n(p.likes)} · 💬 {n(p.comments)} · 🔖 {n(p.saves)} · ↗ {n(p.shares)}</p>
        <p className="mt-1 line-clamp-2">{p.caption || "Sem legenda"}</p>
      </div>
    </a>
  );
}

function FormatBars({ formats }: { formats: { type: string; count: number; avgReach: number; avgEngagement: number }[] }) {
  const max = Math.max(...formats.map((f) => f.avgEngagement), 0.0001);
  if (!formats.length) return <p className="mt-3 text-sm text-muted-foreground">Sem posts no mês.</p>;
  return (
    <div className="mt-3 grid gap-3">
      {formats.map((f) => (
        <div key={f.type} title={`${f.type}: ${f.count} posts · alcance médio ${n(f.avgReach)} · engajamento médio ${pctTxt(f.avgEngagement)}`}>
          <div className="flex justify-between text-sm"><span className="font-semibold">{f.type} <span className="font-normal text-muted-foreground">({f.count})</span></span><span className="tabular-nums">{pctTxt(f.avgEngagement)}</span></div>
          <div className="mt-1 h-2.5 rounded-full bg-white/5"><div className="h-2.5 rounded-full bg-primary" style={{ width: `${(f.avgEngagement / max) * 100}%` }} /></div>
          <p className="mt-0.5 text-[11px] text-muted-foreground">alcance médio {n(f.avgReach)}</p>
        </div>
      ))}
    </div>
  );
}

function AllPosts({ posts }: { posts: Post[] }) {
  const [sort, setSort] = useState<"date" | "eng" | "reach" | "saves">("eng");
  const [open, setOpen] = useState(false);
  const list = useMemo(() => [...posts].filter((p) => p.type !== "Story").sort((a, b) =>
    sort === "date" ? b.timestamp.localeCompare(a.timestamp) : sort === "reach" ? b.reach - a.reach : sort === "saves" ? b.saves - a.saves : b.engagementRate - a.engagementRate), [posts, sort]);
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="eyebrow">Todos os posts ({list.length})</p>
        <div className="flex items-center gap-2">
          <select value={sort} onChange={(e) => setSort(e.target.value as any)} className="rounded-control border border-border bg-secondary p-1.5 text-sm">
            <option value="eng">Mais engajados</option><option value="reach">Maior alcance</option><option value="saves">Mais salvos</option><option value="date">Mais recentes</option>
          </select>
          <Button small variant="ghost" onClick={() => setOpen(!open)}>{open ? "Recolher" : "Ver lista"}</Button>
        </div>
      </div>
      {open && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-muted-foreground"><tr><th className="p-2">Post</th><th className="p-2">Data</th><th className="p-2 text-right">Alcance</th><th className="p-2 text-right">Curtidas</th><th className="p-2 text-right">Coment.</th><th className="p-2 text-right">Salvos</th><th className="p-2 text-right">Compart.</th><th className="p-2 text-right">Engaj.</th></tr></thead>
            <tbody>
              {list.map((p) => (
                <tr key={p.id} className="border-t border-border">
                  <td className="p-2"><a href={p.permalink} target="_blank" rel="noreferrer" className="flex items-center gap-2 hover:underline">
                    {p.thumb && <img src={p.thumb} alt="" className="h-10 w-8 rounded object-cover" />}<span className="line-clamp-1 max-w-[220px]">{p.type} · {p.caption || "sem legenda"}</span></a></td>
                  <td className="p-2">{new Date(p.timestamp).toLocaleDateString("pt-BR")}</td>
                  <td className="p-2 text-right tabular-nums">{n(p.reach)}</td><td className="p-2 text-right tabular-nums">{n(p.likes)}</td><td className="p-2 text-right tabular-nums">{n(p.comments)}</td>
                  <td className="p-2 text-right tabular-nums">{n(p.saves)}</td><td className="p-2 text-right tabular-nums">{n(p.shares)}</td><td className="p-2 text-right font-semibold tabular-nums">{pctTxt(p.engagementRate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

const PLATFORMS: [string, string, [string, string][]][] = [
  ["tiktok", "TikTok", [["followers", "Seguidores"], ["posts", "Posts"], ["views", "Visualizações"], ["interactions", "Interações"]]],
  ["youtube", "YouTube", [["followers", "Inscritos"], ["posts", "Vídeos"], ["views", "Visualizações"]]],
  ["googleAds", "Google Ads", [["spend", "Investimento (R$)"], ["clicks", "Cliques"], ["leads", "Conversões"]]],
  ["google", "Perfil no Google", [["views", "Visualizações"], ["clicks", "Ligações/rotas/site"]]],
  ["site", "Site / vendas", [["views", "Visitas"], ["leads", "Leads"], ["sales", "Vendas"]]],
];

function ManualPlatforms({ staff, client, month, manual, onSaved }: { staff: boolean; client: Client; month: string; manual: Record<string, Record<string, number | string>>; onSaved: () => void }) {
  const [m, setM] = useState(manual);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => setM(manual), [manual]);
  const filled = PLATFORMS.filter(([k]) => manual[k] && Object.keys(manual[k]).length);
  return (
    <Card>
      <div className="flex items-center justify-between"><p className="eyebrow">🌐 Outras plataformas</p>{staff && <Button small variant="ghost" onClick={() => setEditing(!editing)}>{editing ? "Fechar" : "Lançar números"}</Button>}</div>
      {!editing && (
        <div className="mt-3 grid gap-3">
          {filled.length === 0 && <p className="text-sm text-muted-foreground">{staff ? "TikTok, YouTube, Google Ads e site ainda não têm conexão automática: lance os números do mês aqui." : "Sem outras plataformas neste mês."}</p>}
          {filled.map(([k, label, fields]) => (
            <div key={k}><p className="text-sm font-semibold">{label}</p>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">{fields.filter(([f]) => manual[k][f] !== undefined).map(([f, l]) => <span key={f}><span className="text-muted-foreground">{l}:</span> <b className="tabular-nums">{f === "spend" ? brl(Number(manual[k][f])) : n(Number(manual[k][f]))}</b></span>)}</div>
              {manual[k].note && <p className="text-xs text-muted-foreground">{String(manual[k].note)}</p>}
            </div>
          ))}
        </div>
      )}
      {editing && (
        <div className="mt-3 grid gap-4">
          {PLATFORMS.map(([k, label, fields]) => (
            <div key={k}>
              <p className="text-sm font-semibold">{label}</p>
              <div className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {fields.map(([f, l]) => (
                  <Field key={f} label={l} type="number" value={m[k]?.[f] !== undefined ? String(m[k][f]) : ""} onChange={(v) => setM({ ...m, [k]: { ...(m[k] ?? {}), [f]: v } })} />
                ))}
              </div>
            </div>
          ))}
          <div className="flex justify-end"><Button disabled={busy} onClick={async () => { setBusy(true); try { await api.saveResults(client._id, { month, manual: m }); setEditing(false); onSaved(); } finally { setBusy(false); } }}>{busy ? "Salvando…" : "Salvar números"}</Button></div>
        </div>
      )}
    </Card>
  );
}

function AgencyAnalysis({ staff, client, month, report, suggestions, onSaved }: {
  staff: boolean; client: Client; month: string; report: NonNullable<Results["report"]>; suggestions: string[]; onSaved: (m: string) => void;
}) {
  const [analysis, setAnalysis] = useState(report.analysis);
  const [steps, setSteps] = useState(report.nextSteps);
  const [newStep, setNewStep] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { setAnalysis(report.analysis); setSteps(report.nextSteps); }, [report]);
  const save = async (next = steps) => {
    setBusy(true);
    try { await api.saveResults(client._id, { month, analysis, nextSteps: next }); onSaved("Análise salva."); } finally { setBusy(false); }
  };
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <p className="eyebrow">💡 Análise da agência</p>
        {staff ? (
          <div className="mt-2 grid gap-2">
            <Area label="O que funcionou, o que não funcionou e o que muda no próximo mês" value={analysis} onChange={setAnalysis} rows={8} />
            <div className="flex justify-end"><Button disabled={busy} onClick={() => save()}>{busy ? "Salvando…" : "Salvar análise"}</Button></div>
          </div>
        ) : (
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{report.analysis || "A análise do mês será publicada aqui pela equipe."}</p>
        )}
      </Card>
      <Card>
        <p className="eyebrow">🚀 Próximos passos</p>
        <ul className="mt-3 grid gap-2">
          {steps.map((s, i) => (
            <li key={i} className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1" checked={s.done} disabled={!staff}
                onChange={(e) => { const next = steps.map((x, j) => (j === i ? { ...x, done: e.target.checked } : x)); setSteps(next); save(next); }} />
              <span className={s.done ? "text-muted-foreground line-through" : ""}>{s.text}</span>
              {staff && <button className="ml-auto text-muted-foreground hover:text-red-300" onClick={() => { const next = steps.filter((_, j) => j !== i); setSteps(next); save(next); }}>×</button>}
            </li>
          ))}
          {!steps.length && <li className="text-sm text-muted-foreground">{staff ? "Adicione os próximos passos ou use as sugestões abaixo." : "Em breve."}</li>}
        </ul>
        {staff && (
          <>
            <div className="mt-3 flex gap-2">
              <input value={newStep} onChange={(e) => setNewStep(e.target.value)} placeholder="Novo passo" className="flex-1 rounded-control border border-border bg-secondary p-2 text-sm" />
              <Button small variant="ghost" onClick={() => { if (!newStep.trim()) return; const next = [...steps, { text: newStep.trim(), done: false }]; setSteps(next); setNewStep(""); save(next); }}>Adicionar</Button>
            </div>
            {suggestions.length > 0 && (
              <div className="mt-4 rounded-control border border-primary/30 bg-primary/5 p-3">
                <p className="text-xs font-semibold text-[#c9c7ff]">Sugestões automáticas a partir dos dados</p>
                <ul className="mt-2 grid gap-2">
                  {suggestions.filter((s) => !steps.some((x) => x.text === s)).map((s) => (
                    <li key={s} className="flex items-start gap-2 text-sm">
                      <span className="flex-1">{s}</span>
                      <button className="shrink-0 text-xs font-semibold text-[#c9c7ff] underline" onClick={() => { const next = [...steps, { text: s, done: false }]; setSteps(next); save(next); }}>+ usar</button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}

function PublishToggle({ client, month, published, onDone }: { client: Client; month: string; published: boolean; onDone: (m: string) => void }) {
  const [on, setOn] = useState(published);
  const [busy, setBusy] = useState(false);
  return (
    <label className="flex items-center gap-2 rounded-control border border-border px-3 py-2 text-sm">
      <input type="checkbox" checked={on} disabled={busy} onChange={async (e) => {
        setBusy(true);
        try { await api.saveResults(client._id, { month, published: e.target.checked }); setOn(e.target.checked); onDone(e.target.checked ? "Resultados visíveis para o cliente." : "Resultados escondidos do cliente."); } finally { setBusy(false); }
      }} />
      Mostrar ao cliente
    </label>
  );
}

function ConnectMeta({ client, onClose, onDone }: { client: Client; onClose: () => void; onDone: () => void }) {
  const [status, setStatus] = useState<MetaStatus | null>(null);
  const [token, setToken] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const integ = client.integrations ?? {};
  const [ig, setIg] = useState(integ.igUserId ?? "");
  const [ad, setAd] = useState(integ.adAccountId ?? "");
  const load = () => api.metaStatus(true).then(setStatus).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);
  const igOpt = status?.assets?.instagram ?? [];
  const adOpt = status?.assets?.adAccounts ?? [];
  return (
    <Modal wide title={`Conexões do Meta — ${client.name}`} onClose={onClose}>
      <div className="grid gap-5">
        <div className="rounded-control border border-border p-4">
          <p className="font-semibold">1. Conexão da agência com o Meta</p>
          {status?.connected ? (
            <p className="mt-1 text-sm text-emerald-300">Conectado como {status.accountName}{status.expiresAt ? ` · validade: ${status.expiresAt === "nunca" ? "sem vencimento" : new Date(status.expiresAt).toLocaleDateString("pt-BR")}` : ""}</p>
          ) : <p className="mt-1 text-sm text-amber-300">Ainda não conectado.</p>}
          <details className="mt-2 text-sm text-muted-foreground">
            <summary className="cursor-pointer">{status?.connected ? "Trocar o token" : "Como conectar"}</summary>
            <ol className="mt-2 list-decimal space-y-1 pl-5">
              <li>No <b>Business Manager</b> da agência (business.facebook.com), em Configurações → Usuários do sistema, crie um usuário do sistema (Admin).</li>
              <li>Atribua a ele os ativos de cada cliente: Página, conta do Instagram e conta de anúncios.</li>
              <li>Clique em <b>Gerar token</b>, escolha o app da agência e marque: instagram_basic, instagram_manage_insights, pages_show_list, pages_read_engagement, ads_read. Validade: nunca expira.</li>
              <li>Cole o token aqui. Ele fica guardado só no servidor e nunca aparece de novo na tela.</li>
            </ol>
            <div className="mt-3 flex gap-2">
              <input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Cole o token do Meta" className="flex-1 rounded-control border border-border bg-secondary p-2 text-sm text-foreground" autoComplete="off" />
              <Button small disabled={busy || token.length < 50} onClick={async () => { setBusy(true); setErr(""); try { await api.saveMetaToken(token); setToken(""); await load(); } catch (x) { setErr(x instanceof Error ? x.message : String(x)); } finally { setBusy(false); } }}>Salvar token</Button>
            </div>
          </details>
        </div>
        <div className="rounded-control border border-border p-4">
          <p className="font-semibold">2. Contas deste cliente</p>
          {!status?.connected && <p className="mt-1 text-sm text-muted-foreground">Conecte o Meta primeiro.</p>}
          {status?.connected && (
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <Select label="Instagram" value={ig} onChange={setIg} options={[{ value: "", label: "Nenhum" }, ...igOpt.map((o) => ({ value: o.igUserId, label: `@${o.username} (${o.pageName})` }))]} />
              <Select label="Conta de anúncios" value={ad} onChange={setAd} options={[{ value: "", label: "Nenhuma" }, ...adOpt.map((o) => ({ value: o.id, label: `${o.name}${o.active ? "" : " (inativa)"}` }))]} />
              {(status.assets?.errors ?? []).map((e, i) => <p key={i} className="text-xs text-amber-300 sm:col-span-2">{e}</p>)}
              {igOpt.length === 0 && adOpt.length === 0 && <p className="text-xs text-muted-foreground sm:col-span-2">O token não enxerga nenhuma conta. Confira se os ativos do cliente foram atribuídos ao usuário do sistema.</p>}
            </div>
          )}
        </div>
        <ErrorText>{err}</ErrorText>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Fechar</Button>
          <Button disabled={busy || !status?.connected} onClick={async () => {
            setBusy(true); setErr("");
            const igSel = igOpt.find((o) => o.igUserId === ig);
            const adSel = adOpt.find((o) => o.id === ad);
            try {
              await api.saveIntegrations(client._id, { igUserId: ig, igUsername: igSel ? `@${igSel.username}` : "", pageId: igSel?.pageId ?? "", adAccountId: ad, adAccountName: adSel?.name ?? "" });
              onDone();
            } catch (x) { setErr(x instanceof Error ? x.message : String(x)); setBusy(false); }
          }}>Salvar contas do cliente</Button>
        </div>
      </div>
    </Modal>
  );
}
