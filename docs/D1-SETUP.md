# OLV D1 setup

The Cloudflare Pages Functions now expect a D1 binding named **OLV_DB**.

## Production setup

Done on 2026-10-11: database **olv-db** (id `a008349f-ee20-4412-aea3-8347696ba081`) was created and migrations 0001 + 0002 were applied. Only steps 2–4 and 6 (the Pages binding + redeploy) are left for the owner.


1. Create a Cloudflare D1 database.
2. Open the OLV Pages project in Cloudflare.
3. Go to **Settings → Bindings → Add → D1 database**.
4. Set the variable name to **OLV_DB** and select the production D1 database.
5. Apply `migrations/0001_orders_loyalty.sql` and `migrations/0002_rating_comment.sql` to the database.
6. Redeploy the Pages project.

The code keeps `data/menu.json` in GitHub because the menu is published static content. Orders, ratings and loyalty are stored in D1 (`/api/orders`, `/api/rate-order`, `/api/loyalty`).

## Existing orders

The current repository contains historical customer orders in `data/orders.json`. This migration intentionally does not copy those records into the SQL migration, so customer data is not duplicated into another committed file.

Before switching production traffic, import any historical orders you need into D1, then remove `data/orders.json` and its customer-data history from the public repository.

Cloudflare Pages D1 bindings: https://developers.cloudflare.com/pages/functions/bindings/

## Staff accounts (2026-10-11)

Staff no longer share one key. The owner adds each staff member in **admin.html → الموظفين** (name + 4–8 digit PIN), and can deactivate, reset the PIN or delete them there. Waiters log in on waiter.html with that name and PIN; the server records orders under the account's name. The old shared `OLV_STAFF_KEY` is no longer accepted; `OLV_ADMIN_KEY` still works everywhere. Table: `migrations/0003_staff.sql` (already applied to olv-db).
