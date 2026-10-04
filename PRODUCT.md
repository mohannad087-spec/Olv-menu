# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Café and restaurant guests ordering from their own phone: dine-in customers at a table (hall), takeaway and delivery customers. Arabic first, English available. Staff (waiter, kitchen) use separate pages of the same site. [Inferred from the repository, not yet confirmed by the owner.]

## Product Purpose
The customer menu and ordering page for OLV, a modern café and restaurant in Jordan. A guest browses the menu, customizes an item, orders (sent to the kitchen and by WhatsApp), and tracks the order. Success: a guest finds an item and orders it fast on a phone, and the place feels like OLV.

## Positioning
Phone ordering and order tracking (points, ratings, fixed-price meal upgrade, hall vs takeaway pricing) inside a modern café experience, rather than a plain price list. [Inferred, not yet confirmed.]

## Operating Context
Static site (index.html, data/menu.json, Cloudflare Pages and GitHub Pages) with serverless functions. 107 items in 15 categories. Prices in JD. The page switches theme by hour: light 06:00 to 18:00, dark otherwise. Menu is edited through admin.html.

## Capabilities and Constraints
Bilingual (ar, en) with RTL. Server-side price checks, Turnstile, WhatsApp ordering, installable as an app, QR for the public menu. Behavior and ordering flow must not change in a visual redesign. Network in this build environment blocks Unsplash and Google Fonts, so photos and web fonts cannot be previewed here.

## Brand Commitments
Name OLV. Logo (assets/olv-logo.svg, olv-logo-transparent.webp, olv-icon.png) in gold and olive green. The owner describes the venue as a modern café in light beige and light gray; a hall with travertine and natural stone, lamps and flowers. Warm and cozy at night, elegant and clean by day. The owner rejects the current look as cheap and AI-generated and wants something specific to OLV.

## Evidence on Hand
No photos of the venue or the dishes, and none will be taken. Dish photos are reference images of the same kind of product, to be swapped for real ones over time (owner, 2026-10-04). They must not be presented as OLV's own dishes, and each must be replaceable per item without code. No testimonials, awards or press.

## Product Principles
1. Ordering speed on a phone comes before decoration.
2. The look comes from the venue's own materials and light, not from a template.
3. Every photo is a stand-in until replaced; the design must hold up with reference photos and with real ones.
4. Arabic is the primary language, English is never an afterthought.
5. Do not change what the ordering flow does.

## Accessibility & Inclusion
Touch targets of at least 44px, readable contrast, keyboard access and labeled controls (the audit found gaps in all of these).
