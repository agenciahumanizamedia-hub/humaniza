#!/usr/bin/env node
// Liga o site "Humaniza OS" à hospedagem do Wix CLI (OAuth app + projeto de hospedagem + variáveis).
//
// Por que existe: o site foi criado pela integração do Wix com o Claude (chamada "provision"), que
// não cria o "projeto de hospedagem" que o `wix env pull` e o `wix release` esperam. Este script faz,
// para o site já existente, as mesmas chamadas que o kit oficial da Wix faz (wix-headless-kit,
// install/attach.mjs, parte 1 — https://github.com/wix/skills). É idempotente: reaproveita o que
// já existe e pode rodar a cada publicação.
//
// Requer: `npx wix login --api-key ...` já feito. Lê siteId de wix.config.json.
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const MANAGE = "https://manage.wix.com";
const HEADLESS_PROJECT_TYPE_ID = "eb363dea-85a0-4159-9b05-949542be5079";
const SLUG = "humaniza-os";
const NAME = "Humaniza OS";

const config = JSON.parse(readFileSync("wix.config.json", "utf8"));
const siteId = config.siteId;
if (!siteId) throw new Error("wix.config.json sem siteId");

const tok = spawnSync("npx", ["wix", "token", "--site", siteId], { encoding: "utf8", timeout: 120_000 });
const token = (tok.stdout || "").trim();
if (tok.status !== 0 || !token) {
  console.error((tok.stderr || tok.stdout || "").slice(-400));
  throw new Error("Sem token do Wix CLI — o login com a chave de API funcionou?");
}

async function call(path, { method = "POST", body, query } = {}) {
  const url = new URL(MANAGE + path);
  for (const [k, v] of Object.entries(query ?? {})) url.searchParams.set(k, String(v));
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: token,
      "Content-Type": "application/json",
      "X-XSRF-TOKEN": "nocheck",
      Cookie: "XSRF-TOKEN=nocheck",
      "User-Agent": "wix-cli",
      "wix-site-id": siteId,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${url.pathname} ${res.status}: ${text.slice(0, 300)}`);
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

const comp = await call("/_api/companion-apps/v1/companion-apps/get-or-create", { body: {} });
const appId = comp.companionApp?.id;
if (!appId) throw new Error("get-or-create não devolveu o app");
if (appId !== config.appId) {
  console.log(`appId do site: ${appId} (wix.config.json tinha ${config.appId}) — atualizado nesta execução.`);
  writeFileSync("wix.config.json", JSON.stringify({ ...config, appId }, null, 2) + "\n");
}

let appProject = null;
try {
  appProject = (await call(`/_api/wix-code-app-projects/v1/app-projects/${appId}`, { method: "GET" })).appProject;
} catch {
  appProject = null;
}
let instanceId = null;
if (!appProject) {
  try {
    await call(`/apps-service/v1/apps/${appId}/set-namespace`, { method: "PATCH", body: { appId, appName: NAME, namespace: SLUG } });
  } catch (e) {
    console.log("aviso set-namespace:", String(e.message).slice(0, 200));
  }
  try {
    const inst = await call("/apps-installer-service/v1/app-instance/install", {
      body: { tenant: { id: siteId, tenantType: "SITE" }, appInstance: { appDefId: appId, version: "latest" } },
    });
    instanceId = inst.appInstance?.id ?? null;
  } catch (e) {
    console.log("aviso install:", String(e.message).slice(0, 200));
  }
  appProject = (
    await call("/_api/wix-code-app-projects/v1/app-projects", {
      body: { appProject: { id: appId, displayName: NAME, slug: SLUG, appProjectTypeId: HEADLESS_PROJECT_TYPE_ID } },
    })
  ).appProject;
  console.log("projeto de hospedagem criado");
} else {
  console.log("projeto de hospedagem já existe");
}
if (!appProject?.baseUrl) throw new Error("projeto de hospedagem sem baseUrl");

const prod = String(appProject.baseUrl).replace(/\/$/, "");
const host = new URL(appProject.baseUrl).hostname;
const local = "http://localhost:4321";
await call(`/oauth-app-service/v1/oauth-apps/${appId}`, {
  method: "PATCH",
  body: {
    oAuthApp: {
      id: appId,
      allowedDomains: [local, `https://(.*)-${host}`, prod],
      allowedRedirectUris: [
        `${local}/api/auth/callback`,
        `${local}/api/auth/logout-callback`,
        `https://*-${host}/api/auth/callback`,
        `https://*-${host}/api/auth/logout-callback`,
        `${prod}/api/auth/callback`,
        `${prod}/api/auth/logout-callback`,
      ],
      redirectUrlWixPages: prod,
      origin: "other",
    },
    mask: { paths: ["allowedDomains", "allowedRedirectUris", "redirectUrlWixPages", "origin"] },
  },
});

if (!instanceId) {
  try {
    const env = await call(`/_api/wix-code-app-environments/v2/app-projects/${appProject.id}/app-environment-variables`, {
      method: "GET",
      query: { environment: "system_global" },
    });
    instanceId = (env.appEnvironmentVariables ?? []).find((v) => v.key === "WIX_CLIENT_INSTANCE_ID")?.value ?? null;
  } catch {
    /* segue sem */
  }
}
const secrets = (await call(`/apps-service/v1/apps/${appId}`, { method: "GET", query: { withSecrets: true } })).app?.appSecrets;
if (!secrets?.appSecret) throw new Error("segredos do app indisponíveis");
const variables = {
  WIX_CLIENT_ID: appId,
  WIX_CLIENT_SECRET: secrets.appSecret,
  WIX_CLIENT_PUBLIC_KEY: secrets.webhookPublicKey,
  ...(instanceId ? { WIX_CLIENT_INSTANCE_ID: instanceId } : {}),
};
await call(`/_api/wix-code-app-environments/v2/bulk/app-projects/${appProject.id}/app-environment-variables/upsert`, {
  body: { appProjectId: appProject.id, environment: "system_global", mutability: "STATIC", returnEntity: true, returnAllEnvironment: true, variables },
});
console.log(`pronto: ${prod}`);
