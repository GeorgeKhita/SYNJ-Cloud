module.exports = {
  jwt_secret: process.env.JWT_SECRET,
  jwt_expiration: '15m',
  refresh_secret: process.env.REFRESH_SECRET,
  refresh_expiration: '7d'
};