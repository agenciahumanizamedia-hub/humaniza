// Agregação dos dados sincronizados por período e análise com evidências.
// Regra de ouro: dado ausente é null (a tela mostra "Dado indisponível"), nunca zero.
import type { Row } from "./db";

export const SRC = { ig: "Instagram (Meta)", ads: "Gerenciador de Anúncios (Meta)", os: "Agência Humaniza" } as const;
const ADDITIVE_IG = ["views", "total_interactions", "likes", "comments", "shares", "saves", "profile_views", "website_clicks", "follows", "unfollows"];

export const daysBetween = (de: string, ate: string) => {
  const out: string[] = [];
  for (let d = de; d <= ate; d = new Date(Date.parse(d + "T12:00:00Z") + 86400e3).toISOString().slice(0, 10)) out.push(d);
  return out;
};
const sum = (vals: (number | null | undefined)[]) => {
  const v = vals.filter((x): x is number => typeof x === "number");
  return v.length ? v.reduce((a, b) => a + b, 0) : null;
};
const avg = (vals: (number | null | undefined)[]) => {
  const v = vals.filter((x): x is number => typeof x === "number");
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};
const ratio = (a: number | null, b: number | null) => (a !== null && b ? a / b : null);

export function aggregateIg(dayRows: Row[], profileRows: Row[], mediaRows: Row[], de: string, ate: string) {
  const days = daysBetween(de, ate);
  const byDay = new Map(dayRows.map((r) => [r.date, r.data ?? {}]));
  const covered = days.filter((d) => byDay.has(d));
  const totals: Record<string, number | null> = {};
  for (const m of ADDITIVE_IG) totals[m] = sum(covered.map((d) => byDay.get(d)?.[m]));
  totals.reachDailyAvg = avg(covered.map((d) => byDay.get(d)?.reach));
  totals.engagedDailyAvg = avg(covered.map((d) => byDay.get(d)?.accounts_engaged));
  const profiles = profileRows.filter((r) => r.date >= de && r.date <= ate).sort((a, b) => a.date.localeCompare(b.date));
  const followers = profiles.length ? profiles[profiles.length - 1].data?.followers ?? null : null;
  const posts = mediaRows
    .filter((r) => r.date >= de && r.date <= ate)
    .map((r) => {
      const d = r.data ?? {};
      return { ...d, date: r.date, engagementRate: ratio(d.interactions ?? null, d.reach ?? null), syncedAt: r.fetchedAt };
    })
    .sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)));
  return {
    coverage: { days: days.length, withData: covered.length },
    totals,
    followers,
    profile: profiles.length ? profiles[profiles.length - 1].data : null,
    series: days.map((d) => ({ date: d, ...(byDay.get(d) ?? {}) })),
    posts,
  };
}

export function aggregateAds(rows: Row[], de: string, ate: string) {
  const days = daysBetween(de, ate);
  const inRange = rows.filter((r) => r.date >= de && r.date <= ate).map((r) => r.data ?? {});
  const byCampaign = new Map<string, any[]>();
  for (const r of inRange) byCampaign.set(r.campaignId, [...(byCampaign.get(r.campaignId) ?? []), r]);
  const campaigns = [...byCampaign.values()].map((list) => {
    const last = list[list.length - 1];
    const indicators = list.map((x) => x.resultIndicator).filter(Boolean);
    const indicator = indicators.sort((a, b) => indicators.filter((v) => v === b).length - indicators.filter((v) => v === a).length)[0] ?? "";
    const spend = sum(list.map((x) => x.spend)) ?? 0;
    const results = list.some((x) => x.results !== null && x.results !== undefined) ? sum(list.map((x) => x.results)) : null;
    const conversations = list.some((x) => x.conversations !== null && x.conversations !== undefined) ? sum(list.map((x) => x.conversations)) : null;
    const impressions = sum(list.map((x) => x.impressions));
    const clicks = sum(list.map((x) => x.clicks));
    return {
      id: last.campaignId, name: last.campaign, objective: last.objective, currency: last.currency ?? "BRL", resultIndicator: indicator,
      resultLabel: resultLabel(indicator, last.objective), spend, results, costPerResult: results ? spend / results : null,
      conversations, costPerConversation: conversations ? spend / conversations : null, impressions, clicks,
      ctr: impressions && clicks !== null ? (clicks / impressions) * 100 : null, cpc: clicks ? spend / clicks : null,
    };
  }).sort((a, b) => b.spend - a.spend);
  const spendTotal = sum(inRange.map((r) => r.spend));
  const conv = inRange.some((r) => r.conversations !== null && r.conversations !== undefined) ? sum(inRange.map((r) => r.conversations)) : null;
  const daily = new Map<string, number>();
  for (const r of inRange) daily.set(r.date, (daily.get(r.date) ?? 0) + (r.spend ?? 0));
  const daysWithRows = new Set(inRange.map((r) => r.date));
  return {
    coverage: { days: days.length, withData: daysWithRows.size },
    totals: {
      spend: spendTotal, conversations: conv, costPerConversation: conv && spendTotal ? spendTotal / conv : null,
      impressions: sum(inRange.map((r) => r.impressions)), clicks: sum(inRange.map((r) => r.clicks)),
    },
    campaigns,
    series: days.map((d) => ({ date: d, spend: daily.has(d) ? daily.get(d)! : null })),
  };
}

export function resultLabel(indicator: string, objective: string) {
  const i = indicator.toLowerCase();
  if (i.includes("messaging_conversation_started")) return "Conversas iniciadas";
  if (i.includes("lead")) return "Leads (cadastros)";
  if (i.includes("purchase")) return "Compras";
  if (i.includes("landing_page_view")) return "Visualizações da página";
  if (i.includes("link_click")) return "Cliques no link";
  if (i.includes("post_engagement")) return "Engajamentos com o post";
  if (i.includes("video_view") || i.includes("thruplay")) return "Visualizações do vídeo";
  if (i.includes("reach")) return "Pessoas alcançadas";
  if (i.includes("follow") || i.includes("like")) return "Seguidores / curtidas";
  if (i) return indicator;
  const o = objective.toUpperCase();
  if (o.includes("ENGAGEMENT") || o.includes("MESSAGES")) return "Engajamento / mensagens (definido no Gerenciador)";
  if (o.includes("LEADS")) return "Leads";
  if (o.includes("SALES")) return "Vendas";
  if (o.includes("TRAFFIC")) return "Tráfego";
  if (o.includes("AWARENESS")) return "Reconhecimento";
  return "Resultado não informado pelo Meta";
}

const fmt = (n: number) => Math.round(n).toLocaleString("pt-BR");
const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pctTxt = (n: number) => `${(n * 100).toFixed(1).replace(".", ",")}%`;
const change = (a: number | null, b: number | null) => (a !== null && b ? (a - b) / b : null);

type Ev = { label: string; value: string; source: string };
export type Suggestion = { id: string; kind: "funcionou" | "repetir" | "melhorar" | "teste"; text: string; evidence: Ev[] };

/** Sugestões automáticas — cada uma mostra os números em que se baseia. */
export function suggest(ig: ReturnType<typeof aggregateIg> | null, prevIg: ReturnType<typeof aggregateIg> | null, ads: ReturnType<typeof aggregateAds> | null, deliveries: { planned: number; posted: number }): Suggestion[] {
  const out: Suggestion[] = [];
  if (ig && ig.posts.length) {
    const withRate = ig.posts.filter((p: any) => p.engagementRate !== null && p.type !== "Story");
    const best = [...withRate].sort((a: any, b: any) => b.engagementRate - a.engagementRate)[0] as any;
    if (best)
      out.push({ id: "melhor-post", kind: "funcionou", text: `O ${best.type} de ${String(best.date).split("-").reverse().join("/")} foi o que mais engajou quem viu.`,
        evidence: [{ label: "Taxa de interações sobre alcance", value: pctTxt(best.engagementRate), source: SRC.ig }, { label: "Alcance do post", value: fmt(best.reach), source: SRC.ig }] });
    const types = new Map<string, any[]>();
    for (const p of withRate) types.set(p.type, [...(types.get(p.type) ?? []), p]);
    const ranked = [...types.entries()].filter(([, l]) => l.length >= 2).map(([t, l]) => ({ t, n: l.length, rate: l.reduce((s, p) => s + p.engagementRate, 0) / l.length })).sort((a, b) => b.rate - a.rate);
    if (ranked.length >= 2)
      out.push({ id: "formato", kind: "repetir", text: `Repetir mais ${ranked[0].t}: engajou mais que ${ranked[ranked.length - 1].t} no período.`,
        evidence: [{ label: `${ranked[0].t} (${ranked[0].n} posts)`, value: pctTxt(ranked[0].rate), source: SRC.ig }, { label: `${ranked[ranked.length - 1].t} (${ranked[ranked.length - 1].n} posts)`, value: pctTxt(ranked[ranked.length - 1].rate), source: SRC.ig }] });
    const saver = [...ig.posts].filter((p: any) => typeof p.saves === "number").sort((a: any, b: any) => b.saves - a.saves)[0] as any;
    if (saver?.saves) out.push({ id: "salvos", kind: "repetir", text: "Transformar o tema do post mais salvo em série ou carrossel educativo.", evidence: [{ label: "Salvamentos", value: fmt(saver.saves), source: SRC.ig }] });
    const r = change(ig.totals.reachDailyAvg ?? null, prevIg?.totals.reachDailyAvg ?? null);
    if (r !== null && r < -0.1)
      out.push({ id: "alcance", kind: "melhorar", text: "O alcance caiu em relação ao período anterior: reforçar Reels com gancho nos 3 primeiros segundos e publicar nos horários de maior resposta.",
        evidence: [{ label: "Alcance diário médio", value: `${fmt(ig.totals.reachDailyAvg!)} (antes ${fmt(prevIg!.totals.reachDailyAvg!)})`, source: SRC.ig }] });
    const hours = new Map<number, number[]>();
    for (const p of withRate) {
      const h = new Date(Date.parse(p.timestamp) - 3 * 3600e3).getUTCHours();
      hours.set(h, [...(hours.get(h) ?? []), p.engagementRate]);
    }
    const hr = [...hours.entries()].filter(([, v]) => v.length >= 2).map(([h, v]) => [h, v.reduce((a, b) => a + b, 0) / v.length] as const).sort((a, b) => b[1] - a[1])[0];
    if (hr) out.push({ id: "horario", kind: "teste", text: `Teste no próximo período: concentrar as publicações principais por volta das ${String(hr[0]).padStart(2, "0")}h e comparar.`,
      evidence: [{ label: `Engajamento médio às ${hr[0]}h`, value: pctTxt(hr[1]), source: SRC.ig }] });
  }
  if (deliveries.planned && deliveries.posted < deliveries.planned)
    out.push({ id: "entregas", kind: "melhorar", text: "Parte do planejado não foi marcada como postada: revisar o fluxo de aprovação e agendamento.",
      evidence: [{ label: "Planejados x postados", value: `${deliveries.planned} x ${deliveries.posted}`, source: SRC.os }] });
  if (ads && ads.campaigns.length) {
    const withCost = ads.campaigns.filter((c) => c.costPerResult !== null);
    const best = [...withCost].sort((a, b) => a.costPerResult! - b.costPerResult!)[0];
    if (best) out.push({ id: "campanha", kind: "funcionou", text: `A campanha “${best.name}” entregou o menor custo por resultado (${best.resultLabel.toLowerCase()}).`,
      evidence: [{ label: "Custo por resultado", value: brl(best.costPerResult!), source: SRC.ads }, { label: "Resultados", value: fmt(best.results!), source: SRC.ads }] });
    const lowCtr = ads.campaigns.find((c) => c.ctr !== null && c.ctr < 1 && c.spend > 30);
    if (lowCtr) out.push({ id: "ctr", kind: "melhorar", text: `Renovar criativos da campanha “${lowCtr.name}”: poucas pessoas clicam no anúncio.`,
      evidence: [{ label: "CTR", value: `${lowCtr.ctr!.toFixed(2).replace(".", ",")}%`, source: SRC.ads }] });
    if (ig?.posts.length) out.push({ id: "impulsionar", kind: "teste", text: "Teste: impulsionar o melhor post orgânico do período como anúncio e comparar o custo por resultado.",
      evidence: [{ label: "Base", value: "melhor post orgânico + custo por resultado atual", source: `${SRC.ig} e ${SRC.ads}` }] });
  }
  return out;
}
