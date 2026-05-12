const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const authConfig = require('../config/auth.config');
const userRepo = require('./user.repository');

async function register(userData) {
  const existing = await userRepo.findUserByEmail(userData.email);
  if (existing) {
    return { error: 'Email déjà utilisé' };
  }

  const hashedPassword = await bcrypt.hash(userData.password, 10);

  const userId = await userRepo.createUser({
    email: userData.email,
    password: hashedPassword,
    firstName: userData.firstName,
    lastName: userData.lastName
  });

  if (!userId) {
    return { error: 'Erreur lors de la création du compte' };
  }

  const tokens = generateTokens(userId, userData.email);

  return {
    success: true,
    userId: userId,
    ...tokens
  };
}

async function login(email, password) {
  const user = await userRepo.findUserByEmail(email);
  if (!user) {
    return { error: 'Email ou mot de passe incorrect' };
  }

  if (user.status !== 'active') {
    return { error: 'Compte désactivé' };
  }

  const validPassword = await bcrypt.compare(password, user.password);
  if (!validPassword) {
    return { error: 'Email ou mot de passe incorrect' };
  }

  const tokens = generateTokens(user.id, user.email);

  return {
    success: true,
    userId: user.id,
    ...tokens
  };
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

  return { accessToken: accessToken, refreshToken: refreshToken };
}

module.exports = { register, login, refreshAccessToken };