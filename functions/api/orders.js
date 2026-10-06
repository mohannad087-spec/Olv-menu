const API = 'https://api.github.com';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
  });
}

function safeKey(request) {
  return request.headers.get('x-olv-staff-key') || request.headers.get('x-olv-admin-key') || '';
}

function adminOK(request, env) {
  const provided = safeKey(request);
  if (!provided) return false;
  return provided === env.OLV_ADMIN_KEY || Boolean(env.OLV_STAFF_KEY && provided === env.OLV_STAFF_KEY);
}

function getDB(env) {
  return env.OLV_DB || null;
}

async function loadMenu(context) {
  const url = new URL('/data/menu.json', context.request.url);
  const res = await context.env.ASSETS.fetch(url.toString());
  if (!res.ok) throw new Error('Unable to load menu for price verification.');
  return res.json();
}

function roundMoney(n) {
  return Math.round(n * 100) / 100;
}

function priceForMode(basePrice, mode, menu) {
  if (mode !== 'hall') return basePrice;
  const pct = Number(menu.settings?.hallSurchargePercent) || 0;
  return roundMoney(basePrice * (1 + pct / 100));
}

// رقم الطاولة لطلبات الصالة لازم يكون رقم ضمن عدد الطاولات المحدد بالإدارة (الافتراضي 20).
function tableCount(menu) {
  const n = parseInt(menu.settings?.tableCount, 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 500) : 20;
}

// الطلب من الصالة (QR/الباركود) ممكن يتوقف كلياً أو بفترة يومية من الإدارة. نفس منطق index.html. المنطقة الزمنية الافتراضية Asia/Amman.
export function hallClosedNow(settings, date = new Date()) {
  const h = settings?.hallOrdering;
  if (!h || !h.mode || h.mode === 'on') return false;
  if (h.mode === 'off') return true;
  if (h.mode !== 'schedule') return false;
  const re = /^(\d{1,2}):(\d{2})$/;
  const a = re.exec(h.closedFrom || ''), b = re.exec(h.closedTo || '');
  if (!a || !b) return false;
  const from = +a[1] * 60 + +a[2], to = +b[1] * 60 + +b[2];
  if (from === to) return false;
  let now;
  try {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: h.timezone || 'Asia/Amman', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date);
    now = +parts.find(x => x.type === 'hour').value * 60 + +parts.find(x => x.type === 'minute').value;
  } catch { return false; }
  return from < to ? (now >= from && now < to) : (now >= from || now < to);
}

function verifyTable(raw, menu) {
  const t = String(raw ?? '').trim();
  if (!t) throw new Error('رقم الطاولة مطلوب لطلبات الصالة.');
  if (!/^\d{1,3}$/.test(t)) throw new Error('رقم الطاولة غير صحيح.');
  const n = parseInt(t, 10);
  const max = tableCount(menu);
  if (n < 1 || n > max) throw new Error(`رقم الطاولة لازم يكون بين 1 و ${max}.`);
  return String(n);
}

function verifyOrderItems(rawItems, menu, mode) {
  if (rawItems.length > 50) throw new Error('Too many items in order.');
  const byId = new Map((menu.items || []).map(i => [String(i.id), i]));
  const items = [];
  for (const raw of rawItems) {
    const real = byId.get(String(raw?.id));
    if (!real) throw new Error(`Unknown item: ${raw?.id}`);
    if (real.available === false) throw new Error(`${real.ar} غير متوفر حالياً.`);
    if (Array.isArray(real.variants) && real.variants.length) throw new Error(`اختر نوع ${real.ar}.`);
    const qty = Math.max(1, Math.min(50, parseInt(raw?.qty, 10) || 0));
    if (!qty) throw new Error(`Invalid quantity for ${real.ar}.`);
    const wantsMeal = raw?.custom?.meal === true && real.meal && Number(real.meal.price) > 0;
    const sized = !wantsMeal && real.large && Number(real.large.price) > 0;
    const large = sized && raw?.custom?.size === 'large';
    const basePrice = wantsMeal ? Number(real.meal.price) : large ? Number(real.large.price) : real.price;
    const label = wantsMeal ? `${real.ar} (وجبة)` : sized ? `${real.ar} (${large ? 'كبير' : 'صغير'})` : real.ar;
    const custom = raw?.custom;
    const customText = custom == null ? '' : JSON.stringify(custom);
    if (customText.length > 2000) throw new Error('Order customization is too large.');
    items.push({
      id: real.id,
      qty,
      price: priceForMode(basePrice, mode, menu),
      label,
      custom: custom || undefined
    });
  }
  if (!items.length) throw new Error('Order has no items.');
  const total = roundMoney(items.reduce((sum, i) => sum + i.price * i.qty, 0));
  const text = items.map(i => `${i.label} × ${i.qty}`).join('\\n') + `\\nالمجموع: ${total.toFixed(2)} JD`;
  return { items, total, text };
}

async function verifyTurnstile(token, ip, env) {
  const secret = env.TURNSTILE_SECRET_KEY;
  if (!secret) throw new Error('Bot verification is not configured yet.');
  if (!token) throw new Error('Missing bot verification token.');
  const body = new URLSearchParams();
  body.set('secret', secret);
  body.set('response', token);
  if (ip) body.set('remoteip', ip);
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body });
  const out = await res.json();
  if (!out.success) throw new Error('Bot verification failed.');
}

function normalizePhone(raw) {
  let n = String(raw || '').replace(/\\D/g, '');
  if (n.startsWith('0')) n = '962' + n.slice(1);
  return n;
}

function normalizeIdempotencyKey(raw) {
  const key = String(raw || '').trim();
  if (!key || key.length > 120) return '';
  return key;
}

function summarize(row) {
  return {
    id: row.id,
    number: row.number,
    status: row.status,
    mode: row.mode,
    table: row.table_no || '',
    name: row.name || '',
    phone: row.phone || '',
    address: row.address || '',
    waiter: row.waiter || '',
    total: Number(row.total || 0),
    items: JSON.parse(row.items_json || '[]'),
    text: row.text_summary || '',
    notes: row.notes || '',
    rating: row.rating == null ? null : Number(row.rating),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function rowOrder(dbRow) {
  return dbRow ? summarize(dbRow) : null;
}

async function findById(db, id) {
  return db.prepare('SELECT * FROM orders WHERE id = ?1').bind(id).first();
}

async function findByIdempotency(db, key) {
  if (!key) return null;
  return db.prepare('SELECT * FROM orders WHERE idempotency_key = ?1').bind(key).first();
}

async function nextOrderNumber(db) {
  const result = await db.prepare(
    'UPDATE order_counter SET next_number = next_number + 1 WHERE id = 1 RETURNING next_number - 1 AS number'
  ).run();
  const number = result.results?.[0]?.number;
  if (!Number.isInteger(number)) throw new Error('Unable to allocate order number.');
  return number;
}

async function rateLimited(db, ip) {
  if (!ip) return false;
  const cutoff = new Date(Date.now() - 3 * 60 * 1000).toISOString();
  const row = await db.prepare(
    'SELECT COUNT(*) AS count FROM orders WHERE ip = ?1 AND created_at > ?2'
  ).bind(ip, cutoff).first();
  return Number(row?.count || 0) >= 3;
}

async function awardPoints(db, phone, total, orderId) {
  const key = normalizePhone(phone);
  if (!key) return;
  const points = Math.floor(Number(total) || 0);
  if (points <= 0) return;

  // The order transition is guarded by loyalty_awarded=0, so only one
  // concurrent completion can reach this point for the same order.
  await db.prepare(
    `INSERT INTO loyalty_awards (order_id, phone, points, created_at)
     VALUES (?1, ?2, ?3, ?4)
     ON CONFLICT(order_id) DO NOTHING`
  ).bind(orderId, key, points, new Date().toISOString()).run();

  await db.prepare(
    `INSERT INTO loyalty (phone, points, total_orders, updated_at)
     VALUES (?1, ?2, 1, ?3)
     ON CONFLICT(phone) DO UPDATE SET
       points = loyalty.points + excluded.points,
       total_orders = loyalty.total_orders + 1,
       updated_at = excluded.updated_at`
  ).bind(key, points, new Date().toISOString()).run();

  await db.prepare('UPDATE orders SET loyalty_awarded = 1 WHERE id = ?1').bind(orderId).run();
}

async function ensureDB(db) {
  if (!db) throw new Error('OLV_DB D1 binding is not configured in Cloudflare Pages.');
}

export async function onRequest(context) {
  const { request, env } = context;
  const db = getDB(env);

  try {
    await ensureDB(db);

    if (request.method === 'GET') {
      const u = new URL(request.url);
      const id = u.searchParams.get('id');

      if (id) {
        const row = await findById(db, id);
        return row ? json({ ok: true, order: rowOrder(row) }) : json({ ok: false, error: 'Order not found' }, 404);
      }

      if (!adminOK(request, env)) return json({ ok: false, error: 'Admin access required.' }, 403);

      const result = await db.prepare(
        'SELECT * FROM orders ORDER BY created_at DESC LIMIT 1000'
      ).all();

      return json({ ok: true, orders: (result.results || []).map(rowOrder) });
    }

    if (request.method === 'POST') {
      const p = await request.json();

      if (!p?.mode || !Array.isArray(p.items) || !p.items.length) {
        return json({ ok: false, error: 'Invalid order payload.' }, 400);
      }
      if (!['hall', 'takeaway', 'delivery'].includes(p.mode)) {
        return json({ ok: false, error: 'Invalid order mode.' }, 400);
      }

      const idempotencyKey = normalizeIdempotencyKey(p.idempotencyKey);
      if (!idempotencyKey) {
        return json({ ok: false, error: 'Missing idempotency key.' }, 400);
      }

      const existing = await findByIdempotency(db, idempotencyKey);
      if (existing) return json({ ok: true, duplicate: true, order: rowOrder(existing) }, 200);

      const fields = {
        table: String(p.table || '').slice(0, 30),
        name: String(p.name || '').slice(0, 100),
        phone: String(p.phone || '').slice(0, 30),
        address: String(p.address || '').slice(0, 300),
        notes: String(p.notes || '').slice(0, 500),
        waiter: String(p.waiter || '').slice(0, 100)
      };

      let menu;
      try {
        menu = await loadMenu(context);
      } catch (e) {
        return json({ ok: false, error: e instanceof Error ? e.message : 'Unable to load menu for price verification.' }, 503);
      }

      // الموظفين (waiter.html) بيطلبوا للطاولات بمفتاحهم حتى لو الطلب الذاتي متوقف
      if (p.mode === 'hall' && !adminOK(request, env) && hallClosedNow(menu.settings)) {
        return json({ ok: false, code: 'hall_closed', error: 'الطلب من الطاولة متوقف حالياً — يرجى الطلب عند الكاشير.' }, 403);
      }

      if (p.mode === 'hall') {
        try {
          fields.table = verifyTable(p.table, menu);
        } catch (e) {
          return json({ ok: false, error: e.message }, 400);
        }
      } else {
        fields.table = '';
      }

      let verified;
      try {
        verified = verifyOrderItems(p.items, menu, p.mode);
      } catch (e) {
        return json({ ok: false, error: e instanceof Error ? e.message : 'Unable to verify order.' }, 400);
      }

      const trusted = adminOK(request, env);
      const ip = request.headers.get('CF-Connecting-IP') || '';

      if (!trusted) {
        try {
          await verifyTurnstile(p.turnstileToken, ip, env);
        } catch (e) {
          return json({ ok: false, error: e instanceof Error ? e.message : 'Bot verification failed.' }, 403);
        }
        if (await rateLimited(db, ip)) {
          return json({ ok: false, error: 'في طلبات كثيرة من نفس الجهاز خلال وقت قصير، جرب بعد شوي.' }, 429);
        }
      }

      // Allocate a number from a dedicated atomic counter. A failed request
      // can leave a harmless gap, but two concurrent orders cannot get the same number.
      const number = await nextOrderNumber(db);
      const now = new Date().toISOString();
      const id = `olv-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;

      try {
        await db.prepare(
          `INSERT INTO orders
           (id, number, idempotency_key, status, mode, table_no, name, phone, address, notes, waiter, ip, total, items_json, text_summary, created_at, updated_at, loyalty_awarded)
           VALUES (?1, ?2, ?3, 'new', ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?15, 0)`
        ).bind(
          id, number, idempotencyKey, p.mode, fields.table, fields.name, fields.phone,
          fields.address, fields.notes, fields.waiter, ip, verified.total,
          JSON.stringify(verified.items), verified.text, now
        ).run();
      } catch (e) {
        // A second identical request can race the first one. The unique
        // idempotency_key constraint makes the loser return the first order.
        const duplicate = await findByIdempotency(db, idempotencyKey);
        if (duplicate) return json({ ok: true, duplicate: true, order: rowOrder(duplicate) }, 200);
        throw e;
      }

      const created = await findById(db, id);
      return json({ ok: true, order: rowOrder(created) }, 201);
    }

    if (request.method === 'PATCH') {
      if (!adminOK(request, env)) return json({ ok: false, error: 'Admin access required.' }, 403);

      const p = await request.json();
      const allowed = ['new', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled'];
      if (!p?.id || !allowed.includes(p.status)) return json({ ok: false, error: 'Invalid status update.' }, 400);

      const current = await findById(db, p.id);
      if (!current) return json({ ok: false, error: 'Order not found' }, 404);

      const transitions = {
        new: ['confirmed', 'cancelled'],
        confirmed: ['preparing', 'cancelled'],
        preparing: ['ready', 'cancelled'],
        ready: ['completed', 'cancelled'],
        completed: [],
        cancelled: []
      };

      if (p.status !== current.status && !transitions[current.status].includes(p.status)) {
        return json({ ok: false, error: `لا يمكن تغيير الطلب من "${current.status}" إلى "${p.status}".` }, 409);
      }

      const now = new Date().toISOString();

      if (p.status === 'completed' && current.status !== 'completed') {
        // Conditional update makes concurrent completion requests mutually exclusive.
        const result = await db.prepare(
          `UPDATE orders
           SET status = 'completed', updated_at = ?1
           WHERE id = ?2 AND status = ?3 AND loyalty_awarded = 0`
        ).bind(now, p.id, current.status).run();

        if (!result.meta?.changes) {
          const latest = await findById(db, p.id);
          return latest ? json({ ok: true, duplicate: true, order: rowOrder(latest) }) : json({ ok: false, error: 'Order not found' }, 404);
        }

        const completed = await findById(db, p.id);
        if (completed?.phone) {
          try {
            await awardPoints(db, completed.phone, completed.total, completed.id);
          } catch (e) {
            console.error(`Loyalty award failed for order #${completed.number}:`, e instanceof Error ? e.message : e);
          }
        }

        const latest = await findById(db, p.id);
        return json({ ok: true, order: rowOrder(latest) });
      }

      await db.prepare(
        'UPDATE orders SET status = ?1, updated_at = ?2 WHERE id = ?3'
      ).bind(p.status, now, p.id).run();

      const latest = await findById(db, p.id);
      return json({ ok: true, order: rowOrder(latest) });
    }

    return json({ ok: false, error: 'Method not allowed' }, 405);
  } catch (e) {
    console.error('orders.js:', e);
    return json({ ok: false, error: e instanceof Error ? e.message : 'Server error' }, 500);
  }
}
