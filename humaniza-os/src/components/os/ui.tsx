// Peças de interface compartilhadas pelo painel.
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { api } from "./api";

export const HUMANIZA_PALETTE = [
  { hex: "#5B56FF", name: "Roxo Humaniza" },
  { hex: "#1C1C1C", name: "Preto" },
  { hex: "#F2F2F0", name: "Off-white" },
  { hex: "#242424", name: "Grafite" },
  { hex: "#A6A6A6", name: "Cinza" },
];

/* ---------- navegação por endereço (#/clientes, #/cliente/ID, #/projeto/ID…) ---------- */
export function useRoute(): [string[], (path: string) => void] {
  const read = () => window.location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  const [parts, setParts] = useState<string[]>(read);
  useEffect(() => {
    const on = () => setParts(read());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  const go = useCallback((path: string) => {
    window.location.hash = "/" + path.replace(/^\/+/, "");
    window.scrollTo({ top: 0 });
  }, []);
  return [parts, go];
}

/* ---------- carregamento ---------- */
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(fn, deps);
  const reload = useCallback(() => {
    setLoading(true);
    return run()
      .then((d) => {
        setData(d);
        setError("");
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [run]);
  useEffect(() => {
    reload();
  }, [reload]);
  return { data, error, loading, reload, setData };
}

/* ---------- blocos visuais ---------- */
export function Panel({ children }: { children: ReactNode }) {
  return <div className="mx-auto max-w-xl rounded-lg border border-border bg-card p-8">{children}</div>;
}
export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-lg border border-border bg-card p-4 sm:p-5 ${className}`}>{children}</div>;
}
export function Skeleton({ rows = 2 }: { rows?: number }) {
  return (
    <div className="grid gap-4" aria-busy="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className={`${i === 0 ? "h-24" : "h-48"} animate-pulse rounded-lg bg-card`} />
      ))}
    </div>
  );
}
export function ErrorText({ children }: { children: ReactNode }) {
  return children ? <p className="text-sm text-destructive">{children}</p> : null;
}
export function Button({
  children, onClick, variant = "primary", type = "button", disabled, small, title,
}: { children: ReactNode; onClick?: () => void; variant?: "primary" | "ghost" | "danger" | "green" | "yellow"; type?: "button" | "submit"; disabled?: boolean; small?: boolean; title?: string }) {
  const styles = {
    primary: "bg-primary text-primary-foreground hover:brightness-110",
    ghost: "border border-border bg-secondary text-foreground hover:bg-border",
    danger: "border border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20",
    green: "bg-emerald-500 text-black hover:brightness-110",
    yellow: "bg-amber-400 text-black hover:brightness-110",
  }[variant];
  return (
    <button type={type} title={title} disabled={disabled} onClick={onClick}
      className={`${small ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm"} rounded-control font-semibold transition disabled:opacity-50 ${styles}`}>
      {children}
    </button>
  );
}
export function Field(props: { label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean; placeholder?: string; className?: string }) {
  return (
    <label className={`text-sm ${props.className ?? ""}`}>
      <span className="text-muted-foreground">{props.label}</span>
      <input type={props.type ?? "text"} required={props.required} value={props.value} placeholder={props.placeholder}
        onChange={(e) => props.onChange(e.target.value)} className="mt-1 w-full rounded-control border border-border bg-secondary p-2 text-foreground" />
    </label>
  );
}
export function Area(props: { label: string; value: string; onChange: (v: string) => void; rows?: number; placeholder?: string }) {
  return (
    <label className="text-sm">
      <span className="text-muted-foreground">{props.label}</span>
      <textarea rows={props.rows ?? 3} value={props.value} placeholder={props.placeholder} onChange={(e) => props.onChange(e.target.value)}
        className="mt-1 w-full rounded-control border border-border bg-secondary p-2 text-foreground" />
    </label>
  );
}
export function Select(props: { label: string; value: string; onChange: (v: string) => void; options: (string | { value: string; label: string })[]; className?: string }) {
  return (
    <label className={`text-sm ${props.className ?? ""}`}>
      <span className="text-muted-foreground">{props.label}</span>
      <select value={props.value} onChange={(e) => props.onChange(e.target.value)} className="mt-1 w-full rounded-control border border-border bg-secondary p-2 text-foreground">
        {props.options.map((o) => (typeof o === "string" ? <option key={o}>{o}</option> : <option key={o.value} value={o.value}>{o.label}</option>))}
      </select>
    </label>
  );
}

const PILL: Record<string, string> = {
  Aprovado: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  Finalizado: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  Postado: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  Concluído: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  Ajustes: "bg-amber-400/15 text-amber-300 border-amber-400/30",
  "Ajustes solicitados": "bg-amber-400/15 text-amber-300 border-amber-400/30",
  "Aguardando aprovação": "bg-sky-400/15 text-sky-300 border-sky-400/30",
  "Liberado ao cliente": "bg-sky-400/15 text-sky-300 border-sky-400/30",
  Bloqueado: "bg-white/5 text-muted-foreground border-border",
  Rascunho: "bg-white/5 text-muted-foreground border-border",
  Enviado: "bg-sky-400/15 text-sky-300 border-sky-400/30",
  Recusado: "bg-red-500/10 text-red-300 border-red-500/30",
};
export function Pill({ children }: { children: string }) {
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${PILL[children] ?? "border-primary/40 bg-primary/15 text-[#bdbaff]"}`}>{children}</span>;
}

export const TYPE_LABEL: Record<string, string> = { roteiro: "🎬 Reels / Roteiro", carrossel: "📚 Carrossel", estatico: "🖼️ Estático" };
export const TYPE_SHORT: Record<string, string> = { roteiro: "Reels", carrossel: "Carrossel", estatico: "Estático" };
export const brDate = (d?: string) => (d && /^\d{4}-\d{2}-\d{2}/.test(d) ? d.slice(0, 10).split("-").reverse().join("/") : "Sem data");
export const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");

/* ---------- logo / avatar do cliente ---------- */
export function Logo({ name, url, color, size = 40 }: { name: string; url?: string | null; color?: string; size?: number }) {
  return url ? (
    <img src={url} alt={`Logo ${name}`} className="shrink-0 rounded-full border border-border bg-white object-contain" style={{ width: size, height: size }} />
  ) : (
    <span className="flex shrink-0 items-center justify-center rounded-full font-bold text-white" style={{ width: size, height: size, background: color || "#5B56FF", fontSize: size * 0.38 }}>
      {initials(name) || "?"}
    </span>
  );
}

/* ---------- texto rico (roteiros) ---------- */
/** Limpa HTML para exibir com segurança (o servidor já limpa ao salvar; aqui é a segunda barreira). */
export function safeHtml(html: string): string {
  if (!html) return "";
  if (typeof DOMParser === "undefined") return "";
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  const ok = new Set(["B", "STRONG", "I", "EM", "U", "BR", "DIV", "P", "SPAN", "FONT", "UL", "OL", "LI", "H3", "H4", "MARK"]);
  const walk = (el: Element) => {
    for (const child of Array.from(el.children)) {
      if (!ok.has(child.tagName)) {
        child.replaceWith(...Array.from(child.childNodes));
        continue;
      }
      for (const a of Array.from(child.attributes)) if (!["style", "color"].includes(a.name)) child.removeAttribute(a.name);
      const st = child.getAttribute("style");
      if (st && /url|expression|javascript/i.test(st)) child.removeAttribute("style");
      walk(child);
    }
  };
  walk(doc.body.firstElementChild!);
  return doc.body.firstElementChild!.innerHTML;
}
export function RichView({ html, empty = "—" }: { html: string; empty?: string }) {
  const clean = safeHtml(html);
  if (!clean.replace(/<[^>]+>/g, "").trim()) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return <div className="rich text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: clean }} />;
}
export function RichEditor({ value, onChange, placeholder }: { value: string; onChange: (html: string) => void; placeholder?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const first = useRef(true);
  useEffect(() => {
    if (ref.current && (first.current || document.activeElement !== ref.current)) {
      ref.current.innerHTML = safeHtml(value);
      first.current = false;
    }
  }, [value]);
  const exec = (cmd: string, arg?: string) => {
    ref.current?.focus();
    document.execCommand(cmd, false, arg);
    onChange(ref.current?.innerHTML ?? "");
  };
  return (
    <div className="rounded-control border border-border bg-secondary">
      <div className="flex flex-wrap gap-1 border-b border-border p-1 text-xs">
        <ToolBtn onClick={() => exec("bold")} label="B" title="Negrito" bold />
        <ToolBtn onClick={() => exec("italic")} label="I" title="Itálico" />
        <ToolBtn onClick={() => exec("foreColor", "#5B56FF")} label="Roxo" title="Letra roxa" />
        <ToolBtn onClick={() => exec("foreColor", "#F2F2F0")} label="Branco" title="Letra branca" />
        <ToolBtn onClick={() => { exec("foreColor", "#FFFFFF"); exec("hiliteColor", "#5B56FF"); }} label="Destaque" title="Fundo roxo" />
        <ToolBtn onClick={() => exec("insertUnorderedList")} label="• Lista" title="Lista" />
        <ToolBtn onClick={() => exec("removeFormat")} label="Limpar" title="Remover formatação" />
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        onInput={() => onChange(ref.current?.innerHTML ?? "")}
        onPaste={(e) => {
          e.preventDefault();
          document.execCommand("insertText", false, e.clipboardData.getData("text/plain"));
        }}
        className="rich min-h-[72px] p-3 text-sm leading-relaxed outline-none"
      />
    </div>
  );
}
function ToolBtn({ onClick, label, title, bold }: { onClick: () => void; label: string; title: string; bold?: boolean }) {
  return (
    <button type="button" title={title} onMouseDown={(e) => e.preventDefault()} onClick={onClick}
      className={`rounded px-2 py-1 hover:bg-border ${bold ? "font-extrabold" : ""}`}>
      {label}
    </button>
  );
}

/* ---------- envio de imagem ---------- */
export function ImagePicker({ label, onUploaded, children }: { label: string; onUploaded: (url: string) => void; children?: ReactNode }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  return (
    <label className="inline-flex cursor-pointer flex-col gap-1 text-sm">
      <span className="rounded-control border border-dashed border-primary/60 bg-primary/10 px-3 py-2 text-center font-semibold text-[#c9c7ff] hover:bg-primary/20">
        {busy ? "Enviando…" : label}
      </span>
      <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif" className="hidden" disabled={busy}
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          if (f.size > 8 * 1024 * 1024) return setErr("Imagem acima de 8 MB. Reduza e envie de novo.");
          setBusy(true);
          setErr("");
          try {
            onUploaded(await api.upload(f));
          } catch (x) {
            setErr(x instanceof Error ? x.message : String(x));
          } finally {
            setBusy(false);
          }
        }} />
      {children}
      {err && <span className="text-xs text-destructive">{err}</span>}
    </label>
  );
}

/* ---------- janela ---------- */
export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-0 sm:p-4 sm:pt-12" onMouseDown={onClose}>
      <div className={`min-h-full w-full sm:min-h-0 ${wide ? "max-w-4xl" : "max-w-lg"} border-border bg-card p-4 pb-24 shadow-2xl sm:rounded-lg sm:border sm:p-6 sm:pb-6`} onMouseDown={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 -mx-4 -mt-4 mb-4 flex items-center justify-between gap-4 border-b border-border bg-card px-4 py-3 sm:static sm:m-0 sm:mb-4 sm:border-0 sm:p-0">
          <h2 className="min-w-0 truncate text-lg font-bold">{title}</h2>
          <button onClick={onClose} className="rounded px-2 text-xl text-muted-foreground hover:text-foreground" aria-label="Fechar">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function useToast(): [ReactNode, (msg: string) => void] {
  const [msg, setMsg] = useState("");
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(""), 3500);
    return () => clearTimeout(t);
  }, [msg]);
  const node = msg ? (
    <div className="fixed bottom-20 left-1/2 z-[60] lg:bottom-6 -translate-x-1/2 rounded-full border border-primary/40 bg-[#161616] px-5 py-2 text-sm shadow-xl">{msg}</div>
  ) : null;
  return [node, setMsg];
}

export function monthLabel(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}
export const thisMonth = () => new Date().toISOString().slice(0, 7);
export function shiftMonth(ym: string, delta: number) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
