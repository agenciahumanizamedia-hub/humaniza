// Marca do topo, conforme quem está vendo:
//   cliente      → logo e nome da PRÓPRIA marca, com "Portal do cliente · Agência Humaniza" embaixo
//   equipe/admin → "Humaniza Studio" (ferramenta de trabalho da agência)
//   sem login    → "Portal Humaniza" (tela de entrada)
// O título da aba do navegador acompanha.
import { useEffect, useState } from "react";
import { api, type Client, type Me } from "./api";
import { Logo } from "./ui";

export const NAMES = { login: "Portal Humaniza", staff: "Humaniza Studio", agency: "Agência Humaniza" } as const;

function setTabTitle(suffix: string) {
  const base = document.title.split(" · ")[0];
  document.title = `${base} · ${suffix}`;
}

export default function HeaderBrand() {
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const [client, setClient] = useState<Client | null>(null);

  useEffect(() => {
    api.me()
      .then(async (m) => {
        setMe(m);
        if (m.role === "client" && m.clientId) setClient(await api.client(m.clientId).catch(() => null));
      })
      .catch(() => setMe(null));
  }, []);

  useEffect(() => {
    if (me === undefined) return;
    if (me?.role === "client") setTabTitle(client?.name ? `${client.name} · ${NAMES.agency}` : NAMES.login);
    else if (me) setTabTitle(NAMES.staff);
    else setTabTitle(NAMES.login);
  }, [me, client]);

  if (me === undefined) return <span className="inline-block h-7 w-40 animate-pulse rounded-control bg-secondary" aria-hidden="true" />;

  if (me?.role === "client") {
    const name = client?.name ?? "";
    const color = client?.brand?.colors?.[0]?.hex || client?.brandColor || "#5B56FF";
    return (
      <a href="/painel" className="flex min-w-0 items-center gap-2.5 text-foreground no-underline">
        {name && <Logo name={name} url={client?.logoUrl} color={color} size={34} />}
        <span className="min-w-0 leading-tight">
          <span className="block truncate text-base font-extrabold tracking-tight sm:text-lg">{name || NAMES.login}</span>
          <span className="block truncate text-[11px] text-muted-foreground">Portal do cliente · {NAMES.agency}</span>
        </span>
      </a>
    );
  }

  if (me) {
    return (
      <a href="/painel" className="text-lg font-extrabold tracking-tight text-foreground no-underline">
        Humaniza <span className="text-primary">Studio</span>
      </a>
    );
  }

  return (
    <a href="/login" className="text-lg font-extrabold tracking-tight text-foreground no-underline">
      Portal <span className="text-primary">Humaniza</span>
    </a>
  );
}
