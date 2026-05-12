const authService = require('../services/auth.service');

async function register(req, res) {
  const { email, password, firstName, lastName, phone } = req.body;

  if (!email || !password || !firstName || !lastName) {
    return res.status(400).json({ error: 'Tous les champs sont requis' });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères' });
  }

  const result = await authService.register({ email, password, firstName, lastName, phone });

  if (result.error) {
    return res.status(400).json({ error: result.error });
  }

  res.status(201).json({
    message: 'Compte créé avec succès',
    userId: result.userId,
    accessToken: result.accessToken,
    refreshToken: result.refreshToken
  });
}

async function login(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email et mot de passe requis' });
  }

  const result = await authService.login(email, password);

  if (result.error) {
    return res.status(401).json({ error: result.error });
  }

  res.json({
    message: 'Connexion réussie',
    userId: result.userId,
    accessToken: result.accessToken,
    refreshToken: result.refreshToken
  });
}

async function refresh(req, res) {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({ error: 'Refresh token requis' });
  }

  const result = await authService.refreshAccessToken(refreshToken);

  if (result.error) {
    return res.status(401).json({ error: result.error });
  }

  res.json({ accessToken: result.accessToken });
}

module.exports = { register, login, refresh };