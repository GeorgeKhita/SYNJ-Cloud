import * as authService from '../services/auth.service.js';
import * as userRepo from '../repositories/user.repository.js';

export async function wordpressLogin(req, res) {
  const { accessToken, refreshToken, user } = await authService.loginFromWordpress(req.body);
  res.json({ accessToken, refreshToken, user });
}

export async function refresh(req, res) {
  const { refreshToken } = req.body;
  const tokens = await authService.refreshTokens(refreshToken);
  res.json(tokens);
}

export async function logout(req, res) {
  await authService.logout(req.user.sub);
  res.json({ message: 'Déconnecté' });
}

export async function logoutFromWordpress(req, res) {
  await authService.logoutFromWordpress(req.body);
  res.json({ message: 'Déconnecté' });
}

export async function me(req, res) {
  const user = await userRepo.findById(req.user.sub);
  res.json({ user });
}
