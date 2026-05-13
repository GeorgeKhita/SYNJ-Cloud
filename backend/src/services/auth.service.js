const jwt = require('jsonwebtoken');
const authConfig = require('../config/auth.config');
const userRepo = require('./user.repository');

async function syncWordPressUser(wpUser) {
  let user = await userRepo.findUserByWordpressId(wpUser.wordpressId);

  if (!user) {
    user = await userRepo.findUserByEmail(wpUser.email);
  }

  if (!user) {
    const userId = await userRepo.createUser({
      wordpressId: wpUser.wordpressId,
      email: wpUser.email
    });
    user = await userRepo.findUserById(userId);
  }

  return user;
}

function generateTokens(userId, email) {
  const accessToken = jwt.sign(
    { userId: userId, email: email },
    authConfig.jwt_secret,
    { expiresIn: authConfig.jwt_expiration }
  );

  const refreshToken = jwt.sign(
    { userId: userId },
    authConfig.refresh_secret,
    { expiresIn: authConfig.refresh_expiration }
  );

  return { accessToken, refreshToken };
}

async function refreshAccessToken(refreshToken) {
  try {
    const decoded = jwt.verify(refreshToken, authConfig.refresh_secret);
    const user = await userRepo.findUserById(decoded.userId);

    if (!user || user.status !== 'active') {
      return { error: 'Utilisateur invalide' };
    }

    const accessToken = jwt.sign(
      { userId: user.id, email: user.email },
      authConfig.jwt_secret,
      { expiresIn: authConfig.jwt_expiration }
    );

    return { success: true, accessToken: accessToken };
  } catch (error) {
    return { error: 'Refresh token invalide ou expiré' };
  }
}

module.exports = { syncWordPressUser, generateTokens, refreshAccessToken };