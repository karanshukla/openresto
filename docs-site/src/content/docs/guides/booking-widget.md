---
title: Booking widget for your website
description: Put the OpenResto booking form on your restaurant's own website with one line of HTML.
sidebar:
  order: 4
---

The booking widget embeds the OpenResto booking form directly into your restaurant's website so guests can book without leaving your site. It uses your brand colour, holds the table while the guest enters their details, and displays the booking reference on completion.

## 1. Allow your site

Browsers only render the embedded widget on origins you explicitly allow. Until you add at least one origin, embedding is blocked everywhere.

1. Sign in to the admin as an **Owner** and open **Settings → Website widget**.
2. Under **Allowed sites**, add your website's origin (for example, `https://myrestaurant.com`). Add every origin your site uses: `https://www.myrestaurant.com` and `https://myrestaurant.com` are treated as separate origins.

Enter only the scheme, host, and non-default port. Paths such as `https://myrestaurant.com/book` are rejected. Changes take effect on the next page load.

## 2. Paste the snippet

Before displaying the embed snippet, the admin verifies that your server sends the required headers by loading `/embed` and `/embed.js` as a browser would. If an upstream proxy strips or overrides those headers, the snippet is not shown and the card reports which header failed. Fix the proxy configuration (see [Using your own reverse proxy](#using-your-own-reverse-proxy)) and click **Check again**.

Copy the code from **Snippet** on the same screen and paste it where you want the form to appear in your HTML:

```html
<script
  src="https://bookings.myrestaurant.com/embed.js"
  data-location="3"
></script>
```

- `src`: Your OpenResto instance URL.
- `data-location`: Pins the widget to a single location ID. Omit it to let guests choose from all locations. Selecting a location in the admin populates this attribute automatically.

The script inserts the form where the tag is placed and resizes it automatically as the guest moves through the booking steps.

### Sites that don't allow scripts

If your website builder strips `<script>` tags, use the **Link only** snippet instead. It opens the same booking form in a new tab and does not require your site to be on the allowed list:

```html
<a href="https://bookings.myrestaurant.com/embed?location=3" target="_blank"
  >Book a table</a
>
```

## What guests see

The widget displays the party size, date, time, and guest details form without the OpenResto header or footer. After booking, it shows the booking reference and a **View booking** button that opens the full confirmation page in a new tab.

Because browsers restrict third-party cookies inside iframes, bookings made through the widget do not appear in the "recent bookings" list on your OpenResto site. Guests can look them up using their reference and email under **My Bookings**.

## Using your own reverse proxy

The bundled nginx sends `frame-ancestors` with your allowed origins on `/embed` only; all other routes keep `X-Frame-Options: DENY` and `frame-ancestors 'none'`. Nginx fetches the allowed list from `GET /api/embed/frame-ancestors`, which returns `204` with the header value in `X-Frame-Ancestors` (`'none'` when empty).

If you place your own reverse proxy in front of OpenResto, apply the same `frame-ancestors` header to `/embed` and serve `/embed.js` with `Cross-Origin-Resource-Policy: cross-origin` so external sites can load it. Use the `/embed` blocks in `nginx/default.conf.template` as a reference.
