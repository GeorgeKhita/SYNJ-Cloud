CREATE TABLE IF NOT EXISTS services (
  id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  customer_email      VARCHAR(255)  NOT NULL,
  customer_name       VARCHAR(255)  NOT NULL,
  external_order_id   VARCHAR(100),
  product_type        ENUM('vps', 'vpn', 'nas') NOT NULL,
  node_name           VARCHAR(100)  NOT NULL,
  vm_id               INT UNSIGNED  NOT NULL DEFAULT 0,
  ip_address          VARCHAR(511),   -- chiffré AES-256
  port                VARCHAR(511),   -- chiffré AES-256
  username            VARCHAR(511),   -- chiffré AES-256
  password            VARCHAR(511),   -- chiffré AES-256
  ram_gb              INT UNSIGNED,
  cpu                 INT UNSIGNED,
  storage_gb          INT UNSIGNED,
  status              ENUM('provisioning','active','failed','suspended','pending_deletion','deleted') NOT NULL DEFAULT 'provisioning',
  error_msg           TEXT,           -- renseigné uniquement si status = 'failed'
  suspended_at        DATETIME,
  expires_at          DATETIME,       -- suspended_at + 14 jours, après = suppression
  created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email   (customer_email),
  INDEX idx_status  (status),
  INDEX idx_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
