// فحوصات أمان بسيطة: node scripts/security-test.mjs
import assert from 'node:assert/strict';
import { splitAddress } from '../functions/_lib/driver-link.js';
import { pageKey } from '../functions/_lib/gate.js';

// رابط تصيّد بعنوان الزبون ما بصير رابط خريطة للسائق
assert.equal(splitAddress('شارع 5 — https://evil.example/?q=1,2').mapUrl, '');
assert.equal(splitAddress('x https://evil.example/ — الموقع: https://www.google.com/maps?q=31.9,35.9').mapUrl, 'https://www.google.com/maps?q=31.9,35.9');
// % غلط بالمسار ما بيرمي خطأ
assert.equal(pageKey('/admin%zz'), 'admin%zz');
assert.equal(pageKey('/Admin.html'), 'admin');
console.log('security tests ok');
