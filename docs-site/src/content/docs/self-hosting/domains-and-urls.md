---
title: Which URL goes where
description: CORS_ORIGINS, WEBSITE_URL, the brand website URL and the native app server address, and what each one controls.
sidebar:
  order: 3
---

OpenResto has several URL settings that serve different purposes. Mixing them up is the most common reason browser logins fail, confirmation email links point to `localhost`, or a native app connects to the wrong host.

The examples below assume your public address is `https://bookings.example.com`.

## At a glance

| Setting                             | Where it is set                           | What it controls |
| ----------------------------------- | ----------------------------------------- | ---------------- |
| `CORS_ORIGINS`                      | `.env`                                    | Browser origins permitted to call the API. Required. |
| `WEBSITE_URL`                       | `.env` (uncomment in `docker-compose.yml`) | Base URL for email links, Wallet passes, and native app checks. Optional. |
| **Website URL** (brand settings)    | Admin → Settings → Brand                  | Same role as `WEBSITE_URL`, configured in the admin UI. Takes priority over `.env`. |
| `--server` for `native:init`        | Command line when building the app        | Server URL compiled into the native iOS/Android app. |
| `EXPO_PUBLIC_API_URL`               | Set to `/api` in the release compose file | API base path used by the web frontend. Leave unchanged. |

## `CORS_ORIGINS`: allowed browser origins

Browsers enforce Cross-Origin Resource Sharing (CORS), blocking API requests from origins the server has not explicitly allowed. Format `CORS_ORIGINS` as follows:

- Include scheme, host, and non-default port with **no path and no trailing slash** (`https://bookings.example.com`, not `https://bookings.example.com/`).
- Separate multiple origins with commas (`https://bookings.example.com,https://www.example.com`).
- Never use `*` or leave it empty; the backend refuses to start with a wildcard or empty value.

Because the release stack serves both the frontend and `/api` from the same origin via nginx, set `CORS_ORIGINS` to your public URL. If you expose the same stack under an additional hostname, include that hostname as well.

## Website URL: base address for links

The server uses the **website URL** for confirmation email links, Wallet pass QR codes, and readiness checks on the admin Native app page. It resolves in priority order, using the first non-empty value:

1. **Website URL** in admin brand settings
2. `WEBSITE_URL` in the environment
3. The first entry of `CORS_ORIGINS`
4. `http://localhost:8081` (development fallback)

For most deployments, step 3 is enough and you do not need to set `WEBSITE_URL` or the brand field. Set one of them only when links should use a different origin than the first entry in `CORS_ORIGINS`.

:::caution
If emails or Wallet passes link to `localhost`, `CORS_ORIGINS` is still using the release compose default (`http://localhost`). Set `CORS_ORIGINS` to your public HTTPS address and run `docker compose up -d`.
:::

Because the admin brand setting takes priority over `WEBSITE_URL`, clear the admin field if you want changes to `WEBSITE_URL` in `.env` to take effect.

## Native app server address

The native app does not read `.env`. You pass the server URL when generating the native build configuration:

```bash
npm run native:init -- --server https://bookings.example.com --bundle-id com.example.bistro
```

The address must use `https` (plain `http` is only allowed for `localhost`) and is compiled into the binary. Use the same public address as your web deployment so readiness checks match. See [Native app overview](/guides/native-app-overview/).

## Moving to a new domain

1. Point DNS and TLS termination to the new domain (see [HTTPS and reverse proxies](/self-hosting/https/)).
2. Update `CORS_ORIGINS` (and `WEBSITE_URL` if set) in `.env`, then run `docker compose up -d`.
3. Update **Website URL** under **Admin → Settings → Brand** if it still holds the old domain.
4. Re-enable browser push notifications on the new domain (push subscriptions are bound to the browser origin).
5. Rebuild and resubmit the native app with the new `--server` value.
