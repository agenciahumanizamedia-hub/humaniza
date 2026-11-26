// Senhas de acesso criadas pelo administrador.
//
// O Wix não tem um "definir senha do membro" para o dono do site. O caminho oficial é:
//   1. Sign On (servidor, com permissão elevada): devolve uma sessão do membro sem pedir senha.
//      https://dev.wix.com/docs/api-reference/business-management/headless/authentication/sign-on
//   2. A sessão vira tokens do membro (getMemberTokensForDirectLogin, do OAuthStrategy).
//   3. Com os tokens do membro, Change Password grava a senha nova.
//      https://dev.wix.com/docs/api-reference/business-management/headless/authentication/change-password
// A senha só existe na resposta para o administrador copiar: não é gravada em lugar nenhum do sistema.
// Se algo falhar, o administrador ainda pode mandar o e-mail oficial do Wix para a pessoa criar a senha.
import { auth } from "@wix/essentials";
import { authentication as identity } from "@wix/identity";
import { authentication as membersAuthentication } from "@wix/members";
import { createClient, OAuthStrategy } from "@wix/sdk";
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

/** Grava `password` como a senha do membro com este e-mail (cria o membro se ainda não existir). */
export async function setMemberPassword(email: string, password: string): Promise<void> {
  const res: any = await elevatedSignOn({ email } as any, { verifyEmail: true } as any);
  const sessionToken: string | undefined = res?.sessionToken;
  if (!sessionToken) throw new Error("O Wix não devolveu a sessão do membro.");
  const tokens = await OAuthStrategy({ clientId: CLIENT_ID }).getMemberTokensForDirectLogin(sessionToken);
  const asMember = createClient({
    modules: { authentication: identity },
    auth: OAuthStrategy({ clientId: CLIENT_ID, tokens }),
  });
  await asMember.authentication.changePassword(password);
}

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
  const m = String((err as any)?.details?.applicationError?.description ?? (err as Error)?.message ?? err);
  if (/password.*(length|short|weak|requirement|complex)/i.test(m)) return "A senha não atende às regras do Wix (tamanho ou complexidade).";
  if (/permission|forbidden|403|unauthori/i.test(m)) return "O Wix não permitiu definir a senha por aqui.";
  return "Não foi possível definir a senha agora.";
}
