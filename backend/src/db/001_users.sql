CREATE TABLE IF NOT EXISTS users (
  id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  wordpress_id        INT UNSIGNED,
  email               VARCHAR(255) NOT NULL,
  first_name          VARCHAR(100),
  last_name           VARCHAR(100),
  phone               VARCHAR(20),
  stripe_customer_id  VARCHAR(255),
  role                ENUM('client','tech','admin') DEFAULT 'client',
  status              ENUM('active','suspended','deleted') DEFAULT 'active',
  created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uq_wordpress_id     (wordpress_id),
  UNIQUE KEY uq_email            (email),
  UNIQUE KEY uq_stripe_customer  (stripe_customer_id)
);
