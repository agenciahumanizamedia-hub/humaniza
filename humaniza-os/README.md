# Humaniza OS

Plataforma única da Agência Humaniza (une o Hub Humaniza e o Sistema Agência). Roda no Wix
(projeto headless gerenciado, site **Humaniza OS**) e o código fica aqui, no GitHub.

Os sistemas antigos (`index.html`, `cliente.html`, `js/` na raiz do repositório e o repositório
`hub-humaniza`) continuam funcionando no Firebase até a virada. Nada aqui altera os dados deles.

## Como funciona a segurança

- Login com e-mail e senha pelo Wix (`/login`). Criar a senha não dá acesso a nada sozinho.
- O administrador libera cada e-mail em **Acessos**, escolhendo o perfil: Administrador, Equipe ou
  Cliente (com a empresa vinculada). Isso fica na coleção `osUsers`.
- Todas as coleções `os*` no CMS do Wix são somente-admin. O navegador nunca lê o banco direto:
  os dados saem pelos endpoints em `src/pages/api/`, que conferem no servidor quem é a pessoa
  (`src/server/access.ts`) e filtram por perfil:
  - **Admin**: tudo.
  - **Equipe**: clientes em que o e-mail dela está em `teamEmails`.
  - **Cliente**: somente a própria empresa e o que for marcado como visível ao cliente.
- Toda ação relevante fica registrada em `osActivity` com nome, e-mail, perfil, data e hora.

## Estrutura

```
src/
  server/            só roda no servidor (acesso ao banco, permissões, histórico)
    db.ts            leitura/escrita no CMS com permissão elevada
    access.ts        quem é a pessoa e o que ela pode ver
    activity.ts      histórico e timeline por perfil
    http.ts          respostas e validação dos endpoints
  pages/
    api/             endpoints: me, clients, users, activity
    painel.astro     painel único (o menu muda por perfil)
    login.astro      entrar / criar acesso
  components/
    os/              telas do painel (AppShell e api.ts)
    members/         login e sessão (código pronto da Wix, traduzido)
  styles/global.css  cores e fontes da Humaniza (bloco @theme)
wix.config.json      site e app do Wix (não são segredos)
```

## Publicar

Cada alteração aprovada na `main` dentro de `humaniza-os/` é publicada pelo GitHub Actions
(`.github/workflows/humaniza-os.yml`). Requer o segredo `HUMANIZA` (chave de API do Wix) no repositório.

Para rodar no computador: Node 24+, `npm install`, `npx wix login`, `npx wix env pull`, `npx wix dev`.

## Dados no Wix

- Site: `f091dbba-0ee2-4e1f-b85d-aa1d449ffc90` (painel: https://manage.wix.com/dashboard/f091dbba-0ee2-4e1f-b85d-aa1d449ffc90)
- Coleções: `osUsers`, `osClients`, `osActivity` (as próximas etapas adicionam projetos, conteúdos,
  versões, pedidos de ajuste, tarefas, agenda, briefings e arquivos).
