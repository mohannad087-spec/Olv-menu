// تحديد عدد الطلبات (rate limit) بنافذة ثابتة دقيقة لكل IP، مخزّن بـ D1 (جدول rate_hits).
// كل زباين الكافيه على نفس الواي فاي بيطلعوا بنفس الـIP، فالحدود واسعة: هدفها سقف للإغراق مش تقنين الاستخدام العادي.
// إذا D1 مش مربوط أو صار خطأ بنسمح بالطلب (أفضل من إقفال المطعم).
const WINDOW_MS = 60 * 1000;

let tableReady = false;
async function ensureTable(db) {
  if (tableReady) return;
  await db.prepare('CREATE TABLE IF NOT EXISTS rate_hits (k TEXT NOT NULL, win INTEGER NOT NULL, n INTEGER NOT NULL, PRIMARY KEY (k, win))').run();
  tableReady = true;
}

// بيرجّع { limited, retryAfter }
export async function hit(db, bucket, ip, max) {
  if (!db || !ip) return { limited: false, retryAfter: 0 };
  try {
    await ensureTable(db);
    const now = Date.now();
    const win = Math.floor(now / WINDOW_MS);
    const row = await db.prepare(
      'INSERT INTO rate_hits (k, win, n) VALUES (?1, ?2, 1) ON CONFLICT (k, win) DO UPDATE SET n = n + 1 RETURNING n'
    ).bind(`${bucket}:${ip}`, win).first();
    if (Number(row?.n || 0) > max) return { limited: true, retryAfter: Math.max(1, Math.ceil(((win + 1) * WINDOW_MS - now) / 1000)) };
    if (Math.random() < 0.02) await db.prepare('DELETE FROM rate_hits WHERE win < ?1').bind(win - 5).run();
  } catch { /* الحد أقل أهمية من الرد */ }
  return { limited: false, retryAfter: 0 };
}

// الحدود بالدقيقة لكل IP. طلبات الموظفين/الإدارة (معها مفتاح) مستثناة: لها قفل التخمين بـ keys.js.
export function bucketFor(method, pathname, hasKey) {
  if (pathname === '/_go') return { bucket: 'go', max: 30 };
  if (!pathname.startsWith('/api/') || hasKey) return null;
  if (pathname === '/api/orders') {
    return method === 'POST' ? { bucket: 'order-post', max: 10 } : { bucket: 'order-get', max: 300 };
  }
  if (pathname === '/api/loyalty') return { bucket: 'loyalty', max: 20 };
  if (pathname === '/api/rate-order') return { bucket: 'rate', max: 10 };
  return { bucket: 'api', max: 60 };
}
