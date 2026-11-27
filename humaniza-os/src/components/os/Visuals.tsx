// Peças visuais do painel de desempenho: números animados, destaque do período, anéis de progresso,
// rosca de formatos, minigráficos, feed do período, funil de anúncios, melhor horário e contagem
// regressiva das próximas datas. Tudo com dados reais; sem dado, a peça mostra o estado vazio.
import { useEffect, useMemo, useState } from "react";
import type { Performance, Post } from "./api";
import { brDate } from "./ui";

export const FORMAT_COLOR: Record<string, string> = { roteiro: "#7B76FF", Reels: "#7B76FF", "Vídeo": "#7B76FF", carrossel: "#E0607E", Carrossel: "#E0607E", estatico: "#2A9DB0", "Estático": "#2A9DB0" };
const TYPE_PT: Record<string, string> = { roteiro: "Reels", carrossel: "Carrossel", estatico: "Estático" };
const reduced = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
const nf = (v: number) => Math.round(v).toLocaleString("pt-BR");

/** Número que sobe até o valor (respeita "reduzir movimento"). */
export function CountUp({ value, format = nf, ms = 900 }: { value: number; format?: (v: number) => string; ms?: number }) {
  const [v, setV] = useState(reduced() ? value : 0);
  useEffect(() => {
    if (reduced()) return setV(value);
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / ms);
      setV(value * (1 - Math.pow(1 - k, 3)));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);
  return <>{format(v)}</>;
}

/** Anel de progresso (ex.: postados / planejados). */
export function Ring({ value, total, label, sub, color = "#7B76FF" }: { value: number; total: number; label: string; sub: string; color?: string }) {
  const r = 34, c = 2 * Math.PI * r;
  const k = total ? Math.min(1, value / total) : 0;
  const [shown, setShown] = useState(reduced() ? k : 0);
  useEffect(() => { const t = setTimeout(() => setShown(k), 60); return () => clearTimeout(t); }, [k]);
  return (
    <div className="flex items-center gap-3" title={`${label}: ${value} de ${total}`}>
      <svg viewBox="0 0 80 80" className="h-20 w-20 shrink-0 -rotate-90">
        <circle cx="40" cy="40" r={r} fill="none" stroke="#333" strokeWidth="8" />
        <circle cx="40" cy="40" r={r} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - shown)} style={{ transition: "stroke-dashoffset 1s cubic-bezier(.2,.7,.2,1)" }} />
      </svg>
      <div>
        <p className="text-2xl font-extrabold tabular-nums">{total ? <CountUp value={k * 100} format={(x) => `${Math.round(x)}%`} /> : "—"}</p>
        <p className="text-sm font-semibold">{label}</p>
        <p className="text-xs text-muted-foreground">{sub}</p>
      </div>
    </div>
  );
}

/** Rosca de formatos entregues, com legenda e rótulos diretos. */
export function FormatDonut({ rows }: { rows: { type: string; count: number }[] }) {
  const total = rows.reduce((s, r) => s + r.count, 0);
  const [hover, setHover] = useState<string | null>(null);
  if (!total) return <p className="text-sm text-muted-foreground">Sem conteúdos com data neste período.</p>;
  const R = 42, C = 2 * Math.PI * R;
  let acc = 0;
  return (
    <div className="flex flex-wrap items-center gap-5">
      <div className="relative h-36 w-36 shrink-0">
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
          {rows.filter((r) => r.count).map((r) => {
            const len = (r.count / total) * C;
            const el = (
              <circle key={r.type} cx="50" cy="50" r={R} fill="none" stroke={FORMAT_COLOR[r.type]} strokeWidth={hover === r.type ? 14 : 11}
                strokeDasharray={`${Math.max(0, len - 1.5)} ${C - Math.max(0, len - 1.5)}`} strokeDashoffset={-acc} className="hz-fade cursor-pointer transition-all"
                onMouseEnter={() => setHover(r.type)} onMouseLeave={() => setHover(null)} onClick={() => setHover(hover === r.type ? null : r.type)} />
            );
            acc += len;
            return el;
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <b className="text-3xl tabular-nums"><CountUp value={hover ? rows.find((r) => r.type === hover)!.count : total} /></b>
          <span className="text-[11px] text-muted-foreground">{hover ? TYPE_PT[hover] : "conteúdos"}</span>
        </div>
      </div>
      <ul className="grid gap-2 text-sm">
        {rows.filter((r) => r.count).map((r) => (
          <li key={r.type} className="flex items-center gap-2" onMouseEnter={() => setHover(r.type)} onMouseLeave={() => setHover(null)}>
            <i className="h-3 w-3 rounded-sm" style={{ background: FORMAT_COLOR[r.type] }} />
            <span className="w-20">{TYPE_PT[r.type]}</span>
            <b className="tabular-nums">{r.count}</b>
            <span className="text-xs text-muted-foreground">({Math.round((r.count / total) * 100)}%)</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Minigráfico de linha para os cartões de indicador. */
export function Sparkline({ values, color = "#7B76FF" }: { values: (number | null)[]; color?: string }) {
  const nums = values.filter((v): v is number => typeof v === "number");
  if (nums.length < 2) return null;
  const max = Math.max(...nums) || 1, min = Math.min(...nums);
  const W = 100, H = 28;
  let d = "", pen = false;
  values.forEach((v, i) => {
    if (typeof v !== "number") { pen = false; return; }
    const x = (i / (values.length - 1)) * W, y = H - ((v - min) / (max - min || 1)) * (H - 4) - 2;
    d += `${pen ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)} `;
    pen = true;
  });
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="mt-2 h-7 w-full" aria-hidden>
      <path d={d} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" className="hz-fade" />
    </svg>
  );
}

/** Destaque do período: gira entre os líderes de cada objetivo (alcance, interações, salvos…). */
export function Spotlight({ posts, brand }: { posts: Post[]; brand: string }) {
  const leaders = useMemo(() => {
    const feed = posts.filter((p) => p.type !== "Story");
    const pick = (key: keyof Post, label: string, unit: string) => {
      const top = [...feed].filter((p) => typeof p[key] === "number").sort((a: any, b: any) => b[key] - a[key])[0];
      return top ? { post: top, label, unit, value: top[key] as number } : null;
    };
    return [pick("interactions", "Mais interações", "interações"), pick("reach", "Maior alcance", "contas alcançadas"), pick("saves", "Mais salvo", "salvamentos"), pick("shares", "Mais compartilhado", "compartilhamentos")].filter(Boolean) as { post: Post; label: string; unit: string; value: number }[];
  }, [posts]);
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused || leaders.length < 2 || reduced()) return;
    const t = setInterval(() => setI((x) => (x + 1) % leaders.length), 5000);
    return () => clearInterval(t);
  }, [leaders.length, paused]);
  if (!leaders.length) return null;
  const cur = leaders[i % leaders.length];
  const p = cur.post;
  return (
    <div className="relative overflow-hidden rounded-lg border border-border" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
      style={{ background: `radial-gradient(circle at 85% 0%, ${brand}55, transparent 55%), #1f1f1f` }}>
      <div key={p.id + cur.label} className="hz-rise grid gap-5 p-5 sm:grid-cols-[minmax(0,220px)_1fr] sm:p-6">
        <a href={p.permalink} target="_blank" rel="noreferrer" className="group relative block aspect-[4/5] overflow-hidden rounded-control bg-black/40 shadow-2xl">
          {p.thumb ? <img src={p.thumb} alt={`Capa do ${p.type}`} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" /> : <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Capa indisponível</div>}
          <span className="absolute right-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[11px]">{p.type}</span>
          <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2 text-xs opacity-0 transition group-hover:opacity-100">Abrir no Instagram ↗</span>
        </a>
        <div className="flex min-w-0 flex-col justify-center">
          <p className="eyebrow">⭐ Conteúdo destaque · {cur.label}</p>
          <p className="mt-2 text-5xl font-extrabold leading-none tabular-nums sm:text-6xl"><CountUp value={cur.value} /></p>
          <p className="text-sm text-muted-foreground">{cur.unit} · {p.type} publicado em {brDate(p.date)}</p>
          <p className="mt-3 line-clamp-3 text-sm">{p.caption || "Sem legenda"}</p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            {[["👁", p.reach, "alcance"], ["❤", p.likes, "curtidas"], ["💬", p.comments, "comentários"], ["🔖", p.saves, "salvos"], ["↗", p.shares, "compart."]].map(([ic, v, l]) => (
              <span key={String(l)} className="rounded-full border border-border bg-black/30 px-2.5 py-1">{ic} {typeof v === "number" ? nf(v) : "—"} {l}</span>
            ))}
          </div>
          {leaders.length > 1 && (
            <div className="mt-4 flex items-center gap-2">
              {leaders.map((l, k) => (
                <button key={l.label} onClick={() => setI(k)} aria-label={l.label} className={`h-2 rounded-full transition-all ${k === i % leaders.length ? "w-6 bg-primary" : "w-2 bg-white/25"}`} />
              ))}
              <span className="ml-2 text-[11px] text-muted-foreground">Fonte: Instagram (Meta)</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Destaque da produção (sem Instagram conectado): conteúdo mais recente aprovado/postado. */
export function ProductionSpotlight({ items, brand }: { items: NonNullable<Performance["delivery"]>["items"]; brand: string }) {
  const best = [...items].sort((a, b) => score(b) - score(a) || b.postDate.localeCompare(a.postDate))[0];
  if (!best) return null;
  return (
    <div className="hz-rise relative overflow-hidden rounded-lg border border-border p-6" style={{ background: `linear-gradient(120deg, ${brand}66, #1f1f1f 65%)` }}>
      <p className="eyebrow">⭐ Destaque da produção</p>
      <p className="mt-2 max-w-2xl text-2xl font-extrabold leading-tight sm:text-3xl">{best.title || "Conteúdo sem tema"}</p>
      <p className="mt-2 text-sm text-muted-foreground">{TYPE_PT[best.type]} · {brDate(best.postDate)} · {best.clientApproval === "Aprovado" ? "aprovado pelo cliente" : best.status}</p>
      <p className="mt-4 text-[11px] text-muted-foreground">Fonte: Agência Humaniza. Conecte o Instagram para ver qual conteúdo teve mais resultado.</p>
    </div>
  );
}
const score = (x: { status: string; clientApproval: string }) => (x.status === "Postado" ? 3 : x.clientApproval === "Aprovado" || x.status === "Aprovado" ? 2 : 1);

/** Feed do período no formato do Instagram: capas reais ou, sem conexão, os conteúdos planejados. */
export function PeriodFeed({ posts, items, brand }: { posts: Post[]; items: NonNullable<Performance["delivery"]>["items"]; brand: string }) {
  const real = posts.filter((p) => p.type !== "Story").slice(0, 9);
  if (real.length) {
    return (
      <div className="mx-auto grid max-w-md grid-cols-3 gap-1">
        {real.map((p, k) => (
          <a key={p.id} href={p.permalink} target="_blank" rel="noreferrer" className="hz-fade group relative aspect-square overflow-hidden bg-black/40" style={{ animationDelay: `${k * 50}ms` }}>
            {p.thumb ? <img src={p.thumb} alt="" loading="lazy" className="h-full w-full object-cover transition duration-300 group-hover:scale-105" /> : null}
            <span className="absolute inset-0 flex items-center justify-center gap-3 bg-black/60 text-xs font-semibold opacity-0 transition group-hover:opacity-100">
              ❤ {typeof p.likes === "number" ? nf(p.likes) : "—"} 💬 {typeof p.comments === "number" ? nf(p.comments) : "—"}
            </span>
            {p.type !== "Estático" && <span className="absolute right-1 top-1 text-xs drop-shadow">{p.type === "Carrossel" ? "❐" : "▶"}</span>}
          </a>
        ))}
      </div>
    );
  }
  const planned = [...items].sort((a, b) => a.postDate.localeCompare(b.postDate)).slice(0, 9);
  if (!planned.length) return <p className="text-sm text-muted-foreground">Sem conteúdos neste período.</p>;
  return (
    <div className="mx-auto grid max-w-md grid-cols-3 gap-1">
      {planned.map((c, k) => (
        <div key={c._id} className="hz-fade relative aspect-square overflow-hidden p-2 text-[11px] leading-tight text-white" style={{ animationDelay: `${k * 50}ms`, background: `linear-gradient(160deg, ${FORMAT_COLOR[c.type] ?? brand}, #1C1C1C)` }}>
          <span className="line-clamp-4 font-bold">{c.title || "Sem tema"}</span>
          <span className="absolute bottom-1.5 left-2 right-2 flex justify-between opacity-80"><span>{brDate(c.postDate).slice(0, 5)}</span><span>{c.status === "Postado" ? "✓" : ""}</span></span>
          <span className="absolute right-1.5 top-1.5">{c.type === "roteiro" ? "▶" : c.type === "carrossel" ? "❐" : ""}</span>
        </div>
      ))}
    </div>
  );
}

/** Funil dos anúncios: impressões → cliques → conversas. */
export function AdsFunnel({ impressions, clicks, conversations }: { impressions: number | null; clicks: number | null; conversations: number | null }) {
  const steps = [["Impressões", impressions], ["Cliques no link", clicks], ["Conversas iniciadas", conversations]] as [string, number | null][];
  const valid = steps.filter(([, v]) => typeof v === "number" && v > 0) as [string, number][];
  if (valid.length < 2) return <p className="text-sm text-muted-foreground">Dado indisponível</p>;
  const max = Math.log10(valid[0][1] + 1);
  return (
    <div className="grid gap-2">
      {steps.map(([label, v], k) => (
        <div key={label}>
          <div className="flex justify-between text-sm"><span>{label}</span><b className="tabular-nums">{typeof v === "number" ? <CountUp value={v} /> : "indisponível"}</b></div>
          <div className="mt-1 h-3 rounded-full bg-white/5">
            {typeof v === "number" && v > 0 && <div className="hz-grow h-3 rounded-full bg-primary" style={{ width: `${Math.max(4, (Math.log10(v + 1) / max) * 100)}%`, animationDelay: `${k * 150}ms`, opacity: 1 - k * 0.2 }} />}
          </div>
          {k > 0 && typeof v === "number" && typeof steps[k - 1][1] === "number" && steps[k - 1][1]! > 0 && (
            <p className="text-[11px] text-muted-foreground">{((v / steps[k - 1][1]!) * 100).toFixed(1).replace(".", ",")}% da etapa anterior</p>
          )}
        </div>
      ))}
      <p className="text-[11px] text-muted-foreground">Barras em escala logarítmica. Fonte: Gerenciador de Anúncios (Meta).</p>
    </div>
  );
}

/** Melhor momento para postar: engajamento médio por dia da semana e turno. */
export function BestTime({ posts }: { posts: Post[] }) {
  const days = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const turns = [["Manhã", 5, 12], ["Tarde", 12, 18], ["Noite", 18, 29]] as const;
  const cells = useMemo(() => {
    const m = new Map<string, number[]>();
    for (const p of posts) {
      if (p.engagementRate === null || p.type === "Story") continue;
      const d = new Date(Date.parse(p.timestamp) - 3 * 3600e3);
      const h = d.getUTCHours() < 5 ? d.getUTCHours() + 24 : d.getUTCHours();
      const t = turns.findIndex(([, a, b]) => h >= a && h < b);
      const key = `${d.getUTCDay()}-${t}`;
      m.set(key, [...(m.get(key) ?? []), p.engagementRate]);
    }
    return m;
  }, [posts]);
  if (cells.size < 3) return <p className="text-sm text-muted-foreground">Poucas publicações no período para indicar um horário.</p>;
  const avg = (k: string) => { const v = cells.get(k); return v ? v.reduce((a, b) => a + b, 0) / v.length : null; };
  const all = [...cells.keys()].map(avg).filter((x): x is number => x !== null);
  const max = Math.max(...all);
  const bestKey = [...cells.keys()].sort((a, b) => (avg(b) ?? 0) - (avg(a) ?? 0))[0];
  const [bd, bt] = bestKey.split("-").map(Number);
  return (
    <div>
      <div className="grid grid-cols-[48px_repeat(7,minmax(0,1fr))] gap-1 text-[11px]">
        <span />
        {days.map((d) => <span key={d} className="text-center text-muted-foreground">{d}</span>)}
        {turns.map(([label], t) => (
          <div key={label} className="contents">
            <span className="self-center text-muted-foreground">{label}</span>
            {days.map((_, d) => {
              const v = avg(`${d}-${t}`);
              return (
                <div key={d} title={v === null ? "sem posts" : `${(v * 100).toFixed(1)}% de interação (${cells.get(`${d}-${t}`)!.length} posts)`}
                  className={`aspect-square rounded ${d === bd && t === bt ? "ring-2 ring-white" : ""}`}
                  style={{ background: v === null ? "#2a2a2a" : `rgba(123,118,255,${0.2 + 0.8 * (v / max)})` }} />
              );
            })}
          </div>
        ))}
      </div>
      <p className="mt-2 text-sm">Melhor momento: <b>{days[bd]} · {turns[bt][0].toLowerCase()}</b></p>
      <p className="text-[11px] text-muted-foreground">Cor mais forte = mais interação por pessoa alcançada. Fonte: Instagram (Meta).</p>
    </div>
  );
}

/** Próximas datas com contagem regressiva. */
export function Countdown({ items }: { items: NonNullable<Performance["upcoming"]> }) {
  if (!items.length) return <p className="text-sm text-muted-foreground">Nenhuma data liberada para os próximos 60 dias.</p>;
  const today = new Date(new Date().toDateString()).getTime();
  return (
    <div className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-2">
      {items.map((u, k) => {
        const days = Math.round((new Date(u.date + "T00:00").getTime() - today) / 86400e3);
        return (
          <div key={u._id} className="hz-rise min-w-[170px] snap-start rounded-control border border-border bg-secondary p-3" style={{ animationDelay: `${k * 70}ms` }}>
            <p className="text-3xl font-extrabold tabular-nums">{days <= 0 ? "Hoje" : <><CountUp value={days} /><span className="ml-1 text-sm font-semibold text-muted-foreground">dias</span></>}</p>
            <p className="mt-1 line-clamp-2 font-semibold">{u.title}</p>
            <p className="text-xs text-muted-foreground">{brDate(u.date)} · {u.kind}</p>
          </div>
        );
      })}
    </div>
  );
}
