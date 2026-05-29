import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';

// Mocks avant l'import du service
vi.mock('../config/redis.js', () => ({ default: { set: vi.fn(), get: vi.fn(), del: vi.fn() } }));
vi.mock('../repositories/user.repository.js', () => ({
  upsert:   vi.fn(),
  findById: vi.fn(),
}));

import { verifyWordpressPayload, loginFromWordpress, refreshTokens } from './auth.service.js';
import redis from '../config/redis.js';
import * as userRepo from '../repositories/user.repository.js';

const WP_SECRET = process.env.WORDPRESS_SECRET || 'test_wordpress_secret_32chars_ok!';

function makeValidPayload(overrides = {}) {
  const wordpress_id = 42;
  const email        = 'user@test.com';
  const first_name   = 'Test';
  const last_name    = 'User';
  const timestamp    = Date.now();
  const signature    = crypto
    .createHmac('sha256', WP_SECRET)
    .update(`${wordpress_id}:${email}:${timestamp}`)
    .digest('hex');

  return { wordpress_id, email, first_name, last_name, timestamp, signature, ...overrides };
}

describe('verifyWordpressPayload', () => {
  it('accepte un payload valide', () => {
    expect(() => verifyWordpressPayload(makeValidPayload())).not.toThrow();
  });

  it('rejette une mauvaise signature', () => {
    const payload = makeValidPayload({ signature: '0'.repeat(64) });
    expect(() => verifyWordpressPayload(payload)).toThrow('Signature WordPress invalide');
  });

  it('rejette un timestamp trop vieux', () => {
    const old = makeValidPayload({ timestamp: Date.now() - 10 * 60 * 1000 });
    expect(() => verifyWordpressPayload(old)).toThrow('Token WordPress expiré');
  });

  it('rejette un payload incomplet', () => {
    expect(() => verifyWordpressPayload({ wordpress_id: 1 })).toThrow('Payload WordPress incomplet');
  });
});

describe('loginFromWordpress', () => {
  beforeEach(() => vi.clearAllMocks());

  it('retourne les tokens et l\'utilisateur', async () => {
    const fakeUser = { id: 1, email: 'user@test.com', first_name: 'Test', last_name: 'User' };
    userRepo.upsert.mockResolvedValue(fakeUser);
    redis.set.mockResolvedValue('OK');

    const result = await loginFromWordpress(makeValidPayload());

    expect(result).toHaveProperty('accessToken');
    expect(result).toHaveProperty('refreshToken');
    expect(result.user).toEqual(fakeUser);
    expect(redis.set).toHaveBeenCalledWith('refresh:1', expect.any(String), 'EX', expect.any(Number));
  });
});
