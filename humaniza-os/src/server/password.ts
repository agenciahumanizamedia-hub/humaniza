// Senhas de acesso criadas pelo administrador.
//
// O Wix não tem um "definir senha do membro" para o dono do site. O caminho oficial é:
//   1. Sign On (servidor, com permissão elevada): devolve uma sessão do membro sem pedir senha.
//      https://dev.wix.com/docs/api-reference/business-management/headless/authentication/sign-on
//   2. A sessão vira tokens do membro (Redirect Session + código PKCE, com o app do site).
//   3. Com os tokens do membro, Change Password grava a senha nova.
//      https://dev.wix.com/docs/api-reference/business-management/headless/authentication/change-password
// A senha só existe na resposta para o administrador copiar: não é gravada em lugar nenhum do sistema.
// Se algo falhar, o administrador ainda pode mandar o e-mail oficial do Wix para a pessoa criar a senha.
import { auth } from "@wix/essentials";
import { authentication as identity } from "@wix/identity";
import { authentication as membersAuthentication } from "@wix/members";
import wixConfig from "../../wix.config.json";

// App OAuth do site (não é segredo: só emite tokens de visitante/membro deste site).
const CLIENT_ID: string = (wixConfig as { appId: string }).appId;

// Sem letras parecidas (l, I, O, 0, 1) para ninguém errar ao digitar.
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const LOWER = "abcdefghijkmnpqrstuvwxyz";
const DIGIT = "23456789";
const SYMBOL = "@#$%*!";

function pick(set: string, n: number): string[] {
  const bytes = new Uint32Array(n);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => set[b % set.length]);
}

/** Senha forte e fácil de ditar: 12 caracteres com maiúscula, minúscula, número e símbolo. */
export function generatePassword(): string {
  const chars = [...pick(UPPER, 3), ...pick(LOWER, 5), ...pick(DIGIT, 3), ...pick(SYMBOL, 1)];
  const order = new Uint32Array(chars.length);
  crypto.getRandomValues(order);
  return chars
    .map((c, i) => ({ c, k: order[i] }))
    .sort((a, b) => a.k - b.k)
    .map((x) => x.c)
    .join("");
}

const elevatedSignOn = auth.elevate(identity.signOn);
const elevatedSendSetPassword = auth.elevate(membersAuthentication.sendSetPasswordEmail);

/** Erro com a etapa em que falhou, para o administrador saber o que aconteceu. */
export class PasswordStepError extends Error {
  constructor(public step: string, public cause: unknown) {
    super(`${step}: ${detail(cause)}`);
  }
}
function detail(err: unknown): string {
  const e = err as any;
  return String(e?.details?.applicationError?.description ?? e?.details?.applicationError?.code ?? e?.message ?? e).slice(0, 300);
}

const API = "https://www.wixapis.com";
const b64url = (buf: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function postJson(url: string, body: unknown, authorization?: string): Promise<any> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...(authorization ? { authorization } : {}) },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data: any = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text.slice(0, 200) }; }
  if (!res.ok) throw new Error(`${res.status} ${data?.message ?? data?.raw ?? ""}`.trim());
  return data;
}

/**
 * Grava `password` como a senha do membro com este e-mail (cria o membro se ainda não existir).
 * Caminho testado no site: Sign On (elevado) → token de visitante do app do site → Redirect Session
 * (web_message) → página de autorização devolve o código → tokens do membro (PKCE) → Change Password.
 * https://dev.wix.com/docs/go-headless/coding/rest-api/visitors-and-members/handle-members-with-custom-login
 */
export async function setMemberPassword(email: string, password: string): Promise<void> {
  let sessionToken: string | undefined;
  try {
    const res: any = await elevatedSignOn({ email } as any, { verifyEmail: true } as any);
    sessionToken = res?.sessionToken;
  } catch (e) {
    throw new PasswordStepError("sign-on", e);
  }
  if (!sessionToken) throw new PasswordStepError("sign-on", "sem sessão na resposta");

  let memberToken: string;
  try {
    const visitor = await postJson(`${API}/oauth2/token`, { clientId: CLIENT_ID, grantType: "anonymous" });
    const verifier = b64url(crypto.getRandomValues(new Uint8Array(32)));
    const challenge = b64url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
    const state = b64url(crypto.getRandomValues(new Uint8Array(12)));
    const session = await postJson(
      `${API}/_api/redirects-api/v1/redirect-session`,
      { auth: { authRequest: { clientId: CLIENT_ID, codeChallenge: challenge, codeChallengeMethod: "S256", responseMode: "web_message", responseType: "code", scope: "offline_access", state, sessionToken } } },
      visitor.access_token,
    );
    const page = await fetch(session?.redirectSession?.fullUrl);
    const html = await page.text();
    const code = html.match(/['"]code['"]\s*:\s*['"]([^'"]+)['"]/)?.[1];
    if (!code) throw new Error(`autorização sem código (${page.status})`);
    const tokens = await postJson(`${API}/oauth2/token`, { clientId: CLIENT_ID, grantType: "authorization_code", code, codeVerifier: verifier });
    memberToken = tokens.access_token;
    if (!memberToken) throw new Error("sem token do membro");
  } catch (e) {
    throw new PasswordStepError("tokens", e);
  }

  try {
    await postJson(`${API}/_api/iam/authentication/v2/change-password`, { newPassword: password }, memberToken);
  } catch (e) {
    throw new PasswordStepError("change-password", e);
  }

  // Confere de verdade: entra com a senha nova. E-mails que são donos/colaboradores do site no Wix
  // entram com a senha da conta Wix, não com a senha de membro, e caem aqui.
  let state = "";
  try {
    const visitor = await postJson(`${API}/oauth2/token`, { clientId: CLIENT_ID, grantType: "anonymous" });
    const login = await postJson(`${API}/_api/iam/authentication/v2/login`, { loginId: { email }, password }, visitor.access_token);
    state = String(login?.state ?? "");
  } catch (e) {
    state = String((e as Error)?.message ?? e);
  }
  if (state !== "SUCCESS") throw new PasswordStepError("conferência", OWNER_EMAIL);
}

export const OWNER_EMAIL = "owner-email";

/** E-mail oficial do Wix com um link (válido por 3 horas) para a pessoa criar a própria senha. */
export async function sendSetPasswordEmail(email: string): Promise<void> {
  await elevatedSendSetPassword(email, { hideIgnoreMessage: true } as any);
}

/** Troca a senha de quem está logado (usa a sessão da própria pessoa, sem elevação). */
export async function changeOwnPassword(newPassword: string): Promise<void> {
  await identity.changePassword(newPassword);
}

/** Mensagem curta em português para os erros mais comuns do Wix. */
export function passwordError(err: unknown): string {
  if (err instanceof PasswordStepError && err.cause === OWNER_EMAIL)
    return "Este e-mail é de quem administra o site no Wix (dono ou colaborador). Ele entra com a senha da conta Wix, não com uma senha gerada. Use outro e-mail para o cliente ou para a equipe.";
  const m = err instanceof PasswordStepError ? detail(err.cause) : String((err as any)?.details?.applicationError?.description ?? (err as Error)?.message ?? err);
  const where = err instanceof PasswordStepError ? ` [etapa ${err.step}: ${m.slice(0, 160)}]` : "";
  if (/password.*(length|short|weak|requirement|complex)/i.test(m)) return "A senha não atende às regras do Wix (tamanho ou complexidade)." + where;
  if (/permission|forbidden|403|unauthori/i.test(m)) return "O Wix não permitiu definir a senha por aqui." + where;
  return "Não foi possível definir a senha agora." + where;
}
