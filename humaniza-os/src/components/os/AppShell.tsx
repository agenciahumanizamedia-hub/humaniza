// Painel único do Humaniza OS. O menu muda conforme o perfil (admin, equipe, cliente), mas o que
// cada um VÊ é decidido no servidor: mesmo que alguém mexa nesta tela, os endpoints só devolvem os
// dados permitidos.
import { useCallback, useEffect, useState } from "react";
import { useMember } from "../../hooks/members/useMember";
import { api, ApiError, type Activity, type Client, type Me, type Role, type User } from "./api";

type View = "inicio" | "clientes" | "acessos" | "historico";

const NAV: Record<Role, { id: View; label: string }[]> = {
  admin: [
    { id: "inicio", label: "Início" },
    { id: "clientes", label: "Clientes" },
    { id: "acessos", label: "Acessos" },
    { id: "historico", label: "Histórico" },
  ],
  team: [
    { id: "inicio", label: "Meu dia" },
    { id: "clientes", label: "Meus clientes" },
    { id: "historico", label: "Histórico" },
  ],
  client: [
    { id: "inicio", label: "Início" },
    { id: "historico", label: "Atualizações" },
  ],
};

const ROLE_LABEL: Record<string, string> = { admin: "Administrador", team: "Equipe", client: "Cliente" };

export default function AppShell() {
  const { loggedIn, loading } = useMember();
  const [me, setMe] = useState<Me | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "blocked" | "error">("loading");
  const [message, setMessage] = useState("");
  const [view, setView] = useState<View>("inicio");

  useEffect(() => {
    if (loading) return;
    if (!loggedIn) {
      window.location.href = "/login?returnTo=/painel";
      return;
    }
    api
      .me()
      .then((m) => {
        setMe(m);
        setState("ready");
      })
      .catch((e) => {
        setMessage(e instanceof Error ? e.message : String(e));
        setState(e instanceof ApiError && (e.status === 401 || e.status === 403) ? "blocked" : "error");
      });
  }, [loading, loggedIn]);

  if (loading || state === "loading") return <Skeleton />;
  if (state === "blocked")
    return (
      <Panel>
        <h1 className="text-xl font-bold">Acesso aguardando liberação</h1>
        <p className="mt-2 text-muted-foreground">
          Seu login foi criado, mas a Humaniza ainda não liberou o acesso a este e-mail. Assim que for liberado, é só
          atualizar a página.
        </p>
      </Panel>
    );
  if (state === "error" || !me)
    return (
      <Panel>
        <p className="text-destructive">{message || "Não foi possível carregar o painel."}</p>
      </Panel>
    );

  return (
    <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
      <aside className="h-fit rounded-lg border border-border bg-card p-4 lg:sticky lg:top-24">
        <p className="font-semibold">{me.name}</p>
        <p className="text-xs text-muted-foreground">{ROLE_LABEL[me.role]}</p>
        <nav className="mt-4 flex gap-2 overflow-x-auto lg:flex-col">
          {NAV[me.role].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setView(item.id)}
              className={`whitespace-nowrap rounded-control px-3 py-2 text-left text-sm font-semibold ${
                view === item.id ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground hover:bg-border"
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </aside>
      <section className="min-w-0">
        {view === "inicio" && <Home me={me} />}
        {view === "clientes" && <ClientsView me={me} />}
        {view === "acessos" && me.role === "admin" && <AccessView />}
        {view === "historico" && <Timeline />}
      </section>
    </div>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-xl rounded-lg border border-border bg-card p-8">{children}</div>;
}

function Skeleton() {
  return (
    <div className="grid gap-4" aria-busy="true">
      <div className="h-24 animate-pulse rounded-lg bg-card" />
      <div className="h-64 animate-pulse rounded-lg bg-card" />
    </div>
  );
}

function useLoad<T>(fn: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const reload = useCallback(() => {
    fn().then(setData).catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [fn]);
  useEffect(reload, [reload]);
  return { data, error, reload };
}

function Home({ me }: { me: Me }) {
  const clients = useLoad(api.clients);
  const greeting = me.role === "client" ? clients.data?.[0]?.name ?? "" : "Agência Humaniza";
  return (
    <div className="grid gap-6">
      <div className="rounded-lg border border-border bg-card p-6" style={{ background: "radial-gradient(circle at top right, rgba(91,86,255,.35), transparent 45%), #242424" }}>
        <p className="eyebrow">{greeting}</p>
        <h1 className="mt-1 text-3xl font-extrabold">Olá, {me.name.split(" ")[0]}</h1>
        <p className="mt-2 text-muted-foreground">
          {me.role === "client"
            ? "Aqui você acompanha seus projetos, conteúdos e aprovações."
            : me.role === "team"
              ? "Suas tarefas, captações e clientes aparecem aqui."
              : "Visão geral da agência."}
        </p>
      </div>
      {me.role !== "client" && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat label={me.role === "admin" ? "Clientes" : "Meus clientes"} value={clients.data?.length} />
          <Stat label="Aprovações pendentes" value={0} hint="chega na etapa de conteúdos" />
          <Stat label="Ajustes abertos" value={0} hint="chega na etapa de conteúdos" />
        </div>
      )}
      <Timeline compact />
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: number | undefined; hint?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-3xl font-extrabold">{value ?? "—"}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function ClientsView({ me }: { me: Me }) {
  const { data, error, reload } = useLoad(api.clients);
  const [form, setForm] = useState({ name: "", email: "", serviceType: "", instagram: "" });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg("");
    try {
      await api.createClient(form);
      setForm({ name: "", email: "", serviceType: "", instagram: "" });
      setMsg("Cliente cadastrado.");
      reload();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-bold">{me.role === "admin" ? "Clientes" : "Meus clientes"}</h1>
      {me.role === "admin" && (
        <form onSubmit={save} className="grid gap-3 rounded-lg border border-border bg-card p-5 sm:grid-cols-2">
          <Field label="Nome do cliente" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
          <Field label="E-mail principal" value={form.email} onChange={(v) => setForm({ ...form, email: v })} type="email" />
          <Field label="Serviço contratado" value={form.serviceType} onChange={(v) => setForm({ ...form, serviceType: v })} />
          <Field label="Instagram" value={form.instagram} onChange={(v) => setForm({ ...form, instagram: v })} />
          <div className="flex items-center gap-3 sm:col-span-2">
            <button disabled={saving} className="rounded-control bg-primary px-4 py-2 font-semibold text-primary-foreground">
              {saving ? "Salvando…" : "+ Cadastrar cliente"}
            </button>
            {msg && <span className="text-sm text-muted-foreground">{msg}</span>}
          </div>
        </form>
      )}
      {error && <p className="text-destructive">{error}</p>}
      {!data && !error && <Skeleton />}
      {data && data.length === 0 && <p className="text-muted-foreground">Nenhum cliente por aqui ainda.</p>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {data?.map((c) => (
          <article key={c._id} className="rounded-lg border border-border bg-card p-5">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full font-bold text-white" style={{ background: c.brandColor || "#5B56FF" }}>
                {c.name.slice(0, 1).toUpperCase()}
              </span>
              <div>
                <h2 className="font-semibold">{c.name}</h2>
                <p className="text-xs text-muted-foreground">{c.serviceType || "Serviço não definido"}</p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border border-border px-2 py-1">{c.status || "Ativo"}</span>
              {c.instagram && <span className="rounded-full border border-border px-2 py-1">{c.instagram}</span>}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function AccessView() {
  const users = useLoad(api.users);
  const clients = useLoad(api.clients);
  const [form, setForm] = useState({ name: "", email: "", role: "team", clientId: "", jobTitle: "", permission: "Operacional" });
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const clientName = (id: string | null) => clients.data?.find((c) => c._id === id)?.name ?? "";

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg("");
    try {
      await api.grantAccess(form);
      setMsg("Acesso liberado. A pessoa cria a senha em “Criar acesso” na tela de login.");
      setForm({ ...form, name: "", email: "", jobTitle: "" });
      users.reload();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-bold">Acessos</h1>
      <form onSubmit={save} className="grid gap-3 rounded-lg border border-border bg-card p-5 sm:grid-cols-2">
        <Field label="Nome" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
        <Field label="E-mail de login" value={form.email} onChange={(v) => setForm({ ...form, email: v })} type="email" required />
        <label className="text-sm">
          Perfil
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="mt-1 w-full rounded-control border border-border bg-secondary p-2">
            <option value="team">Equipe</option>
            <option value="client">Cliente</option>
            <option value="admin">Administrador</option>
          </select>
        </label>
        {form.role === "client" ? (
          <label className="text-sm">
            Empresa
            <select required value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })} className="mt-1 w-full rounded-control border border-border bg-secondary p-2">
              <option value="">Escolha…</option>
              {clients.data?.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <Field label="Função (ex.: Editor, Designer)" value={form.jobTitle} onChange={(v) => setForm({ ...form, jobTitle: v })} />
        )}
        <div className="flex items-center gap-3 sm:col-span-2">
          <button disabled={saving} className="rounded-control bg-primary px-4 py-2 font-semibold text-primary-foreground">
            {saving ? "Salvando…" : "Liberar acesso"}
          </button>
          {msg && <span className="text-sm text-muted-foreground">{msg}</span>}
        </div>
      </form>
      {users.error && <p className="text-destructive">{users.error}</p>}
      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-left text-sm">
          <thead className="text-muted-foreground">
            <tr>
              <th className="p-3">Nome</th>
              <th className="p-3">E-mail</th>
              <th className="p-3">Perfil</th>
              <th className="p-3">Vínculo</th>
            </tr>
          </thead>
          <tbody>
            {users.data?.map((u) => (
              <tr key={u._id} className="border-t border-border">
                <td className="p-3">{u.name}</td>
                <td className="p-3">{u.email}</td>
                <td className="p-3">{ROLE_LABEL[u.role] ?? u.role}</td>
                <td className="p-3">{u.role === "client" ? clientName(u.clientId) : u.jobTitle}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Timeline({ compact = false }: { compact?: boolean }) {
  const { data, error } = useLoad(api.activity);
  const list = compact ? data?.slice(0, 8) : data;
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <h2 className="text-lg font-bold">{compact ? "Últimas atualizações" : "Histórico"}</h2>
      {error && <p className="mt-2 text-destructive">{error}</p>}
      {data && data.length === 0 && <p className="mt-2 text-muted-foreground">Nenhuma atualização ainda.</p>}
      <ol className="mt-4 grid gap-3 border-l-2 border-primary pl-4">
        {list?.map((a) => (
          <li key={a._id}>
            <p className="text-sm">{a.description}</p>
            <p className="text-xs text-muted-foreground">
              {a.when ? new Date(a.when).toLocaleString("pt-BR") : ""} · {a.actorName}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Field(props: { label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean }) {
  return (
    <label className="text-sm">
      {props.label}
      <input
        type={props.type ?? "text"}
        required={props.required}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        className="mt-1 w-full rounded-control border border-border bg-secondary p-2"
      />
    </label>
  );
}
