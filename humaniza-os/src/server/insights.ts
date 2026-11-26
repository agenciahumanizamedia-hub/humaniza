// Análise automática dos resultados do mês (regras, sem IA): melhores posts, melhor formato,
// melhores dias/horários, comparação com o mês anterior, saúde dos anúncios e próximos passos.
type Post = { id: string; type: string; caption: string; permalink: string; thumb: string; timestamp: string; likes: number; comments: number; saves: number; shares: number; reach: number; views: number; interactions: number; engagementRate: number };
type Ig = { profile: { followers: number }; totals: Record<string, number>; posts: Post[] } | null;
type Ads = { totals: Record<string, number>; campaigns: any[] } | null;

const pct = (a: number, b: number) => (b ? ((a - b) / b) * 100 : 0);
const fmtPct = (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(0)}%`;
const fmt = (n: number) => Math.round(n).toLocaleString("pt-BR");
const money = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const WEEK = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

export function analyze(input: { ig: Ig; prevIg: Ig; ads: Ads; prevAds: Ads; planned: number; posted: number }) {
  const { ig, prevIg, ads, prevAds } = input;
  const highlights: string[] = [];
  const alerts: string[] = [];
  const nextSteps: string[] = [];
  let bestPosts: Post[] = [];
  let worstPost: Post | null = null;
  let formats: { type: string; count: number; avgReach: number; avgEngagement: number; avgSaves: number }[] = [];
  let bestWeekday = "";
  let bestHour = "";

  if (ig) {
    const feed = ig.posts.filter((p) => p.type !== "Story");
    const valid = feed.filter((p) => p.reach > 0);
    bestPosts = [...valid].sort((a, b) => b.engagementRate - a.engagementRate || b.reach - a.reach).slice(0, 3);
    worstPost = valid.length > 3 ? [...valid].sort((a, b) => a.engagementRate - b.engagementRate)[0] : null;

    const byType = new Map<string, Post[]>();
    for (const p of feed) byType.set(p.type, [...(byType.get(p.type) ?? []), p]);
    formats = [...byType.entries()]
      .map(([type, list]) => ({
        type, count: list.length,
        avgReach: list.reduce((s, p) => s + p.reach, 0) / list.length,
        avgEngagement: list.reduce((s, p) => s + p.engagementRate, 0) / list.length,
        avgSaves: list.reduce((s, p) => s + p.saves, 0) / list.length,
      }))
      .sort((a, b) => b.avgEngagement - a.avgEngagement);

    const group = (key: (p: Post) => number) => {
      const m = new Map<number, number[]>();
      for (const p of valid) m.set(key(p), [...(m.get(key(p)) ?? []), p.engagementRate]);
      return [...m.entries()].filter(([, v]) => v.length >= 2).map(([k, v]) => [k, v.reduce((a, b) => a + b, 0) / v.length] as const).sort((a, b) => b[1] - a[1])[0];
    };
    const tz = (p: Post) => new Date(new Date(p.timestamp).toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const wd = group((p) => tz(p).getDay());
    const hr = group((p) => tz(p).getHours());
    if (wd) bestWeekday = WEEK[wd[0]];
    if (hr) bestHour = `${String(hr[0]).padStart(2, "0")}h`;

    const t = ig.totals;
    if (feed.length) highlights.push(`${feed.length} publicações no feed neste mês (${formats.map((f) => `${f.count} ${f.type}`).join(", ")}).`);
    if (prevIg) {
      const dr = pct(t.reach ?? 0, prevIg.totals.reach ?? 0);
      const di = pct(t.total_interactions ?? 0, prevIg.totals.total_interactions ?? 0);
      if (prevIg.totals.reach) (dr >= 0 ? highlights : alerts).push(`Alcance ${fmtPct(dr)} em relação ao mês anterior (${fmt(t.reach ?? 0)} contas).`);
      if (prevIg.totals.total_interactions) (di >= 0 ? highlights : alerts).push(`Interações ${fmtPct(di)} em relação ao mês anterior (${fmt(t.total_interactions ?? 0)}).`);
    }
    if (t.follows) highlights.push(`${fmt(t.follows)} novos seguidores${t.unfollows ? ` e ${fmt(t.unfollows)} deixaram de seguir` : ""}.`);
    if (bestPosts[0]) highlights.push(`Melhor post: ${bestPosts[0].type} de ${new Date(bestPosts[0].timestamp).toLocaleDateString("pt-BR")} com ${(bestPosts[0].engagementRate * 100).toFixed(1)}% de engajamento sobre o alcance.`);
    if (formats.length >= 2) {
      nextSteps.push(`Priorizar ${formats[0].type}: teve o melhor engajamento médio (${(formats[0].avgEngagement * 100).toFixed(1)}%). Rever o formato ${formats[formats.length - 1].type}, que ficou abaixo.`);
    }
    const saver = [...valid].sort((a, b) => b.saves - a.saves)[0];
    if (saver?.saves) nextSteps.push(`O post mais salvo teve ${fmt(saver.saves)} salvamentos: transformar o tema dele em série ou carrossel educativo.`);
    if (bestWeekday || bestHour) nextSteps.push(`Concentrar as postagens principais ${bestWeekday ? `na ${bestWeekday}` : ""}${bestWeekday && bestHour ? ", " : ""}${bestHour ? `por volta das ${bestHour}` : ""} — onde o engajamento foi maior.`);
    if (feed.length && feed.length < 8) alerts.push(`Só ${feed.length} posts no feed: abaixo do ritmo recomendado (2 a 3 por semana).`);
    const reels = formats.find((f) => f.type === "Reels");
    if (!reels && feed.length) nextSteps.push("Incluir Reels no próximo mês: é o formato que mais leva a conta para quem ainda não segue.");
    if (worstPost) alerts.push(`Post com menor resposta: ${worstPost.type} de ${new Date(worstPost.timestamp).toLocaleDateString("pt-BR")} — revisar gancho e capa.`);
  }

  if (input.planned) {
    if (input.posted < input.planned) alerts.push(`${input.posted} de ${input.planned} conteúdos planejados foram marcados como postados.`);
    else highlights.push(`Todos os ${input.planned} conteúdos planejados foram entregues.`);
  }

  if (ads && ads.totals.spend) {
    const a = ads.totals;
    highlights.push(`Investimento em anúncios: ${money(a.spend)} · ${fmt(a.results)} resultados${a.costPerResult ? ` a ${money(a.costPerResult)} cada` : ""}.`);
    if (a.ctr && a.ctr < 1) alerts.push(`CTR dos anúncios em ${a.ctr.toFixed(2)}% (abaixo de 1%): testar novos criativos e chamadas.`);
    if (a.frequency > 3.5) alerts.push(`Frequência alta (${a.frequency.toFixed(1)}): o público está vendo o mesmo anúncio muitas vezes — renovar criativos ou ampliar público.`);
    if (prevAds?.totals.costPerResult && a.costPerResult) {
      const d = pct(a.costPerResult, prevAds.totals.costPerResult);
      (d <= 0 ? highlights : alerts).push(`Custo por resultado ${fmtPct(d)} em relação ao mês anterior.`);
    }
    const best = [...ads.campaigns].filter((c) => c.results).sort((x, y) => x.costPerResult - y.costPerResult)[0];
    if (best) nextSteps.push(`Reforçar a verba na campanha “${best.name}”, a de menor custo por resultado (${money(best.costPerResult)}).`);
    if (bestPosts[0]) nextSteps.push("Impulsionar o melhor post orgânico do mês como anúncio: já provou que o público responde.");
  }
  if (!nextSteps.length) nextSteps.push("Conectar o Instagram e a conta de anúncios do cliente para gerar a análise automática.");
  return { highlights, alerts, nextSteps, bestPosts, worstPost, formats, bestWeekday, bestHour };
}
