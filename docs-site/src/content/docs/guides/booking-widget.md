---
title: Booking widget for your website
description: Put the OpenResto booking form on your restaurant's own website with one line of HTML.
sidebar:
  order: 4
---

Most restaurants already have a website. The booking widget puts the OpenResto booking form
inside it, so a guest can book a table without leaving your site. It uses your brand colour,
holds the table while the guest types, and shows the booking reference when it's done.

## 1. Allow your site

Browsers only show the widget inside sites you list. Until you add one, it can't be shown
anywhere.

1. Sign in to the admin as an **Owner** and open **Settings → Website widget**.
2. Under **Allowed sites**, add your website's address, for example `https://myrestaurant.com`.
   Add each address your site is served from: `https://www.myrestaurant.com` is a different
   site from `https://myrestaurant.com`.

Enter just the scheme and host (and the port, if it isn't the default). A path such as
`https://myrestaurant.com/book` is refused. Changes apply to the next page load.

## 2. Paste the snippet

Copy the snippet from **Snippet** on the same screen and paste it where the form should appear
in your site's HTML:

```html
<script
  src="https://bookings.myrestaurant.com/embed.js"
  data-location="3"
></script>
```

- `src` is your OpenResto address.
- `data-location` pins the widget to one location. Leave it out to let guests choose from all
  of your locations. Pick a location in the admin and the snippet fills in its number.

The script adds the form in place of the tag and resizes it to fit as the guest moves through
the booking.

### Sites that don't allow scripts

Some site builders strip `<script>` tags. Use the **Link only** snippet instead. It opens the
same form in a new tab, and it works whether or not your site is on the allowed list:

```html
<a href="https://bookings.myrestaurant.com/embed?location=3" target="_blank"
  >Book a table</a
>
```

## What guests see

The widget shows the party size, date, time and guest details, with no OpenResto header or
footer. When the booking is made it shows the booking reference, with **View booking** to open
the full booking page in a new tab.

Browsers don't let a page inside another site set cookies the way a normal visit does, so the
"recent bookings" list on your OpenResto site won't include bookings made through the widget.
Guests find them with the reference and their email under **My Bookings**.

## Using your own reverse proxy

The bundled nginx sends `frame-ancestors` with your allowed sites on `/embed` only. Every other
page keeps `X-Frame-Options: DENY` and `frame-ancestors 'none'`. It reads the list from
`GET /api/embed/frame-ancestors`, which answers `204` with the value in an `X-Frame-Ancestors`
header (`'none'` when the list is empty).

If you run your own proxy in front of OpenResto instead, do the same for `/embed`, and serve
`/embed.js` with `Cross-Origin-Resource-Policy: cross-origin` so other sites can load it. Copy
the `/embed` blocks from `nginx/default.conf.template` as a starting point.
