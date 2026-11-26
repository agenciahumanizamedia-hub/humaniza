// Integração com o Meta (Instagram profissional e Gerenciador de Anúncios) pela Graph API.
//
// O token de acesso fica só no servidor (coleção osSettings, permissão ADMIN) e nunca é enviado ao
// navegador. Recomendado: token de "usuário do sistema" do Business Manager da agência, com as
// permissões instagram_basic, instagram_manage_insights, pages_show_list, pages_read_engagement e
// ads_read, e com os ativos (Página, Instagram e conta de anúncios) de cada cliente compartilhados
// com a agência.
import { COLLECTIONS, find, create, replace, type Row } from "./db";
import { HttpError } from "./access";

const GRAPH = "https://graph.facebook.com/v23.0";

export async function getMetaSettings(): Promise<Row | null> {
  const rows = await find(COLLECTIONS.settings, { key: "meta" }, { limit: 1 });
  return rows[0] ?? null;
}

export async function saveMetaToken(token: string, by: string): Promise<{ name: string; expiresAt: string }> {
  const me = await graph<any>("/me", { fields: "id,name" }, token);
  let expiresAt = "";
  try {
    const dbg = await graph<any>("/debug_token", { input_token: token }, token);
    const exp = dbg?.data?.expires_at;
    expiresAt = exp ? new Date(exp * 1000).toISOString() : "nunca";
  } catch {
    expiresAt = "";
  }
  const existing = await getMetaSettings();
  const data = { token, accountName: me.name ?? "", accountId: me.id ?? "", expiresAt, savedBy: by, savedAt: new Date().toISOString() };
  if (existing) await replace(COLLECTIONS.settings, { ...existing, data });
  else await create(COLLECTIONS.settings, { key: "meta", data });
  return { name: data.accountName, expiresAt };
}

async function token(): Promise<string> {
  const s = await getMetaSettings();
  const t = s?.data?.token;
  if (!t) throw new HttpError(409, "O Meta ainda não foi conectado. Peça ao administrador para colar o token em Resultados → Conexões.");
  return t;
}

export async function graph<T>(path: string, params: Record<string, string> = {}, tok?: string): Promise<T> {
  const url = new URL(GRAPH + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("access_token", tok ?? (await token()));
  const res = await fetch(url.toString());
  const body: any = await res.json().catch(() => ({}));
  if (!res.ok || body.error) {
    const msg = body?.error?.message ?? `Meta respondeu ${res.status}`;
    const code = body?.error?.code;
    if (code === 190) throw new HttpError(409, "O token do Meta expirou ou foi revogado. Gere um novo e cole em Resultados → Conexões.");
    if (code === 10 || code === 200) throw new HttpError(409, `Falta permissão no Meta para isso: ${msg}`);
    throw new HttpError(502, `Meta: ${msg}`);
  }
  return body as T;
}

/** Lista Páginas/Instagram e contas de anúncios que o token enxerga (para vincular a cada cliente). */
export async function discoverAssets() {
  const [pages, ads] = await Promise.all([
    graph<any>("/me/accounts", { fields: "id,name,instagram_business_account{id,username,profile_picture_url}", limit: "200" }).catch((e) => ({ error: e.message, data: [] })),
    graph<any>("/me/adaccounts", { fields: "id,name,account_status,currency", limit: "200" }).catch((e) => ({ error: e.message, data: [] })),
  ]);
  return {
    instagram: (pages.data ?? [])
      .filter((p: any) => p.instagram_business_account)
      .map((p: any) => ({ igUserId: p.instagram_business_account.id, username: p.instagram_business_account.username, pageId: p.id, pageName: p.name })),
    adAccounts: (ads.data ?? []).map((a: any) => ({ id: a.id, name: a.name, currency: a.currency, active: a.account_status === 1 })),
    errors: [pages.error, ads.error].filter(Boolean),
  };
}

const monthRange = (month: string) => {
  const [y, m] = month.split("-").map(Number);
  const since = new Date(Date.UTC(y, m - 1, 1));
  const until = new Date(Date.UTC(y, m, 1));
  const now = new Date();
  return { since, until: until > now ? now : until };
};
const unix = (d: Date) => String(Math.floor(d.getTime() / 1000));
const ymd = (d: Date) => d.toISOString().slice(0, 10);

/** Instagram: perfil, totais do mês e cada post publicado no mês com suas métricas. */
export async function fetchInstagram(igUserId: string, month: string) {
  const { since, until } = monthRange(month);
  const profile = await graph<any>(`/${igUserId}`, { fields: "username,name,followers_count,follows_count,media_count,profile_picture_url,biography" });

  // Totais da conta no período (a API limita a janelas de até 30 dias, por isso um mês por vez).
  const totals: Record<string, number> = {};
  for (const metric of ["reach", "views", "accounts_engaged", "total_interactions", "likes", "comments", "shares", "saves", "profile_views", "website_clicks", "follows_and_unfollows"]) {
    try {
      const r = await graph<any>(`/${igUserId}/insights`, { metric, period: "day", metric_type: "total_value", since: unix(since), until: unix(until) });
      const item = r.data?.[0];
      if (metric === "follows_and_unfollows") {
        const b = item?.total_value?.breakdowns?.[0]?.results ?? [];
        totals.follows = b.find((x: any) => x.dimension_values?.[0] === "FOLLOWER")?.value ?? 0;
        totals.unfollows = b.find((x: any) => x.dimension_values?.[0] === "NON_FOLLOWER")?.value ?? 0;
      } else totals[metric] = item?.total_value?.value ?? 0;
    } catch {
      /* métrica indisponível para esta conta: segue sem ela */
    }
  }

  // Posts do mês
  const posts: any[] = [];
  let next: string | null = null;
  let page = await graph<any>(`/${igUserId}/media`, {
    fields: "id,caption,media_type,media_product_type,permalink,thumbnail_url,media_url,timestamp,like_count,comments_count",
    limit: "50",
    since: unix(since),
    until: unix(until),
  });
  for (let i = 0; i < 6; i++) {
    posts.push(...(page.data ?? []));
    next = page.paging?.next ?? null;
    if (!next) break;
    const res = await fetch(next);
    page = await res.json();
  }
  const inMonth = posts.filter((p) => p.timestamp && new Date(p.timestamp) >= since && new Date(p.timestamp) < new Date(until.getTime() + 1));
  const detailed = await Promise.all(
    inMonth.slice(0, 80).map(async (p) => {
      const m: Record<string, number> = {};
      const metrics = p.media_product_type === "STORY" ? "reach,views,replies,total_interactions" : "reach,views,saved,shares,total_interactions";
      try {
        const r = await graph<any>(`/${p.id}/insights`, { metric: metrics });
        for (const x of r.data ?? []) m[x.name] = x.values?.[0]?.value ?? x.total_value?.value ?? 0;
      } catch {
        /* post sem insights (ex.: antes de virar conta profissional) */
      }
      const interactions = m.total_interactions ?? (p.like_count ?? 0) + (p.comments_count ?? 0) + (m.saved ?? 0) + (m.shares ?? 0);
      return {
        id: p.id,
        caption: String(p.caption ?? "").slice(0, 600),
        type: p.media_product_type === "REELS" ? "Reels" : p.media_type === "CAROUSEL_ALBUM" ? "Carrossel" : p.media_product_type === "STORY" ? "Story" : p.media_type === "VIDEO" ? "Vídeo" : "Estático",
        permalink: p.permalink ?? "",
        thumb: p.thumbnail_url || p.media_url || "",
        timestamp: p.timestamp,
        likes: p.like_count ?? 0,
        comments: p.comments_count ?? 0,
        saves: m.saved ?? 0,
        shares: m.shares ?? 0,
        reach: m.reach ?? 0,
        views: m.views ?? 0,
        interactions,
        engagementRate: m.reach ? interactions / m.reach : 0,
      };
    }),
  );
  return {
    profile: { username: profile.username, name: profile.name, followers: profile.followers_count ?? 0, following: profile.follows_count ?? 0, mediaCount: profile.media_count ?? 0, picture: profile.profile_picture_url ?? "" },
    totals,
    posts: detailed,
  };
}

/** Anúncios: totais do mês e por campanha. */
export async function fetchAds(adAccountId: string, month: string) {
  const { since, until } = monthRange(month);
  const act = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;
  const time_range = JSON.stringify({ since: ymd(since), until: ymd(new Date(until.getTime() - 1)) });
  const fields = "spend,impressions,reach,frequency,clicks,inline_link_clicks,ctr,cpc,cpm,actions,cost_per_action_type";
  const [total, byCampaign, account] = await Promise.all([
    graph<any>(`/${act}/insights`, { fields, time_range }),
    graph<any>(`/${act}/insights`, { fields: `campaign_name,objective,${fields}`, level: "campaign", time_range, limit: "100" }),
    graph<any>(`/${act}`, { fields: "name,currency" }),
  ]);
  const norm = (r: any) => {
    const actions: Record<string, number> = {};
    for (const a of r?.actions ?? []) actions[a.action_type] = Number(a.value);
    const results =
      actions["onsite_conversion.messaging_conversation_started_7d"] ?? actions["lead"] ?? actions["offsite_conversion.fb_pixel_purchase"] ?? actions["link_click"] ?? 0;
    const spend = Number(r?.spend ?? 0);
    return {
      spend, impressions: Number(r?.impressions ?? 0), reach: Number(r?.reach ?? 0), frequency: Number(r?.frequency ?? 0),
      clicks: Number(r?.inline_link_clicks ?? r?.clicks ?? 0), ctr: Number(r?.ctr ?? 0), cpc: Number(r?.cpc ?? 0), cpm: Number(r?.cpm ?? 0),
      conversations: actions["onsite_conversion.messaging_conversation_started_7d"] ?? 0, leads: actions["lead"] ?? 0,
      purchases: actions["offsite_conversion.fb_pixel_purchase"] ?? 0, results, costPerResult: results ? spend / results : 0,
    };
  };
  return {
    account: { name: account.name, currency: account.currency ?? "BRL" },
    totals: norm(total.data?.[0]),
    campaigns: (byCampaign.data ?? []).map((c: any) => ({ name: c.campaign_name, objective: c.objective, ...norm(c) })).sort((a: any, b: any) => b.spend - a.spend),
  };
}
