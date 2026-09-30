# Sistema Agência Humaniza — versão modular para Git/Vercel

Esta entrega reorganiza fisicamente o sistema sem migrar, apagar ou renomear dados do Firebase.

## Arquivos
- index.html
- css/app.css
- js/app.js
- briefing.html / css/briefing.css / js/briefing.js
- roteiro.html / css/roteiro.css / js/roteiro.js
- cliente.html / css/cliente.css / js/cliente.js / js/firebase.js

## Como publicar no Git
Substitua os arquivos da raiz e envie também as pastas `css` e `js`.
Não envie somente o `index.html`, porque agora os estilos e scripts estão externos.

## O que foi preservado
- login e autenticação existentes
- nomes das coleções e documentos Firebase
- URLs públicas `/briefing.html`, `/roteiro.html` e `/cliente.html`
- Google Identity Services carregado pelo painel
- dados já cadastrados

## Observação técnica
O painel principal agora tem HTML, CSS e JavaScript separados. A lógica interna de `js/app.js`
foi mantida junta nesta primeira reorganização para não quebrar estado compartilhado, listeners,
autenticação e funções globais. A extração de Equipe, Roteiros, Briefings, Agenda e Orçamentos
para módulos JS independentes deve ser feita gradualmente, um módulo por vez, com teste entre etapas.
