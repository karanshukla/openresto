# OpenResto docs

Source for [docs.openres.to](https://docs.openres.to), built with [Starlight](https://starlight.astro.build).

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # static output in dist/
```

Pages are Markdown files in `src/content/docs/`. The API reference under `/api/reference/` is generated at build time from `../openresto-cli/openapi/v1.json`.

## Look and feel

The theme matches the landing page at [get.openres.to](https://get.openres.to): warm ink and paper greys, terracotta accent (`#C2562B`), Inter typography, and the utensils brand mark.

- `src/styles/theme.css` maps the palette onto Starlight's `--sl-color-*` tokens for dark mode (Starlight's default, on `:root`) and light mode (`:root[data-theme="light"]`).
- `src/components/` overrides three Starlight components: `SiteTitle` (brand mark plus "OpenResto Docs"), `SocialIcons` (adds Home and the Live demo button), and `Footer` (adds the landing page brand row).
- Code blocks use a single dark theme in both modes, configured under `expressiveCode` in `astro.config.mjs`, to match the landing page terminal styling.
- Inter is self-hosted via `@fontsource-variable/inter`, so pages do not load Google Fonts.

If the landing page colours change, update the tokens at the top of `theme.css` to match.

## Deploying (Cloudflare Workers static assets)

`wrangler.jsonc` serves `dist/` as a Cloudflare Workers static-assets site with `docs.openres.to` as its custom domain, so nothing runs on the VPS. Create it under **Workers & Pages → Create → Import a repository** with these settings:

| Setting         | Value                                                     |
| --------------- | --------------------------------------------------------- |
| Project name    | `openresto-docs` (must match `name` in `wrangler.jsonc`)  |
| Path (root dir) | `docs-site`                                               |
| Build command   | `npm run build`                                           |
| Deploy command  | `npx wrangler deploy`                                     |
| Preview command | `npx wrangler versions upload`                            |

Node 24 is specified in `.node-version`. Keep the default full-repository checkout because the build reads `../openresto-cli/openapi/v1.json`. Under **Build → Build watch paths**, include `docs-site/*` and `openresto-cli/openapi/*` so unrelated pushes do not trigger rebuilds.
