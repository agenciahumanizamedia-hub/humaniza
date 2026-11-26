// Painel único do Humaniza OS. O menu muda conforme o perfil (admin, equipe, cliente), mas o que
// cada um VÊ é decidido no servidor: mesmo que alguém mexa nesta tela, os endpoints só devolvem os
// dados permitidos.
import { useEffect, useState } from "react";
import { useMember } from "../../hooks/members/useMember";
import { api, ApiError, type Me, type Role } from "./api";
import { Button, Card, Field, Modal, Panel, Pill, Skeleton, useLoad, useRoute } from "./ui";
import { ClientPage, ClientsList, mainColor } from "./Clients";
import { ProjectList, ProjectPage } from "./Projects";
import { CalendarPage } from "./Calendar";
import { DemandsBoard } from "./Demands";
import { QuotesPage, TeamPage, TrashPage } from "./Extras";

type Item = { id: string; label: string; icon: string };
const NAV: Record<Role, Item[]> = {
  admin: [
    { id: "", label: "Visão geral", icon: "📊" },
    { id: "clientes", label: "Clientes", icon: "👥" },
    { id: "projetos", label: "Projetos e roteiros", icon: "🎬" },
    { id: "calendario", label: "Calendário", icon: "🗓️" },
    { id: "demandas", label: "Demandas", icon: "🗂️" },
    { id: "equipe", label: "Equipe", icon: "👨‍💻" },
    { id: "orcamentos", label: "Orçamentos", icon: "💼" },
    { id: "acessos", label: "Acessos", icon: "🔐" },
    { id: "lixeira", label: "Lixeira", icon: "🗑️" },
    { id: "historico", label: "Histórico", icon: "🕒" },
  ],
  team: [
    { id: "", label: "Meu dia", icon: "☀️" },
    { id: "clientes", label: "Meus clientes", icon: "👥" },
    { id: "projetos", label: "Projetos e roteiros", icon: "🎬" },
    { id: "calendario", label: "Calendário", icon: "🗓️" },
    { id: "demandas", label: "Demandas", icon: "🗂️" },
    { id: "lixeira", label: "Lixeira", icon: "🗑️" },
    { id: "historico", label: "Histórico", icon: "🕒" },
  ],
  client: [
    { id: "", label: "Minha página", icon: "🏠" },
    { id: "projetos", label: "Projetos e aprovações", icon: "🎬" },
    { id: "calendario", label: "Calendário", icon: "🗓️" },
    { id: "historico", label: "Atualizações", icon: "🕒" },
  ],
};

const ROLE_LABEL: Record<string, string> = { admin: "Administrador", team: "Equipe", client: "Cliente" };

export default function AppShell() {
  const { loggedIn, loading } = useMember();
  const [me, setMe] = useState<Me | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "blocked" | "error">("loading");
  const [message, setMessage] = useState("");
  const [route, go] = useRoute();

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

  if (loading || state === "loading") return <Skeleton rows={3} />;
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

  const [section, id] = route;
  const active = section === "cliente" ? "clientes" : section === "projeto" ? "projetos" : section ?? "";
  const page = (() => {
    if (section === "cliente" && id) return <ClientPage me={me} id={id} go={go} />;
    if (section === "projeto" && id) return <ProjectPage me={me} id={id} go={go} />;
    switch (section ?? "") {
      case "clientes": return me.role === "client" ? <ClientPage me={me} id={me.clientId!} go={go} /> : <ClientsList me={me} go={go} />;
      case "projetos": return <ProjectList me={me} clientId={me.role === "client" ? me.clientId! : undefined} go={go} />;
      case "calendario": return <CalendarPage me={me} go={go} />;
      case "demandas": return me.role !== "client" ? <DemandsBoard me={me} /> : null;
      case "equipe": return me.role === "admin" ? <TeamPage go={go} /> : null;
      case "orcamentos": return me.role === "admin" ? <QuotesPage /> : null;
      case "acessos": return me.role === "admin" ? <AccessView /> : null;
      case "lixeira": return me.role !== "client" ? <TrashPage me={me} /> : null;
      case "historico": return <Timeline />;
      default: return me.role === "client" ? <ClientPage me={me} id={me.clientId!} go={go} /> : <Home me={me} go={go} />;
    }
  })();

  const items = NAV[me.role];
  const current = items.find((i) => i.id === active) ?? items[0];
  return (
    <div className="grid gap-4 lg:grid-cols-[230px_1fr] lg:gap-6">
      {/* Computador: menu lateral */}
      <aside className="no-print hidden h-fit rounded-lg border border-border bg-card p-4 lg:sticky lg:top-24 lg:block">
        <p className="font-semibold">{me.name}</p>
        <p className="text-xs text-muted-foreground">{ROLE_LABEL[me.role]}</p>
        <MyPasswordButton />
        <nav className="mt-4 flex flex-col gap-1">
          {items.map((item) => (
            <button key={item.id} type="button" onClick={() => go(item.id)}
              className={`flex items-center gap-2 rounded-control px-3 py-2 text-left text-sm font-semibold ${active === item.id ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-secondary"}`}>
              <span aria-hidden>{item.icon}</span>{item.label}
            </button>
          ))}
        </nav>
      </aside>
      {/* Celular: barra de atalhos no rodapé + menu completo */}
      <MobileNav items={items} active={active} current={current} me={me} go={go} />
      <section className="min-w-0">{page ?? <p className="text-muted-foreground">Seu perfil não tem acesso a esta área.</p>}</section>
    </div>
  );
}

function MobileNav({ items, active, current, me, go }: { items: Item[]; active: string; current: Item; me: Me; go: (p: string) => void }) {
  const [open, setOpen] = useState(false);
  const quick = items.slice(0, 4);
  return (
    <>
      <nav className="no-print fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-border bg-[#1C1C1C]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        {quick.map((item) => (
          <button key={item.id} onClick={() => go(item.id)} className={`flex flex-col items-center gap-0.5 py-2 text-[10px] font-semibold ${active === item.id ? "text-[#c9c7ff]" : "text-muted-foreground"}`}>
            <span className="text-lg leading-none" aria-hidden>{item.icon}</span>
            <span className="max-w-full truncate px-1">{item.label.split(" ")[0]}</span>
          </button>
        ))}
        <button onClick={() => setOpen(true)} className="flex flex-col items-center gap-0.5 py-2 text-[10px] font-semibold text-muted-foreground">
          <span className="text-lg leading-none" aria-hidden>☰</span><span>Menu</span>
        </button>
      </nav>
      {open && (
        <div className="fixed inset-0 z-50 bg-black/70 lg:hidden" onClick={() => setOpen(false)}>
          <div className="absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto rounded-t-2xl border-t border-border bg-card p-4 pb-8" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <div><p className="font-semibold">{me.name}</p><p className="text-xs text-muted-foreground">{ROLE_LABEL[me.role]} · {current.label}</p><MyPasswordButton /></div>
              <button onClick={() => setOpen(false)} className="text-2xl text-muted-foreground" aria-label="Fechar">×</button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {items.map((item) => (
                <button key={item.id} onClick={() => { setOpen(false); go(item.id); }}
                  className={`flex items-center gap-2 rounded-control px-3 py-3 text-left text-sm font-semibold ${active === item.id ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>
                  <span aria-hidden>{item.icon}</span>{item.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Home({ me, go }: { me: Me; go: (p: string) => void }) {
  const clients = useLoad(api.clients);
  const projects = useLoad(() => api.projects(), []);
  const demands = useLoad(() => api.demands(), []);
  const pending = (projects.data ?? []).filter((p) => [p.strategicStatus, p.productionStatus, p.calendarStatus].some((s) => s === "Liberado ao cliente" || s === "Aguardando aprovação"));
  const adjusts = (projects.data ?? []).filter((p) => p.adjustments > 0 || [p.strategicStatus, p.productionStatus, p.calendarStatus].includes("Ajustes solicitados"));
  const myDemands = (demands.data ?? []).filter((d) => d.column !== "Concluído" && (me.role === "admin" || d.assignees.includes(me.email)));
  const today = new Date().toISOString().slice(0, 10);
  const byId = new Map((clients.data ?? []).map((c) => [c._id, c]));
  return (
    <div className="grid gap-6">
      <div className="rounded-lg border border-border bg-card p-6" style={{ background: "radial-gradient(circle at top right, rgba(91,86,255,.35), transparent 45%), #242424" }}>
        <p className="eyebrow">Agência Humaniza</p>
        <h1 className="mt-1 text-2xl font-extrabold sm:text-3xl">Olá, {me.name.split(" ")[0]}</h1>
        <p className="mt-2 text-muted-foreground">{me.role === "team" ? "Suas demandas, clientes e roteiros aparecem aqui." : "Visão geral da agência."}</p>
      </div>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat label={me.role === "admin" ? "Clientes ativos" : "Meus clientes"} value={clients.data?.filter((c) => (c.status || "Ativo") === "Ativo").length} onClick={() => go("clientes")} />
        <Stat label="Aguardando o cliente" value={pending.length} onClick={() => go("projetos")} />
        <Stat label="Com ajuste pedido" value={adjusts.length} tone="warn" onClick={() => go("projetos")} />
        <Stat label={me.role === "admin" ? "Demandas abertas" : "Minhas demandas"} value={myDemands.length} onClick={() => go("demandas")} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <div className="flex items-center justify-between"><h2 className="text-lg font-bold">Pedidos de ajuste</h2><Button small variant="ghost" onClick={() => go("projetos")}>Ver projetos</Button></div>
          {adjusts.length === 0 && <p className="mt-2 text-sm text-muted-foreground">Nenhum ajuste pendente. 🎉</p>}
          <ul className="mt-3 grid gap-2">
            {adjusts.slice(0, 6).map((p) => (
              <li key={p._id}><button onClick={() => go(`projeto/${p._id}`)} className="flex w-full items-center justify-between gap-2 rounded-control border border-amber-400/30 p-3 text-left text-sm hover:bg-amber-400/5">
                <span><b>{byId.get(p.clientId)?.name ?? ""}</b> · {p.period}</span><Pill>{p.adjustments ? `${p.adjustments} conteúdos` : "Etapa"}</Pill></button></li>
            ))}
          </ul>
        </Card>
        <Card>
          <div className="flex items-center justify-between"><h2 className="text-lg font-bold">{me.role === "admin" ? "Demandas da equipe" : "Minhas demandas"}</h2><Button small variant="ghost" onClick={() => go("demandas")}>Abrir quadro</Button></div>
          {myDemands.length === 0 && <p className="mt-2 text-sm text-muted-foreground">Nenhuma demanda aberta.</p>}
          <ul className="mt-3 grid gap-2">
            {myDemands.slice(0, 6).map((d) => (
              <li key={d._id} className="flex items-center justify-between gap-2 rounded-control border border-border p-3 text-sm">
                <span className="truncate"><b>{d.title}</b>{d.clientName ? ` · ${d.clientName}` : ""}</span>
                <span className={`text-xs ${d.dueDate && d.dueDate < today ? "font-bold text-red-300" : "text-muted-foreground"}`}>{d.column}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
      {me.role === "admin" && <ImportBox />}
      <Timeline compact />
    </div>
  );
}

function Stat({ label, value, tone, onClick }: { label: string; value: number | undefined; tone?: "warn"; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="rounded-lg border border-border bg-card p-4 text-left sm:p-5 transition hover:border-primary/60">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-extrabold sm:text-3xl ${tone === "warn" && value ? "text-amber-300" : ""}`}>{value ?? "—"}</p>
    </button>
  );
}

function ImportBox() {
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");
  async function run() {
    setState("busy");
    setMsg("");
    try {
      const r = await api.importHub();
      setState("done");
      setMsg(
        `Copiados agora: ${r.clientes} clientes, ${r.projetos} projetos/mês, ${r.conteudos} conteúdos e ${r.briefing} itens de briefing. ` +
          `(Lidos no Hub: ${r.lidosDoHub.clientes} clientes e ${r.lidosDoHub.projetos} projetos.)`,
      );
    } catch (e) {
      setState("error");
      setMsg((e as Error).message);
    }
  }
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <p className="eyebrow">Migração</p>
      <h2 className="mt-1 text-lg font-bold">Trazer dados do Hub Humaniza</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Copia clientes, projetos/mês, roteiros, carrosséis, estáticos e briefings do Hub antigo. Nada é apagado lá, e o
        que já foi copiado não é duplicado.
      </p>
      <button
        onClick={run}
        disabled={state === "busy"}
        className="mt-3 rounded bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
      >
        {state === "busy" ? "Copiando… (pode levar até 1 minuto)" : "Copiar dados do Hub"}
      </button>
      {msg && <p className={`mt-2 text-sm ${state === "error" ? "text-destructive" : "text-green-400"}`}>{msg}</p>}
    </div>
  );
}

/** Mostra uma senha gerada UMA vez, com botão de copiar e o texto pronto para mandar à pessoa. */
function PasswordCard({ name, email, password, onClose }: { name: string; email: string; password: string; onClose: () => void }) {
  const [copied, setCopied] = useState("");
  const site = typeof window !== "undefined" ? window.location.origin : "";
  const message = `Olá, ${name.split(" ")[0]}! Seu acesso ao Humaniza OS está pronto.\n\nEndereço: ${site}/login\nE-mail: ${email}\nSenha: ${password}\n\nDepois de entrar, você pode trocar a senha em “Trocar minha senha”.`;
  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
    } catch {
      setCopied("");
      window.prompt("Copie:", text);
    }
  };
  return (
    <div className="grid gap-3 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-4">
      <p className="text-sm font-semibold">Senha de {name} (aparece só agora: copie antes de fechar)</p>
      <div className="flex flex-wrap items-center gap-2">
        <code className="rounded-control bg-black/40 px-3 py-2 font-mono text-lg tracking-wider">{password}</code>
        <Button small onClick={() => copy(password, "senha")}>{copied === "senha" ? "Senha copiada ✓" : "Copiar senha"}</Button>
        <Button small variant="ghost" onClick={() => copy(message, "mensagem")}>{copied === "mensagem" ? "Mensagem copiada ✓" : "Copiar mensagem para enviar"}</Button>
        <Button small variant="ghost" onClick={onClose}>Fechar</Button>
      </div>
      <p className="text-xs text-muted-foreground">A senha não fica guardada no sistema. Se a pessoa perder, gere outra em “Gerar nova senha”.</p>
    </div>
  );
}

function AccessView() {
  const users = useLoad(api.users);
  const clients = useLoad(api.clients);
  const [form, setForm] = useState({ name: "", email: "", role: "team", clientId: "", jobTitle: "", permission: "Operacional" });
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [shown, setShown] = useState<{ name: string; email: string; password: string } | null>(null);
  const [busyRow, setBusyRow] = useState("");
  const [rowMsg, setRowMsg] = useState<{ id: string; text: string; error?: boolean } | null>(null);
  const clientName = (id: string | null) => clients.data?.find((c) => c._id === id)?.name ?? "";

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg("");
    setShown(null);
    try {
      const r = await api.grantAccess(form);
      if (r.password) {
        setShown({ name: form.name, email: r.email, password: r.password });
        setMsg("Acesso liberado.");
      } else {
        setMsg(`Acesso liberado, mas a senha não foi criada (${r.passwordMessage || "erro do Wix"}). Use “Enviar e-mail para criar senha” na lista abaixo.`);
      }
      setForm({ ...form, name: "", email: "", jobTitle: "" });
      users.reload();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function reset(u: { _id: string; name: string; email: string }) {
    if (!window.confirm(`Gerar uma senha nova para ${u.name}? A senha atual dele(a) deixa de funcionar.`)) return;
    setBusyRow(u._id);
    setRowMsg(null);
    try {
      const r = await api.resetPassword(u._id);
      setShown({ name: u.name, email: r.email, password: r.password });
      window.scrollTo({ top: 0, behavior: "smooth" });
      users.reload();
    } catch (err) {
      setRowMsg({ id: u._id, text: err instanceof Error ? err.message : String(err), error: true });
    } finally {
      setBusyRow("");
    }
  }

  async function emailLink(u: { _id: string; name: string }) {
    setBusyRow(u._id);
    setRowMsg(null);
    try {
      const r = await api.sendPasswordEmail(u._id);
      setRowMsg({ id: u._id, text: `E-mail enviado para ${r.sentTo}. O link vale 3 horas.` });
    } catch (err) {
      setRowMsg({ id: u._id, text: err instanceof Error ? err.message : String(err), error: true });
    } finally {
      setBusyRow("");
    }
  }

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-bold">Acessos</h1>
        <p className="text-sm text-muted-foreground">
          Ao liberar, o sistema cria a senha da pessoa e mostra aqui para você copiar e enviar. Ela pode trocar depois em “Trocar minha senha”.
        </p>
      </div>
      {shown && <PasswordCard {...shown} onClose={() => setShown(null)} />}
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
            {saving ? "Criando acesso e senha…" : "Liberar acesso e gerar senha"}
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
              <th className="p-3">Senha</th>
            </tr>
          </thead>
          <tbody>
            {users.data?.map((u) => (
              <tr key={u._id} className="border-t border-border align-top">
                <td className="p-3">{u.name}</td>
                <td className="p-3">{u.email}</td>
                <td className="p-3">{ROLE_LABEL[u.role] ?? u.role}</td>
                <td className="p-3">{u.role === "client" ? clientName(u.clientId) : u.jobTitle}</td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-2">
                    <Button small variant="ghost" disabled={busyRow === u._id} onClick={() => reset(u)}>
                      {busyRow === u._id ? "Aguarde…" : "Gerar nova senha"}
                    </Button>
                    <Button small variant="ghost" disabled={busyRow === u._id} onClick={() => emailLink(u)}>
                      Enviar e-mail para criar senha
                    </Button>
                  </div>
                  {u.passwordSetAt && (
                    <p className="mt-1 text-xs text-muted-foreground">Última senha gerada: {new Date(u.passwordSetAt).toLocaleString("pt-BR")}</p>
                  )}
                  {rowMsg?.id === u._id && <p className={`mt-1 text-xs ${rowMsg.error ? "text-destructive" : "text-green-400"}`}>{rowMsg.text}</p>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Qualquer perfil troca a própria senha. */
function MyPasswordButton() {
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "ok" | "error">("idle");
  const [msg, setMsg] = useState("");
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 8) return (setState("error"), setMsg("Use pelo menos 8 caracteres."));
    if (pw !== pw2) return (setState("error"), setMsg("As duas senhas não são iguais."));
    setState("busy");
    setMsg("");
    try {
      await api.changeMyPassword(pw);
      setState("ok");
      setMsg("Senha trocada. Use a nova senha no próximo login.");
      setPw("");
      setPw2("");
    } catch (err) {
      setState("error");
      setMsg(err instanceof Error ? err.message : String(err));
    }
  }
  return (
    <>
      <button type="button" onClick={() => { setOpen(true); setState("idle"); setMsg(""); }} className="mt-2 text-xs text-[#c9c7ff] underline">
        Trocar minha senha
      </button>
      {open && (
        <Modal title="Trocar minha senha" onClose={() => setOpen(false)}>
          <form onSubmit={save} className="grid gap-3">
            <Field label="Nova senha (mínimo 8 caracteres)" type="password" value={pw} onChange={setPw} required />
            <Field label="Repita a nova senha" type="password" value={pw2} onChange={setPw2} required />
            {msg && <p className={`text-sm ${state === "error" ? "text-destructive" : "text-green-400"}`}>{msg}</p>}
            <div className="flex gap-2">
              <Button type="submit" disabled={state === "busy"}>{state === "busy" ? "Salvando…" : "Salvar nova senha"}</Button>
              <Button variant="ghost" onClick={() => setOpen(false)}>Fechar</Button>
            </div>
          </form>
        </Modal>
      )}
    </>
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

