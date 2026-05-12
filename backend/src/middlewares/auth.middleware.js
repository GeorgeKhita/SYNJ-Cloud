const jwt = require('jsonwebtoken');
const authConfig = require('../config/auth.config');

function verifyToken(req, res, next) {
  const header = req.headers['authorization'];

  if (!header) {
    return res.status(401).json({ error: 'Token manquant' });
  }

  const token = header.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Format token invalide' });
  }

  try {
    const decoded = jwt.verify(token, authConfig.jwt_secret);
    req.user = {
      userId: decoded.userId,
      email: decoded.email
    };
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expiré' });
    }
    return res.status(401).json({ error: 'Token invalide' });
  }
}

function verifyAdmin(req, res, next) {
  // À compléter plus tard quand on aura le panneau admin
  // Pour l'instant on vérifie juste le token
  verifyToken(req, res, () => {
    // TODO: vérifier req.user.role === 'admin'
    next();
  });
}

module.exports = { verifyToken, verifyAdmin };