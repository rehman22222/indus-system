import assert from 'node:assert/strict';
import test from 'node:test';

import { hashPassword, verifyPassword } from '../services/password.service.js';

test('password service hashes and verifies credentials', async () => {
    const password = 'CorrectHorseBatteryStaple123';
    const hash = await hashPassword(password);

    assert.match(hash, /^scrypt:[a-f0-9]+:[a-f0-9]+$/);
    assert.equal(await verifyPassword(password, hash), true);
    assert.equal(await verifyPassword('wrong-password', hash), false);
    assert.equal(await verifyPassword(password, 'legacy-or-invalid-hash'), false);
});
