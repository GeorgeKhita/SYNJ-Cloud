const { proxmoxApi } = require('proxmox-api');
require('dotenv').config();

// Éviter NODE_TLS_REJECT_UNAUTHORIZED = "0" en prod si possible 
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const proxmox = proxmoxApi({
    host: process.env.PROXMOX_HOST,
    tokenID: process.env.PROXMOX_TOKEN_ID,
    tokenSecret: process.env.PROXMOX_TOKEN_SECRET,
    allowInsecure: true
});

module.exports = proxmox;