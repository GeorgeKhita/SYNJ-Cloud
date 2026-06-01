CREATE TABLE IF NOT EXISTS products (
  id             INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,
  name           VARCHAR(100)    NOT NULL,
  slug           VARCHAR(100)    NOT NULL UNIQUE,
  type           ENUM('vpn','vps','nas') NOT NULL,
  description    TEXT,
  base_price     DECIMAL(10,2) UNSIGNED NOT NULL DEFAULT 0.00,
  pricing_config JSON            NOT NULL,
  resource_config JSON           NOT NULL,
  template_id    INT UNSIGNED,
  status         ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_at     TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP       DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
