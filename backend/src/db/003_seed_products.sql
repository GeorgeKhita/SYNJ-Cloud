INSERT INTO products (name, slug, type, description, base_price, pricing_config, resource_config) VALUES

-- VPS : configurez CPU, RAM et stockage
('VPS', 'vps', 'vps',
 'Serveur privé virtuel — configurez CPU, RAM et stockage selon vos besoins.',
 12.00,
 '{"cpu": 3.00, "ram_gb": 3.00, "storage_gb": 0.02}',
 '{"cpu":{"min":1,"max":8,"step":1,"label":"CPU"},"ram_gb":{"min":2,"max":32,"step":1,"label":"RAM (Go)"},"storage_gb":{"min":20,"max":500,"step":20,"label":"Stockage (Go)"}}'),

-- VPN : configurez le serveur et le nombre de connexions simultanées
('VPN', 'vpn', 'vpn',
 'Serveur VPN privé — configurez les ressources du serveur et le nombre de connexions simultanées.',
 8.00,
 '{"cpu": 3.00, "ram_gb": 3.00, "storage_gb": 0.02, "connections": 1.50}',
 '{"cpu":{"min":1,"max":4,"step":1,"label":"CPU"},"ram_gb":{"min":2,"max":8,"step":1,"label":"RAM (Go)"},"storage_gb":{"min":10,"max":100,"step":10,"label":"Stockage (Go)"},"connections":{"min":1,"max":10,"step":1,"label":"Connexions simultanées"}}'),

-- NAS : stockage réseau avec CPU, RAM et stockage configurables
('NAS', 'nas', 'nas',
 'Stockage réseau — configurez CPU, RAM et stockage selon vos besoins.',
 28.00,
 '{"cpu": 3.00, "ram_gb": 2.00, "storage_gb": 0.02}',
 '{"cpu":{"min":1,"max":4,"step":1,"label":"CPU"},"ram_gb":{"min":2,"max":8,"step":1,"label":"RAM (Go)"},"storage_gb":{"min":200,"max":5000,"step":200,"label":"Stockage (Go)"}}');
