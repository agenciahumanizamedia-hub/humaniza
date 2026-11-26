// Calendário comercial brasileiro: datas fixas, móveis (Carnaval, Páscoa, Dia das Mães/Pais,
// Black Friday…) e datas de profissões, para sugerir campanhas a cada cliente.
type Suggestion = { date: string; title: string; kind: "data" | "campanha"; tags: string[]; tip: string };

function easter(y: number) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(y, month - 1, day));
}
const iso = (d: Date) => d.toISOString().slice(0, 10);
const add = (d: Date, n: number) => new Date(d.getTime() + n * 86400e3);
function nthWeekday(y: number, m: number, weekday: number, n: number) {
  const first = new Date(Date.UTC(y, m - 1, 1));
  const offset = (weekday - first.getUTCDay() + 7) % 7;
  return new Date(Date.UTC(y, m - 1, 1 + offset + (n - 1) * 7));
}

const FIXED: [string, string, string[], string][] = [
  ["01-01", "Ano Novo", ["geral"], "Retrospectiva do ano e metas: conteúdo de agradecimento aos clientes."],
  ["03-08", "Dia Internacional da Mulher", ["geral"], "Homenagem com histórias reais de clientes/equipe; evitar só flores e clichês."],
  ["03-15", "Dia do Consumidor", ["varejo", "geral"], "Condição especial por 24–72 h; bom gancho para tráfego pago."],
  ["04-07", "Dia Mundial da Saúde", ["saude"], "Conteúdo educativo de prevenção, com especialista falando."],
  ["06-12", "Dia dos Namorados", ["varejo", "beleza", "joias", "gastronomia", "geral"], "Comece a divulgar 15 dias antes; kits e presentes."],
  ["08-31", "Dia do Nutricionista", ["nutricao"], "Bastidores da rotina e mitos x verdades da nutrição."],
  ["09-15", "Dia do Cliente", ["geral", "varejo"], "Agradecimento, depoimentos e um mimo para quem já é cliente."],
  ["10-12", "Dia das Crianças", ["varejo", "odontologia", "geral"], "Conteúdo leve e família; promoções infantis."],
  ["10-18", "Dia do Médico", ["saude"], "Homenagem e bastidores da equipe médica."],
  ["10-25", "Dia do Dentista", ["odontologia"], "Bastidores da clínica, antes e depois (com autorização)."],
  ["10-31", "Halloween", ["varejo", "gastronomia"], "Ação temática rápida nos stories."],
  ["11-20", "Dia da Consciência Negra", ["geral"], "Conteúdo respeitoso e informativo; evitar uso promocional."],
  ["12-25", "Natal", ["geral", "varejo", "joias", "gastronomia"], "Campanha começa no fim de novembro; kits e horário especial."],
  ["12-31", "Réveillon", ["geral"], "Retrospectiva e planos para o próximo ano."],
];

export function commercialCalendar(fromIso: string, months = 4): Suggestion[] {
  const from = new Date(fromIso + "T00:00:00Z");
  const to = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + months, 1));
  const out: Suggestion[] = [];
  for (let y = from.getUTCFullYear(); y <= to.getUTCFullYear(); y++) {
    for (const [md, title, tags, tip] of FIXED) out.push({ date: `${y}-${md}`, title, kind: "data", tags, tip });
    const e = easter(y);
    out.push({ date: iso(add(e, -47)), title: "Carnaval", kind: "data", tags: ["geral", "varejo", "beleza"], tip: "Horários de funcionamento, cuidados e conteúdo divertido." });
    out.push({ date: iso(add(e, -2)), title: "Sexta-feira Santa", kind: "data", tags: ["geral"], tip: "Avisar horário de funcionamento." });
    out.push({ date: iso(e), title: "Páscoa", kind: "campanha", tags: ["varejo", "gastronomia", "geral"], tip: "Divulgar 3 semanas antes; encomendas e kits." });
    out.push({ date: iso(nthWeekday(y, 5, 0, 2)), title: "Dia das Mães", kind: "campanha", tags: ["geral", "varejo", "beleza", "joias", "saude"], tip: "Segunda maior data do varejo: começar 3 semanas antes, com tráfego pago." });
    out.push({ date: iso(nthWeekday(y, 8, 0, 2)), title: "Dia dos Pais", kind: "campanha", tags: ["geral", "varejo", "joias"], tip: "Começar 2 a 3 semanas antes; presentes e experiências." });
    const bf = add(nthWeekday(y, 11, 4, 4), 1);
    out.push({ date: iso(bf), title: "Black Friday", kind: "campanha", tags: ["geral", "varejo", "joias", "beleza"], tip: "Aquecimento 2 semanas antes, lista VIP e verba extra em anúncios." });
    out.push({ date: iso(add(bf, 3)), title: "Cyber Monday", kind: "campanha", tags: ["varejo"], tip: "Última chamada das ofertas online." });
  }
  return out.filter((s) => s.date >= fromIso && new Date(s.date + "T00:00:00Z") < to).sort((a, b) => a.date.localeCompare(b.date));
}

/** Palavras do segmento do cliente → etiquetas usadas para filtrar sugestões. */
export function segmentTags(text: string): string[] {
  const t = (text || "").toLowerCase();
  const tags = ["geral"];
  if (/nutri/.test(t)) tags.push("nutricao", "saude");
  if (/odonto|dent|sorriso/.test(t)) tags.push("odontologia", "saude");
  if (/m[eé]dic|cl[ií]nica|sa[uú]de|farm/.test(t)) tags.push("saude");
  if (/joia|j[oó]ia|prata|ouro|semijoia/.test(t)) tags.push("joias", "varejo");
  if (/loja|moda|varejo|store|motors|esquadria|venda/.test(t)) tags.push("varejo");
  if (/beleza|est[eé]tica|sal[aã]o|cabelo|make/.test(t)) tags.push("beleza");
  if (/restaurante|caf[eé]|doce|bolo|gastr|aliment/.test(t)) tags.push("gastronomia");
  return tags;
}
