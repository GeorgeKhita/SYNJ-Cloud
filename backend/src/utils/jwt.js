import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export function signAccess(payload) {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: '15m' });
}

export function signRefresh(payload) {
  return jwt.sign(payload, env.REFRESH_SECRET, { expiresIn: '7d' });
}

export function verifyAccess(token) {
  return jwt.verify(token, env.JWT_SECRET);
}

export function verifyRefresh(token) {
  return jwt.verify(token, env.REFRESH_SECRET);
}
