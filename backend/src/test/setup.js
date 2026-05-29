process.env.NODE_ENV = 'test';

// Auth
process.env.JWT_SECRET       = 'test_jwt_secret_minimum_32chars_ok!';
process.env.REFRESH_SECRET   = 'test_refresh_secret_32chars_min_!';
process.env.WORDPRESS_SECRET = 'test_wordpress_secret_32chars_ok!';
process.env.ENCRYPTION_KEY   = 'test_encryption_key_32chars_ok!!';

// DB (non utilisé en tests unitaires — moqué)
process.env.DB_HOST     = 'localhost';
process.env.DB_NAME     = 'synj_test';
process.env.DB_USER     = 'test';
process.env.DB_PASSWORD = 'test';

// Redis (moqué)
process.env.REDIS_HOST = '127.0.0.1';
process.env.REDIS_PORT = '6379';

// Stripe (moqué)
process.env.STRIPE_SECRET_KEY     = 'sk_test_placeholder';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_placeholder';

// Mail (moqué)
process.env.SMTP_HOST = 'smtp.test.local';
process.env.SMTP_PORT = '465';
process.env.SMTP_USER = 'noreply@test.local';
process.env.SMTP_PASS = 'test';

// Proxmox (moqué)
process.env.PROXMOX_URL          = 'https://192.168.1.1:8006/api2/json';
process.env.PROXMOX_TOKEN_ID     = 'test@pve!test';
process.env.PROXMOX_SECRET       = 'test-secret';
process.env.PROXMOX_DEFAULT_NODE = 'proxmox';
process.env.PROXMOX_SSH_HOST     = '192.168.1.1';
process.env.PROXMOX_SSH_USER     = 'root';
process.env.PROXMOX_SSH_KEY      = '/tmp/test_key';

process.env.FRONTEND_URL = 'http://localhost:3001';
