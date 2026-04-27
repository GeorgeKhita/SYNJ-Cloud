module.exports = {
  vpn: {
    name: "Serveur VPN",
    basic_ram: 1, // En GigaOctets
    basic_cpu: 2,
    basic_storage: 0, // En GigaOctets
    basic_price : 8, // En Euros
    additional_ram : 3,
    additional_cpu : 3
  },
  vps: {
    name: "Serveur VPS",
    basic_ram: 4, 
    basic_cpu: 1,
    basic_storage: 0,
    basic_price : 12,
    additional_ram : 3,
    additional_cpu : 3,
    additional_storage : 0.4 // En Euros par tranche de 20 GigaOctets
  },
  nas: {
    name: "Serveur NAS",
    basic_ram: 2, 
    basic_cpu: 2,
    basic_storage: 100, 
    basic_price : 28,
    additional_ram : 3,
    additional_cpu : 3,
    additional_storage : 0.4 
  }
};