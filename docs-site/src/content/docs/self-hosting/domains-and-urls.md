---
title: Which URL goes where
description: CORS_ORIGINS, WEBSITE_URL, the brand website URL and the native app server address, and what each one controls.
sidebar:
  order: 3
---

OpenResto has several settings that all look like "my site's address". They do different jobs,
and mixing them up is the most common cause of a login that fails in the browser, an email link
that points at `localhost`, or a native app that talks to the wrong server.

Throughout this page the public address is `https://bookings.example.com`.

## At a glance

| Setting | Where you set it | What it controls |
| ------- | ---------------- | ---------------- |
| `CORS_ORIGINS` | `.env` | Which browser origins the API will answer. Required. It is a security allow-list, not a link. |
| `WEBSITE_URL` | `.env` (uncomment it in the compose file) | The address put into emails, Wallet passes and the native app readiness checks. Optional. |
| **Website URL** in the brand settings | Admin, Brand | The same job as `WEBSITE_URL`, set from the admin. Wins over everything else. |
| `--server` for `native:init` | Command line, when building the app | The address the native app talks to. Baked into the app at build time. |
| `EXPO_PUBLIC_API_URL` | Already set to `/api` in the release compose | Where the web app finds the API. Leave it alone. |

## `CORS_ORIGINS`: who may call the API

Browsers refuse to let a page on one origin call an API on another unless the API says it is
allowed. `CORS_ORIGINS` is that allow-list. It must be:

- the exact origin people type: scheme, host and port, with **no path and no trailing slash**
  (`https://bookings.example.com`, not `https://bookings.example.com/`);
- comma-separated if there are several (`https://bookings.example.com,https://www.example.com`);
- never `*`. The API refuses to start with a wildcard or an empty value.

Because the release stack serves the web app and the API from the same origin (nginx sends `/api`
to the backend), the practical rule is: **put your public address here and nothing else**. If
you add a second hostname that points at the same stack, add it here too, or the browser will
block calls made from that hostname.

## The website URL: what goes into links

Anything the server writes that has to contain your address uses the **website URL**: the link in
a confirmation email, the QR code on a Wallet pass, and the checks on the admin's Native app
page. The server picks it from the first of these that is set:

1. **Website URL in the admin brand settings.**
2. **`WEBSITE_URL`** in the environment.
3. **The first entry of `CORS_ORIGINS`.**
4. `http://localhost:8081`, which is only the development default.

For most installs step 3 is right and you set nothing. Set `WEBSITE_URL` (or the brand setting)
only when the address in emails should differ from the one in `CORS_ORIGINS`, for example when
`CORS_ORIGINS` lists several origins and the first is not the one you want guests to click.

:::caution
If emails or Wallet passes contain `localhost`, `CORS_ORIGINS` still holds its default (the
release compose defaults it to `http://localhost`). Set it to your public address first.
:::

The brand setting wins over the environment, so if you have set it once in the admin and later
change `WEBSITE_URL` in `.env`, nothing will appear to change. Clear the field in the admin to
fall back to the environment.

## The native app's server address

The native app does not read your `.env`. The address is chosen when you build it:

```bash
npm run native:init -- --server https://bookings.example.com --bundle-id com.example.bistro
```

It must be `https` (plain `http` is only accepted for `localhost`) and it is fixed in the binary.
If you later move to a different domain, rebuild and resubmit the app. Keep it the same as your
public address so the readiness checks and the app agree. See
[Native app overview](/guides/native-app-overview/).

## Moving to a new domain

1. Point DNS and your TLS setup at the new name, see [HTTPS and reverse proxies](/self-hosting/https/).
2. Update `CORS_ORIGINS` (and `WEBSITE_URL` if you set it) in `.env`, then `docker compose up -d`.
3. Check the **Website URL** in the admin brand settings: if it holds the old address, update it.
4. Browser push subscriptions are tied to the origin, so admins and guests re-enable them on the new
   address.
5. A native app is bound to the old server. Rebuild it with the new `--server`.
