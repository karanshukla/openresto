---
title: Which URL goes where
description: CORS_ORIGINS, WEBSITE_URL, the brand website URL and the native app server address, and what each one controls.
sidebar:
  order: 3
---

This page helps you pick the right address for each setting. Several settings look like "my
site's address" but do different jobs. Mixing them up is the most common reason a login fails in
the browser, an email link points at `localhost`, or a native app talks to the wrong server.

Here, your public address is `https://bookings.example.com`.

## At a glance

| Setting | Where you set it | What it controls |
| ------- | ---------------- | ---------------- |
| `CORS_ORIGINS` | `.env` | Which browser addresses the API will answer. Needed. It is a safety list, not a link. |
| `WEBSITE_URL` | `.env` (uncomment it in the compose file) | The address put into emails, Wallet passes and the native app readiness checks. Optional. |
| **Website URL** in the brand settings | Admin, Brand | The same job as `WEBSITE_URL`, set from the admin. Takes priority over the others. |
| `--server` for `native:init` | Command line, when building the app | The address the native app talks to. Baked into the app at build time. |
| `EXPO_PUBLIC_API_URL` | Already set to `/api` in the release compose | Where the web app finds the API. Leave it alone. |

## `CORS_ORIGINS`: who may call the API

Browsers don't let a page on one address call an API on another unless the API says it's
allowed. This rule is called CORS, and `CORS_ORIGINS` is the list of allowed addresses. Please
use:

- the exact address people type: `https://`, the host and any port, with **no path and no
  trailing slash** (`https://bookings.example.com`, not `https://bookings.example.com/`);
- comma-separated if there are several (`https://bookings.example.com,https://www.example.com`);
- never `*`. The API won't start with a wildcard or an empty value.

Because the release stack serves the web app and the API from the same origin (nginx sends `/api`
to the backend), the simple rule is: **put your public address here and nothing else**. If
you add a second hostname that points at the same stack, add it here too. Otherwise the browser
will block calls from that hostname.

## The website URL: what goes into links

Anything the server writes that has to contain your address uses the **website URL**: the link in
a confirmation email, the QR code on a Wallet pass, and the checks on the admin's Native app
page. The server picks it from the first of these that is set:

1. **Website URL in the admin brand settings.**
2. **`WEBSITE_URL`** in the environment.
3. **The first entry of `CORS_ORIGINS`.**
4. `http://localhost:8081`, which is just the development default.

For most installs step 3 is right and you set nothing. You only need `WEBSITE_URL` (or the brand setting)
when the address in emails should differ from the one in `CORS_ORIGINS`, for example when
`CORS_ORIGINS` lists several origins and the first is not the one you want guests to click.

:::caution
If emails or Wallet passes contain `localhost`, `CORS_ORIGINS` still holds its default (the
release compose defaults it to `http://localhost`). Set it to your public address and try again.
:::

The brand setting wins over the environment, so if you set it in the admin and later
change `WEBSITE_URL` in `.env`, you won't see any change. Clear the field in the admin to
use the `.env` value again.

## The native app's server address

The native app does not read your `.env`. The address is chosen when you build it:

```bash
npm run native:init -- --server https://bookings.example.com --bundle-id com.example.bistro
```

It needs to be `https` (plain `http` only works for `localhost`) and it is built into the app.
If you later move to a different domain, rebuild and resubmit the app. Use the same address as
your public one so the readiness checks and the app agree. See
[Native app overview](/guides/native-app-overview/).

## Moving to a new domain

1. Point DNS and your TLS setup at the new name, see [HTTPS and reverse proxies](/self-hosting/https/).
2. Update `CORS_ORIGINS` (and `WEBSITE_URL` if you set it) in `.env`, then `docker compose up -d`.
3. Check the **Website URL** in the admin brand settings: if it holds the old address, update it.
4. Browser push subscriptions are tied to the origin, so admins and guests turn them on again at the new
   address.
5. The native app still points at the old server. Rebuild it with the new `--server`.
