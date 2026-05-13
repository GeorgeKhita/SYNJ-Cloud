const authService = require('../services/auth.service');

async function wordpressSync(req, res) {
  const { wordpressId, email } = req.body;

  if (!wordpressId || !email) {
    return res.status(400).json({ error: 'wordpressId et email requis' });
  }

  const wpSecret = req.headers['x-wp-secret'];
  if (wpSecret !== process.env.WORDPRESS_SECRET) {
    return res.status(401).json({ error: 'Secret WordPress invalide' });
  }

  const user = await authService.syncWordPressUser({
    wordpressId: wordpressId,
    email: email
  });

  if (!user) {
    return res.status(500).json({ error: 'Erreur synchronisation utilisateur' });
  }

  const tokens = authService.generateTokens(user.id, user.email);

  res.json({
    userId: user.id,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken
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

module.exports = { wordpressSync, refresh };