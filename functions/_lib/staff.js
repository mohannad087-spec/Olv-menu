// حسابات الموظفين: كل موظف إله اسم ورمز (PIN) بيحطهم صاحب المطعم من صفحة الإدارة.
// الرمز ما بينخزن، بنخزن PBKDF2 مع salt خاص بكل موظف.
// جهاز الموظف بيبعت بالهيدر x-olv-staff-key القيمة "staff:<id>:<pin>".
const enc = new TextEncoder();

function hex(buf) {
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function newSalt() {
  return hex(crypto.getRandomValues(new Uint8Array(16)));
}

export async function hashPin(pin, salt) {
  const key = await crypto.subtle.importKey('raw', enc.encode(String(pin)), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations: 100000 }, key, 256);
  return hex(bits);
}

export function validPin(pin) {
  return /^\d{4,8}$/.test(String(pin || ''));
}

export function cleanName(name) {
  return String(name || '').replace(/\s+/g, ' ').trim().slice(0, 40);
}

function sameHex(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// بيرجّع {id, name} إذا الموظف موجود ومفعّل والرمز صح، وإلا null
export async function verifyStaff(db, id, pin) {
  if (!db || !validPin(pin)) return null;
  const row = await db.prepare('SELECT id, name, pin_salt, pin_hash FROM staff WHERE id = ?1 AND active = 1').bind(Number(id)).first();
  if (!row) return null;
  return sameHex(await hashPin(pin, row.pin_salt), row.pin_hash) ? { id: row.id, name: row.name, pinHash: row.pin_hash } : null;
}

// "staff:<id>:<pin>" => {id, pin}
export function parseStaffToken(s) {
  const m = /^staff:(\d{1,9}):(\d{4,8})$/.exec(String(s || ''));
  return m ? { id: Number(m[1]), pin: m[2] } : null;
}

// رمز دخول موقّع (HMAC) بدل ما الجهاز يبعت الـPIN مع كل طلب: التحقق من PIN بـ PBKDF2 (100 ألف دورة) ثقيل على المعالج،
// وصفحة الويتر بتسأل السيرفر كل 4 ثواني، فكان Cloudflare يرجّع "Worker exceeded resource limits" والويتر ما بيوصله شي.
// الدخول (PBKDF2) بيصير مرة وحدة، وبعدها كل طلب بيتحقق بـ HMAC رخيص + قراءة وحدة من D1.
// الشكل: staff:<id>:v1.<انتهاء بالثواني>.<hmac>. تغيير PIN الموظف أو إيقافه بيبطّل رمزه لأن التوقيع فيه جزء من hash الـPIN.
const TOKEN_DAYS = 90;
const hmacKey = (secret) => crypto.subtle.importKey('raw', enc.encode(String(secret)), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
async function tokenSig(secret, id, exp, pinHash) {
  return hex(await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(`olv-staff|${id}|${exp}|${String(pinHash).slice(0, 16)}`)));
}

export async function signStaffToken(secret, id, pinHash) {
  if (!secret) return '';
  const exp = Math.floor(Date.now() / 1000) + TOKEN_DAYS * 86400;
  return `staff:${id}:v1.${exp}.${await tokenSig(secret, id, exp, pinHash)}`;
}

export function parseSignedToken(s) {
  const m = /^staff:(\d{1,9}):v1\.(\d{9,12})\.([0-9a-f]{64})$/.exec(String(s || ''));
  return m ? { id: Number(m[1]), exp: Number(m[2]), sig: m[3] } : null;
}

export async function verifySignedStaff(db, secret, tok) {
  if (!db || !secret || !tok || tok.exp < Date.now() / 1000) return null;
  const row = await db.prepare('SELECT id, name, pin_hash FROM staff WHERE id = ?1 AND active = 1').bind(tok.id).first();
  if (!row) return null;
  return sameHex(await tokenSig(secret, tok.id, tok.exp, row.pin_hash), tok.sig) ? { id: row.id, name: row.name } : null;
}
