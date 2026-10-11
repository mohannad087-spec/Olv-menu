import { checkKey, lockedOut, recordFailure } from '../_lib/keys.js';
import { newSalt, hashPin, validPin, cleanName, verifyStaff } from '../_lib/staff.js';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
}

// /api/staff
//   POST {action:'login', name, pin}        => دخول الموظف، بيرجّع {id, name}
//   GET                      (مفتاح الإدارة) => قائمة الموظفين
//   POST {name, pin}         (مفتاح الإدارة) => إضافة موظف
//   PATCH {id, active?, pin?, name?} (الإدارة) => تفعيل/إيقاف، رمز جديد، تغيير الاسم
//   DELETE ?id=              (مفتاح الإدارة) => حذف
export async function onRequest(context) {
  const { request, env } = context;
  const db = env.OLV_DB || null;
  if (!db) return json({ ok: false, error: 'OLV_DB D1 binding is not configured in Cloudflare Pages.' }, 503);

  try {
    let body = null;
    if (request.method === 'POST' || request.method === 'PATCH') {
      try { body = await request.json(); } catch { return json({ ok: false, error: 'Invalid JSON body.' }, 400); }
    }

    if (request.method === 'POST' && body?.action === 'login') {
      const ip = request.headers.get('CF-Connecting-IP') || '';
      if (await lockedOut(db, ip)) return json({ ok: false, error: 'محاولات كثيرة، جرّب بعد ربع ساعة.' }, 429);
      const name = cleanName(body.name);
      const row = name ? await db.prepare('SELECT id FROM staff WHERE name = ?1 AND active = 1').bind(name).first() : null;
      const member = row ? await verifyStaff(db, row.id, String(body.pin || '')) : null;
      if (!member) {
        await recordFailure(db, ip, 'login:' + name + ':' + String(body.pin || ''));
        return json({ ok: false, error: 'الاسم أو الرمز غلط.' }, 403);
      }
      await db.prepare('UPDATE staff SET last_login_at = ?1 WHERE id = ?2').bind(new Date().toISOString(), member.id).run();
      return json({ ok: true, staff: member });
    }

    const auth = await checkKey(request, env);
    if (!auth.ok) return json({ ok: false, error: 'مفتاح الإدارة مطلوب.' }, auth.status || 403);

    if (request.method === 'GET') {
      const r = await db.prepare('SELECT id, name, active, created_at, last_login_at FROM staff ORDER BY name').all();
      return json({ ok: true, staff: (r.results || []).map((x) => ({ id: x.id, name: x.name, active: !!x.active, createdAt: x.created_at, lastLoginAt: x.last_login_at })) });
    }

    if (request.method === 'POST') {
      const name = cleanName(body?.name);
      if (!name) return json({ ok: false, error: 'اكتب اسم الموظف.' }, 400);
      if (!validPin(body?.pin)) return json({ ok: false, error: 'الرمز لازم يكون من 4 لـ 8 أرقام.' }, 400);
      const salt = newSalt();
      try {
        const r = await db.prepare('INSERT INTO staff (name, pin_salt, pin_hash, active, created_at) VALUES (?1, ?2, ?3, 1, ?4)')
          .bind(name, salt, await hashPin(body.pin, salt), new Date().toISOString()).run();
        return json({ ok: true, id: r.meta?.last_row_id });
      } catch (e) {
        if (/UNIQUE/i.test(String(e?.message || e))) return json({ ok: false, error: 'في موظف بنفس الاسم.' }, 409);
        throw e;
      }
    }

    if (request.method === 'PATCH') {
      const id = Number(body?.id);
      if (!id) return json({ ok: false, error: 'Missing id.' }, 400);
      if (typeof body.active === 'boolean') {
        await db.prepare('UPDATE staff SET active = ?1 WHERE id = ?2').bind(body.active ? 1 : 0, id).run();
      }
      if (body.pin != null) {
        if (!validPin(body.pin)) return json({ ok: false, error: 'الرمز لازم يكون من 4 لـ 8 أرقام.' }, 400);
        const salt = newSalt();
        await db.prepare('UPDATE staff SET pin_salt = ?1, pin_hash = ?2 WHERE id = ?3').bind(salt, await hashPin(body.pin, salt), id).run();
      }
      if (body.name != null) {
        const name = cleanName(body.name);
        if (!name) return json({ ok: false, error: 'اكتب اسم الموظف.' }, 400);
        try {
          await db.prepare('UPDATE staff SET name = ?1 WHERE id = ?2').bind(name, id).run();
        } catch (e) {
          if (/UNIQUE/i.test(String(e?.message || e))) return json({ ok: false, error: 'في موظف بنفس الاسم.' }, 409);
          throw e;
        }
      }
      return json({ ok: true });
    }

    if (request.method === 'DELETE') {
      const id = Number(new URL(request.url).searchParams.get('id'));
      if (!id) return json({ ok: false, error: 'Missing id.' }, 400);
      await db.prepare('DELETE FROM staff WHERE id = ?1').bind(id).run();
      return json({ ok: true });
    }

    return json({ ok: false, error: 'Method not allowed' }, 405);
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : 'Server error' }, 500);
  }
}
