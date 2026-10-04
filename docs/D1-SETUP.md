# OLV D1 setup

The Cloudflare Pages Functions now expect a D1 binding named **OLV_DB**.

## Production setup

1. Create a Cloudflare D1 database.
2. Open the OLV Pages project in Cloudflare.
3. Go to **Settings → Bindings → Add → D1 database**.
4. Set the variable name to **OLV_DB** and select the production D1 database.
5. Apply `migrations/0001_orders_loyalty.sql` to the database.
6. Redeploy the Pages project.

The code keeps `data/menu.json` in GitHub because the menu is published static content. Orders and loyalty are stored in D1.

## Existing orders

The current repository contains historical customer orders in `data/orders.json`. This migration intentionally does not copy those records into the SQL migration, so customer data is not duplicated into another committed file.

Before switching production traffic, import any historical orders you need into D1, then remove `data/orders.json` and its customer-data history from the public repository.

Cloudflare Pages D1 bindings: https://developers.cloudflare.com/pages/functions/bindings/
