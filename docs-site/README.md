# OpenResto docs

Source for [docs.openres.to](https://docs.openres.to), built with [Starlight](https://starlight.astro.build).

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # static output in dist/
```

Pages are Markdown in `src/content/docs/`. The API reference under `/api/reference/` is
generated at build time from `../openresto-cli/openapi/v1.json`.

## Deploying (Cloudflare Workers static assets)

`wrangler.jsonc` serves `dist/` as a static-assets Worker and attaches `docs.openres.to` as its
custom domain, so nothing runs on the VPS. Create it from **Workers & Pages → Create → Import a
repository** with:

| Setting         | Value                      |
| --------------- | -------------------------- |
| Project name    | `openresto-docs` (must match `name` in `wrangler.jsonc`) |
| Path (root dir) | `docs-site`                |
| Build command   | `npm run build`            |
| Deploy command  | `npx wrangler deploy`      |
| Preview command | `npx wrangler versions upload` |

Node 24 comes from `.node-version`. The build reads `../openresto-cli/openapi/v1.json`, so keep
the default full-repository checkout. Under the project's **Build → Build watch paths**, include
`docs-site/*` and `openresto-cli/openapi/*` so unrelated pushes do not rebuild it.
