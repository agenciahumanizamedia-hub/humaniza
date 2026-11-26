// Sincronização automática Meta → banco do Humaniza OS.
// Roda no servidor por agendamento (a cada hora, disparado pelo GitHub Actions) e também pelo botão
// "Sincronizar agora". Grava dados por dia/publicação/campanha; as telas só leem o banco. Se o Meta
// falhar, os dados anteriores continuam valendo e o estado da conexão mostra a pendência.
import { COLLECTIONS, find, findAll, create, replace, saveMany, getOne, type Row } from "./db";
import { MetaError, igDay, igProfile, igMediaList, igMediaInsights, adsDaily, getMetaSettings } from "./meta";

export const todayBR = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
export const addDays = (d: string, n: number) => new Date(Date.parse(d + "T12:00:00Z") + n * 86400e3).toISOString().slice(0, 10);
const rid = (source: string, clientId: string, key: string) => `${source}_${clientId.replace(/-/g, "").slice(0, 12)}_${key}`.replace(/[^A-Za-z0-9_-]/g, "-").slice(0, 120);

export type ConnState = { state: "ok" | "pendente" | "erro" | "aguardando"; lastSuccess: string; lastAttempt: string; message: string; backfilledTo?: string };
export async function getSyncState(clientId: string): Promise<{ row: Row | null; ig: ConnState; ads: ConnState }> {
  const row = (await find(COLLECTIONS.settings, { key: `sync:${clientId}` }, { limit: 1 }))[0] ?? null;
  const blank: ConnState = { state: "aguardando", lastSuccess: "", lastAttempt: "", message: "" };
  return { row, ig: { ...blank, ...(row?.data?.ig ?? {}) }, ads: { ...blank, ...(row?.data?.ads ?? {}) } };
}
async function setSyncState(clientId: string, row: Row | null, data: Record<string, unknown>) {
  if (row) await replace(COLLECTIONS.settings, { ...row, data: { ...(row.data ?? {}), ...data } });
  else await create(COLLECTIONS.settings, { key: `sync:${clientId}`, data });
}

const failState = (prev: ConnState, e: unknown): ConnState => ({
  ...prev,
  state: prev.lastSuccess ? "pendente" : "erro",
  lastAttempt: new Date().toISOString(),
  message: e instanceof Error ? e.message : String(e),
});

export async function syncClient(clientId: string, opts: { full?: boolean } = {}) {
  const client = await getOne(COLLECTIONS.clients, clientId);
  if (!client) throw new Error("Cliente não encontrado.");
  const integ = client.integrations ?? {};
  const meta = await getMetaSettings();
  const st = await getSyncState(clientId);
  const report: Record<string, unknown> = { client: client.name };
  const today = todayBR();
  let ig = st.ig;
  let ads = st.ads;

  if (!meta?.data?.token) {
    const msg = "Conta aguardando conexão com o Meta.";
    if (integ.igUserId) ig = { ...ig, state: ig.lastSuccess ? "pendente" : "aguardando", message: msg, lastAttempt: new Date().toISOString() };
    if (integ.adAccountId) ads = { ...ads, state: ads.lastSuccess ? "pendente" : "aguardando", message: msg, lastAttempt: new Date().toISOString() };
    await setSyncState(clientId, st.row, { ig, ads });
    return { ...report, ig, ads };
  }

  // ---------- Instagram ----------
  if (integ.igUserId) {
    try {
      const rows: Record<string, unknown>[] = [];
      const profile = await igProfile(integ.igUserId);
      rows.push({ _id: rid("igp", clientId, today), clientId, source: "ig_profile", key: today, date: today, month: today.slice(0, 7), data: profile, fetchedAt: new Date().toISOString() });

      // Dias: os 3 mais recentes sempre; o histórico (até 90 dias) é completado aos poucos.
      const days = [today, addDays(today, -1), addDays(today, -2)];
      const backTo = ig.backfilledTo || addDays(today, -2);
      const limit = addDays(today, -90);
      let cursor = backTo;
      const extra = opts.full ? 30 : 12;
      for (let i = 0; i < extra && cursor > limit; i++) {
        cursor = addDays(cursor, -1);
        days.push(cursor);
      }
      for (const d of days) {
        const data = await igDay(integ.igUserId, d);
        rows.push({ _id: rid("igd", clientId, d), clientId, source: "ig_day", key: d, date: d, month: d.slice(0, 7), data, fetchedAt: new Date().toISOString() });
      }

      // Publicações dos últimos 90 dias. Recentes (7 dias) atualizam a cada rodada; as outras, 1x/dia.
      const sinceIso = new Date(Date.parse(limit + "T03:00:00Z")).toISOString();
      const media = await igMediaList(integ.igUserId, sinceIso);
      const stored = new Map((await findAll(COLLECTIONS.metrics, { clientId, source: "ig_media" })).map((r) => [r.key, r]));
      let budget = opts.full ? 120 : 50;
      for (const m of media) {
        const old = stored.get(m.id);
        const recent = Date.now() - Date.parse(m.timestamp) < 7 * 86400e3;
        const stale = !old || Date.now() - Date.parse(old.fetchedAt) > 24 * 3600e3;
        if (!(recent || stale) || budget <= 0) continue;
        budget--;
        const data = await igMediaInsights(m);
        const date = new Date(Date.parse(m.timestamp) - 3 * 3600e3).toISOString().slice(0, 10);
        rows.push({ _id: rid("igm", clientId, m.id), clientId, source: "ig_media", key: m.id, date, month: date.slice(0, 7), data, fetchedAt: new Date().toISOString() });
      }
      await saveMany(COLLECTIONS.metrics, rows);
      ig = { state: "ok", lastSuccess: new Date().toISOString(), lastAttempt: new Date().toISOString(), message: "", backfilledTo: cursor };
      report.igRows = rows.length;
    } catch (e) {
      ig = failState(ig, e);
      if (!(e instanceof MetaError)) console.error("sync ig", e);
    }
  }

  // ---------- Anúncios ----------
  if (integ.adAccountId) {
    try {
      const since = ads.lastSuccess && !opts.full ? addDays(today, -7) : addDays(today, -90);
      const daily = await adsDaily(integ.adAccountId, since, today);
      const rows = daily.map((r) => ({
        _id: rid("ads", clientId, `${r.date}_${r.campaignId}`), clientId, source: "ads_day", key: `${r.date}:${r.campaignId}`, date: r.date, month: r.date.slice(0, 7), data: r, fetchedAt: new Date().toISOString(),
      }));
      await saveMany(COLLECTIONS.metrics, rows);
      ads = { state: "ok", lastSuccess: new Date().toISOString(), lastAttempt: new Date().toISOString(), message: "" };
      report.adsRows = rows.length;
    } catch (e) {
      ads = failState(ads, e);
      if (!(e instanceof MetaError)) console.error("sync ads", e);
    }
  }
  await setSyncState(clientId, st.row, { ig, ads });
  return { ...report, ig, ads };
}

export async function clientsToSync() {
  const all = await findAll(COLLECTIONS.clients);
  return all.filter((c) => c.integrations?.igUserId || c.integrations?.adAccountId).map((c) => ({ _id: c._id, name: c.name }));
}
