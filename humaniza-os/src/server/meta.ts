// Integração oficial com o Meta (Graph API / Marketing API), só leitura.
//
// Conexão (uma vez, pela agência):
//  - Login oficial do Facebook (OAuth) a partir do painel: o admin cadastra o ID e a chave secreta
//    do app da agência (Meta for Developers) e clica em "Conectar com Facebook"; o Meta pede as
//    permissões de leitura e devolve um token de longa duração, guardado só no servidor; ou
//  - Token de "usuário do sistema" do Business Manager (não vence), colado no painel pelo admin.
// Nada disso trafega pelo chat nem volta ao navegador.
import { COLLECTIONS, find, create, replace, type Row } from "./db";
import { HttpError } from "./access";

export const GRAPH_VERSION = "v25.0";
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;
export const SCOPES = ["instagram_basic", "instagram_manage_insights", "pages_show_list", "pages_read_engagement", "ads_read", "business_management"];

async function setting(key: string): Promise<Row | null> {
  return (await find(COLLECTIONS.settings, { key }, { limit: 1 }))[0] ?? null;
}
async function saveSetting(key: string, data: Record<string, unknown>) {
  const row = await setting(key);
  if (row) await replace(COLLECTIONS.settings, { ...row, data: { ...(row.data ?? {}), ...data } });
  else await create(COLLECTIONS.settings, { key, data });
}
export const getMetaSettings = () => setting("meta");
export const getMetaApp = () => setting("metaApp");
export const saveMetaApp = (data: { appId: string; appSecret?: string; configId?: string }) => saveSetting("metaApp", data);

export async function graph<T>(path: string, params: Record<string, string> = {}, tok?: string): Promise<T> {
  const url = new URL(path.startsWith("http") ? path : GRAPH + path);
  for (const [k, v] of Object.entries(params)) if (k !== "access_token") url.searchParams.set(k, v);
  if ("access_token" in params) {
    if (params.access_token) url.searchParams.set("access_token", params.access_token);
  } else if (!url.searchParams.has("access_token")) url.searchParams.set("access_token", tok ?? (await token()));
  const res = await fetch(url.toString());
  const body: any = await res.json().catch(() => ({}));
  if (!res.ok || body.error) {
    const msg = body?.error?.message ?? `Meta respondeu ${res.status}`;
    const code = body?.error?.code;
    if (code === 190) throw new MetaError("token", "A conexão com o Meta expirou ou foi revogada. Reconecte em Gerenciamento → Conexões do Meta.");
    if (code === 10 || code === 200 || code === 3) throw new MetaError("permission", `Falta permissão no Meta: ${msg}`);
    if (code === 4 || code === 17 || code === 32 || code === 613 || code === 80004) throw new MetaError("rate", "Limite de consultas do Meta atingido; nova tentativa na próxima sincronização.");
    throw new MetaError("api", `Meta: ${msg}`);
  }
  return body as T;
}
export class MetaError extends Error {
  constructor(public kind: "token" | "permission" | "rate" | "api", message: string) {
    super(message);
  }
}

async function token(): Promise<string> {
  const s = await getMetaSettings();
  const t = s?.data?.token;
  if (!t) throw new HttpError(409, "O Meta ainda não foi conectado.");
  return t;
}

async function describeToken(tok: string) {
  const me = await graph<any>("/me", { fields: "id,name" }, tok);
  let expiresAt = "";
  let scopes: string[] = [];
  try {
    const app = await getMetaApp();
    const appTok = app?.data?.appId && app?.data?.appSecret ? `${app.data.appId}|${app.data.appSecret}` : tok;
    const dbg = await graph<any>("/debug_token", { input_token: tok, access_token: appTok });
    const exp = dbg?.data?.expires_at;
    expiresAt = exp ? new Date(exp * 1000).toISOString() : "nunca";
    scopes = dbg?.data?.scopes ?? [];
  } catch {
    /* debug_token indisponível: segue sem validade */
  }
  return { name: me.name ?? "", id: me.id ?? "", expiresAt, scopes };
}

export async function saveMetaToken(tok: string, by: string, method: "oauth" | "system_user") {
  const d = await describeToken(tok);
  await saveSetting("meta", { token: tok, accountName: d.name, accountId: d.id, expiresAt: d.expiresAt, scopes: d.scopes, method, savedBy: by, savedAt: new Date().toISOString() });
  return d;
}

/** Endereço do diálogo oficial de login do Facebook (Facebook Login / Login for Business). */
export async function oauthUrl(redirectUri: string, state: string) {
  const app = await getMetaApp();
  if (!app?.data?.appId || !app?.data?.appSecret) throw new HttpError(409, "Cadastre primeiro o ID e a chave secreta do app da agência.");
  const u = new URL(`https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`);
  u.searchParams.set("client_id", app.data.appId);
  u.searchParams.set("redirect_uri", redirectUri);
  u.searchParams.set("state", state);
  u.searchParams.set("response_type", "code");
  if (app.data.configId) u.searchParams.set("config_id", app.data.configId);
  else u.searchParams.set("scope", SCOPES.join(","));
  return u.toString();
}

/** Troca o código do login por um token de longa duração (60 dias) e guarda no servidor. */
export async function oauthExchange(code: string, redirectUri: string, by: string) {
  const app = await getMetaApp();
  if (!app?.data?.appId || !app?.data?.appSecret) throw new HttpError(409, "App do Meta não configurado.");
  const short = await graph<any>("/oauth/access_token", { client_id: app.data.appId, client_secret: app.data.appSecret, redirect_uri: redirectUri, code, access_token: "" });
  const long = await graph<any>("/oauth/access_token", {
    grant_type: "fb_exchange_token", client_id: app.data.appId, client_secret: app.data.appSecret, fb_exchange_token: short.access_token, access_token: "",
  });
  return saveMetaToken(long.access_token ?? short.access_token, by, "oauth");
}

/** Contas que o token enxerga, para vincular a cada cliente. */
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

/* ------------------------------------------------------------------ */
/*  Coleta (usada pela sincronização automática)                       */
/* ------------------------------------------------------------------ */

const dayStartBR = (d: string) => Math.floor(new Date(`${d}T00:00:00-03:00`).getTime() / 1000);
export const DAY_METRICS = ["reach", "views", "accounts_engaged", "total_interactions", "likes", "comments", "shares", "saves", "profile_views", "website_clicks"];

/** Totais de um dia (fuso de Brasília). Métrica que a conta não oferece fica ausente (nunca zero). */
export async function igDay(igUserId: string, day: string) {
  const since = dayStartBR(day);
  const until = since + 86400;
  const out: Record<string, number> = {};
  const r = await graph<any>(`/${igUserId}/insights`, { metric: DAY_METRICS.join(","), period: "day", metric_type: "total_value", since: String(since), until: String(until) }).catch(async (e) => {
    if (e instanceof MetaError && e.kind !== "api") throw e;
    // Alguma métrica não é aceita: tenta uma por uma.
    const data: any[] = [];
    for (const m of DAY_METRICS) {
      try {
        const x = await graph<any>(`/${igUserId}/insights`, { metric: m, period: "day", metric_type: "total_value", since: String(since), until: String(until) });
        data.push(...(x.data ?? []));
      } catch (err) {
        if (err instanceof MetaError && err.kind !== "api") throw err;
      }
    }
    return { data };
  });
  for (const item of r.data ?? []) {
    const v = item?.total_value?.value;
    if (typeof v === "number") out[item.name] = v;
  }
  try {
    const f = await graph<any>(`/${igUserId}/insights`, { metric: "follows_and_unfollows", period: "day", metric_type: "total_value", breakdown: "follow_type", since: String(since), until: String(until) });
    const res = f.data?.[0]?.total_value?.breakdowns?.[0]?.results ?? [];
    const fol = res.find((x: any) => x.dimension_values?.[0] === "FOLLOWER")?.value;
    const unf = res.find((x: any) => x.dimension_values?.[0] === "NON_FOLLOWER")?.value;
    if (typeof fol === "number") out.follows = fol;
    if (typeof unf === "number") out.unfollows = unf;
  } catch {
    /* indisponível para contas pequenas */
  }
  return out;
}

export async function igProfile(igUserId: string) {
  const p = await graph<any>(`/${igUserId}`, { fields: "username,name,followers_count,follows_count,media_count,profile_picture_url" });
  return { username: p.username, name: p.name, followers: p.followers_count, following: p.follows_count, mediaCount: p.media_count, picture: p.profile_picture_url ?? "" };
}

/** Publicações desde `sinceIso` (no máximo 300). */
export async function igMediaList(igUserId: string, sinceIso: string) {
  const out: any[] = [];
  let page = await graph<any>(`/${igUserId}/media`, {
    fields: "id,caption,media_type,media_product_type,permalink,thumbnail_url,media_url,timestamp,like_count,comments_count",
    limit: "50",
  });
  for (let i = 0; i < 6; i++) {
    const data = page.data ?? [];
    out.push(...data);
    if (!data.length || data[data.length - 1].timestamp < sinceIso || !page.paging?.next) break;
    page = await graph<any>(page.paging.next);
  }
  return out.filter((m) => m.timestamp >= sinceIso);
}

export async function igMediaInsights(m: any) {
  const isStory = m.media_product_type === "STORY";
  const metrics = isStory ? ["reach", "views", "replies", "total_interactions"] : ["reach", "views", "saved", "shares", "total_interactions", "likes", "comments"];
  const got: Record<string, number> = {};
  const tryMetrics = async (list: string[]) => {
    const r = await graph<any>(`/${m.id}/insights`, { metric: list.join(",") });
    for (const x of r.data ?? []) {
      const v = x.values?.[0]?.value ?? x.total_value?.value;
      if (typeof v === "number") got[x.name] = v;
    }
  };
  try {
    await tryMetrics(metrics);
  } catch (e) {
    if (e instanceof MetaError && e.kind !== "api") throw e;
    for (const one of metrics) await tryMetrics([one]).catch(() => undefined);
  }
  return {
    id: m.id,
    caption: String(m.caption ?? "").slice(0, 600),
    type: m.media_product_type === "REELS" ? "Reels" : m.media_type === "CAROUSEL_ALBUM" ? "Carrossel" : isStory ? "Story" : m.media_type === "VIDEO" ? "Vídeo" : "Estático",
    permalink: m.permalink ?? "",
    thumb: m.thumbnail_url || m.media_url || "",
    timestamp: m.timestamp,
    likes: got.likes ?? m.like_count ?? null,
    comments: got.comments ?? m.comments_count ?? null,
    saves: got.saved ?? null,
    shares: got.shares ?? null,
    reach: got.reach ?? null,
    views: got.views ?? null,
    interactions: got.total_interactions ?? null,
  };
}

const CONVERSATION = "onsite_conversion.messaging_conversation_started_7d";

/** Anúncios por campanha e por dia, no intervalo [since, until] (datas AAAA-MM-DD). */
export async function adsDaily(adAccountId: string, since: string, until: string) {
  const act = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;
  const base = "campaign_id,campaign_name,objective,spend,impressions,reach,clicks,inline_link_clicks,actions,cost_per_action_type,account_currency";
  const params = { level: "campaign", time_increment: "1", time_range: JSON.stringify({ since, until }), limit: "500" };
  let rows: any[] = [];
  let withResults = true;
  let page = await graph<any>(`/${act}/insights`, { ...params, fields: `${base},results,cost_per_result` }).catch(async (e) => {
    if (e instanceof MetaError && e.kind !== "api") throw e;
    withResults = false;
    return graph<any>(`/${act}/insights`, { ...params, fields: base });
  });
  for (let i = 0; i < 20; i++) {
    rows.push(...(page.data ?? []));
    if (!page.paging?.next) break;
    page = await graph<any>(page.paging.next);
  }
  return rows.map((r) => {
    const actions: Record<string, number> = {};
    for (const a of r.actions ?? []) actions[a.action_type] = Number(a.value);
    const res = withResults ? (r.results ?? [])[0] : null;
    const resultValue = res?.values?.[0]?.value ?? res?.value;
    return {
      date: r.date_start,
      campaignId: r.campaign_id,
      campaign: r.campaign_name,
      objective: r.objective ?? "",
      currency: r.account_currency ?? "BRL",
      spend: Number(r.spend ?? 0),
      impressions: Number(r.impressions ?? 0),
      reach: r.reach !== undefined ? Number(r.reach) : null,
      clicks: Number(r.inline_link_clicks ?? r.clicks ?? 0),
      conversations: actions[CONVERSATION] ?? null,
      resultIndicator: res?.indicator ?? "",
      results: resultValue !== undefined && resultValue !== null ? Number(resultValue) : null,
    };
  });
}
