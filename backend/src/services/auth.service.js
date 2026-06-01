import crypto from 'crypto';
import redis from '../config/redis.js';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import { signAccess, signRefresh, verifyRefresh } from '../utils/jwt.js';
import * as userRepo from '../repositories/user.repository.js';
import logger from '../utils/logger.js';

const REPLAY_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const REFRESH_TTL_S    = 7 * 24 * 60 * 60; // 7 jours

function refreshKey(userId) {
  return `refresh:${userId}`;
}

export function verifyWordpressPayload(payload) {
  const { wordpress_id, email, first_name, timestamp, signature } = payload;

  if (!wordpress_id || !email || !first_name || !timestamp || !signature) {
    logger.warn({ wordpress_id, email }, 'auth:wp — payload incomplet');
    throw AppError.badRequest('Payload WordPress incomplet', 'WP_PAYLOAD_INVALID');
  }

  const age = Date.now() - timestamp;
  if (age < -5_000 || age > REPLAY_WINDOW_MS) { // -5s tolerance for clock drift
    logger.warn({ wordpress_id, email, ageMs: age }, 'auth:wp — token expiré');
    throw AppError.unauthorized('Token WordPress expiré', 'WP_TOKEN_EXPIRED');
  }

  const expected = crypto
    .createHmac('sha256', env.WORDPRESS_SECRET)
    .update(`${wordpress_id}:${email}:${timestamp}`)
    .digest('hex');

  const sigBuffer      = Buffer.from(signature, 'hex');
  const expectedBuffer = Buffer.from(expected, 'hex');

  if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
    logger.warn({ wordpress_id, email }, 'auth:wp — signature invalide');
    throw AppError.unauthorized('Signature WordPress invalide', 'WP_SIGNATURE_INVALID');
  }
}

export async function loginFromWordpress(payload) {
  verifyWordpressPayload(payload);

  const user = await userRepo.upsert(payload.wordpress_id, payload.email, payload.first_name, payload.last_name ?? '');

  const tokenPayload = { sub: user.id, email: user.email, role: user.role };
  const accessToken  = signAccess(tokenPayload);
  const refreshToken = signRefresh(tokenPayload);

  await redis.set(refreshKey(user.id), refreshToken, 'EX', REFRESH_TTL_S);

  logger.info({ userId: user.id, email: user.email, wordpressId: payload.wordpress_id }, 'auth:login');

  return { accessToken, refreshToken, user };
}

export async function refreshTokens(token) {
  let decoded;
  try {
    decoded = verifyRefresh(token);
  } catch {
    logger.warn('auth:refresh — token invalide ou expiré');
    throw AppError.unauthorized('Refresh token invalide', 'REFRESH_INVALID');
  }

  const stored = await redis.get(refreshKey(decoded.sub));
  if (!stored || stored !== token) {
    logger.warn({ userId: decoded.sub }, 'auth:refresh — token révoqué ou inconnu');
    throw AppError.unauthorized('Refresh token révoqué', 'REFRESH_REVOKED');
  }

  const user = await userRepo.findById(decoded.sub);
  if (!user) throw AppError.unauthorized('Utilisateur introuvable', 'USER_NOT_FOUND');

  const tokenPayload = { sub: user.id, email: user.email, role: user.role };
  const newAccess    = signAccess(tokenPayload);
  const newRefresh   = signRefresh(tokenPayload);

  await redis.set(refreshKey(user.id), newRefresh, 'EX', REFRESH_TTL_S);

  logger.info({ userId: user.id }, 'auth:refresh');

  return { accessToken: newAccess, refreshToken: newRefresh };
}

export async function logout(userId) {
  await redis.del(refreshKey(userId));
  logger.info({ userId }, 'auth:logout');
}

export async function logoutFromWordpress(payload) {
  verifyWordpressPayload(payload);

  const user = await userRepo.findByWordpressId(payload.wordpress_id);
  if (!user) return;

  await redis.del(refreshKey(user.id));
  logger.info({ userId: user.id, email: user.email, wordpressId: payload.wordpress_id }, 'auth:logout-wp');
}
