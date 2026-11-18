// Equipe, Lixeira e Orçamentos (arquivo do sistema antigo).
import { useState } from "react";
import { api, type Me } from "./api";
import { Button, Card, ErrorText, Pill, Skeleton, TYPE_SHORT, brDate, useLoad, useToast } from "./ui";

export function TeamPage({ go }: { go: (p: string) => void }) {
  const team = useLoad(api.team);
  const demands = useLoad(() => api.demands(), []);
  const clients = useLoad(api.clients);
  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="eyebrow">Pessoas</p><h1 className="text-3xl font-extrabold">Equipe</h1></div>
        <Button variant="ghost" onClick={() => go("acessos")}>Liberar novo acesso</Button>
      </div>
      <ErrorText>{team.error}</ErrorText>
      {!team.data && <Skeleton />}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {team.data?.map((t) => {
          const mine = (demands.data ?? []).filter((d) => d.assignees.includes(t.email));
          const open = mine.filter((d) => d.column !== "Concluído");
          const late = open.filter((d) => d.dueDate && d.dueDate < new Date().toISOString().slice(0, 10));
          const serves = (clients.data ?? []).filter((c) => (c.teamEmails ?? []).includes(t.email));
          return (
            <Card key={t._id}>
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-lg font-bold text-white">{t.name.slice(0, 2).toUpperCase()}</span>
                <div><h2 className="font-bold">{t.name}</h2><p className="text-xs text-muted-foreground">{t.jobTitle || (t.role === "admin" ? "Administrador" : "Equipe")} · {t.email}</p></div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-control bg-secondary p-2"><b className="text-xl">{open.length}</b><p className="text-[11px] text-muted-foreground">abertas</p></div>
                <div className="rounded-control bg-secondary p-2"><b className={`text-xl ${late.length ? "text-red-300" : ""}`}>{late.length}</b><p className="text-[11px] text-muted-foreground">atrasadas</p></div>
                <div className="rounded-control bg-secondary p-2"><b className="text-xl">{serves.length}</b><p className="text-[11px] text-muted-foreground">clientes</p></div>
              </div>
              {open.length > 0 && (
                <ul className="mt-3 grid gap-1 text-sm">
                  {open.slice(0, 4).map((d) => <li key={d._id} className="flex justify-between gap-2"><span className="truncate">{d.title}</span><span className="text-xs text-muted-foreground">{d.column}</span></li>)}
                </ul>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export function TrashPage({ me }: { me: Me }) {
  const contents = useLoad(() => api.contents({ trash: true }), []);
  const demands = useLoad(() => api.demands(true), []);
  const [toast, say] = useToast();
  const act = async (fn: () => Promise<unknown>, msg: string) => { await fn(); contents.reload(); demands.reload(); say(msg); };
  return (
    <div className="grid gap-6">
      <div><p className="eyebrow">Recuperação</p><h1 className="text-3xl font-extrabold">Lixeira</h1>
        <p className="text-sm text-muted-foreground">Nada é apagado de verdade até alguém escolher “Apagar de vez”{me.role !== "admin" && " (só o administrador pode)"}.</p></div>
      <Card>
        <h2 className="text-lg font-bold">Roteiros e conteúdos</h2>
        {contents.data?.length === 0 && <p className="mt-2 text-sm text-muted-foreground">Vazio.</p>}
        <ul className="mt-3 grid gap-2">
          {contents.data?.map((c) => (
            <li key={c._id} className="flex flex-wrap items-center gap-2 rounded-control border border-border p-3 text-sm">
              <span className="flex-1"><b>{c.title || "Sem tema"}</b> <span className="text-muted-foreground">· {TYPE_SHORT[c.type]} · {c.clientName}</span></span>
              <span className="text-xs text-muted-foreground">apagado em {brDate(c.trashedAt)}</span>
              <Button small variant="ghost" onClick={() => act(() => api.trashContent(c._id, "restore"), "Restaurado.")}>Restaurar</Button>
              {me.role === "admin" && <Button small variant="danger" onClick={() => window.confirm("Apagar de vez? Não dá para desfazer.") && act(() => api.trashContent(c._id, "forever"), "Apagado de vez.")}>Apagar de vez</Button>}
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <h2 className="text-lg font-bold">Demandas</h2>
        {demands.data?.length === 0 && <p className="mt-2 text-sm text-muted-foreground">Vazio.</p>}
        <ul className="mt-3 grid gap-2">
          {demands.data?.map((d) => (
            <li key={d._id} className="flex flex-wrap items-center gap-2 rounded-control border border-border p-3 text-sm">
              <span className="flex-1"><b>{d.title}</b> <span className="text-muted-foreground">· {d.clientName || "Interno"}</span></span>
              <Button small variant="ghost" onClick={() => act(() => api.trashDemand(d._id, "restore"), "Restaurada.")}>Restaurar</Button>
              {me.role === "admin" && <Button small variant="danger" onClick={() => window.confirm("Apagar de vez? Não dá para desfazer.") && act(() => api.trashDemand(d._id, "forever"), "Apagada de vez.")}>Apagar de vez</Button>}
            </li>
          ))}
        </ul>
      </Card>
      {toast}
    </div>
  );
}

const money = (n: unknown) => (Number(n) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function QuotesPage() {
  const { data, error } = useLoad(() => api.archive("quotes"), []);
  const briefs = useLoad(() => api.archive("projectBriefings"), []);
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="grid gap-6">
      <div><p className="eyebrow">Comercial</p><h1 className="text-3xl font-extrabold">Orçamentos</h1>
        <p className="text-sm text-muted-foreground">Orçamentos trazidos do sistema antigo. O gerador novo de orçamentos com link de aprovação entra na próxima etapa.</p></div>
      <ErrorText>{error}</ErrorText>
      {!data && <Skeleton />}
      {data?.length === 0 && <p className="text-muted-foreground">Nenhum orçamento.</p>}
      {data?.map((r) => {
        const q = r.data;
        return (
          <Card key={r._id}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div><h2 className="text-xl font-bold">{q.prospectName || "Sem nome"}</h2><p className="text-sm text-muted-foreground">{q.service} · {q.segment}</p></div>
              <div className="text-right"><p className="text-2xl font-extrabold">{money(q.manualFinalEnabled ? q.manualFinal : q.total)}</p>
                <Pill>{q.status === "approved" ? "Aprovado" : q.status === "declined" ? "Recusado" : "Enviado"}</Pill></div>
            </div>
            <div className="mt-3 grid gap-2 text-sm md:grid-cols-3">
              <p><span className="text-muted-foreground">Captação:</span> {brDate(q.captureDate)} {q.captureTime}</p>
              <p><span className="text-muted-foreground">Validade:</span> {brDate(q.validity)}</p>
              <p><span className="text-muted-foreground">Subtotal:</span> {money(q.subtotal)} {q.discountAmount ? `(desconto ${money(q.discountAmount)})` : ""}</p>
            </div>
            <button className="mt-3 text-sm text-[#c9c7ff] underline" onClick={() => setOpen(open === r._id ? null : r._id)}>{open === r._id ? "Esconder detalhes" : "Ver detalhes"}</button>
            {open === r._id && (
              <div className="mt-3 grid gap-3 text-sm">
                {q.macro && <p><b>Contexto:</b> {q.macro}</p>}
                {q.objective && <p><b>Objetivo:</b> {q.objective}</p>}
                {q.deliverables && <p className="whitespace-pre-wrap"><b>Entregas:</b> {q.deliverables}</p>}
                {q.discountExplanation && <p><b>Desconto:</b> {q.discountExplanation}</p>}
                {q.notes && <p><b>Observações:</b> {q.notes}</p>}
              </div>
            )}
          </Card>
        );
      })}
      {(briefs.data?.length ?? 0) > 0 && (
        <Card>
          <h2 className="text-lg font-bold">Briefings de projeto</h2>
          {briefs.data?.map((b) => <p key={b._id} className="mt-2 whitespace-pre-wrap text-sm"><b>{b.data.clientName}</b>{"\n"}{b.data.briefingText}</p>)}
        </Card>
      )}
    </div>
  );
}
