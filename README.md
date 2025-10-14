# LogLine — Landing + Kernel + Demo (GitHub Pages)

Repositório pronto para publicar no **GitHub Pages** com:
- Landing estática (Tailwind CDN) + **narrativa completa** (inclui “Um Cartão Cidadão para o ChatGPT”)
- **Kernel para browser** (`dist/logline-kernel.browser.js`) usado no playground
- **Demo interativa** (`dist/demo.js`) que executa intents e mostra Receipts
- **OpenAPI** (`api/openapi.yaml` e `api/openapi.json`)
- **CLI Verificador** + **Replay** + **Dockerfile** (`cli/`)
- **GitHub Actions** para deploy de Pages e verificação de receipts/spans

## Publicar
1. Crie o repo `logline-landing` no GitHub e faça push deste conteúdo.
2. Vá em **Settings → Pages** e selecione **GitHub Actions** (o workflow `pages.yml` já está incluso).
3. Acesse a URL gerada em *Environments → github-pages*.

## Estrutura
```
logline-landing/
├─ public/
│  └─ index.html
├─ dist/
│  ├─ logline-kernel.browser.js
│  └─ demo.js
├─ api/
│  ├─ openapi.yaml
│  └─ openapi.json
├─ docs/
│  └─ PR-FAQ.md
├─ cli/
│  ├─ package.json
│  ├─ bin/logline-verify.mjs
│  ├─ lib/c14n.js
│  ├─ replay.mjs
│  └─ Dockerfile
└─ .github/workflows/
   ├─ pages.yml
   └─ receipt-verify.yml
```
