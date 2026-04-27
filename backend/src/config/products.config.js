const products = {
  vpn: {
    id: "vpn",
    name: "Serveur VPN",
    base_price: 8,
    base_resources: {
      ram: 1,
      cpu: 2,
      storage: 0
    },
    addons: {
      ram_price: 3,
      cpu_price: 3
    },
    options: {
      os: null
    }
  },
  vps: {
    id: "vps",
    name: "Serveur VPS Linux",
    base_price: 12,
    base_resources: {
      ram: 4,
      cpu: 1,
      storage: 0
    },
    addons: {
      ram_price: 3,
      cpu_price: 3,
      storage_price: 0.02
    },
    options: {
      os: ["ubuntu-cli", "ubuntu-desktop", "windows-server"]
    }
  },
  nas: {
    id: "nas",
    name: "Serveur NAS",
    base_price: 28,
    base_resources: {
      ram: 2,
      cpu: 2,
      storage: 100
    },
    addons: {
      ram_price: 3,
      cpu_price: 3,
      storage_price: 0.02
    },
    options: {
      os: null
    }
  }
};

module.exports = products;