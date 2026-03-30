const { proxmoxApi } = require('proxmox-api');

const required = ['PROXMOX_HOST', 'PROXMOX_TOKEN_ID', 'PROXMOX_TOKEN_SECRET'];
const missing = required.filter(key => !process.env[key]);
if (missing.length > 0) {
	console.error(`Missing required Proxmox env vars: ${missing.join(', ')}`);
	process.exit(1);
}


process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';


const proxmox = proxmoxApi({
	host: process.env.PROXMOX_HOST,
	tokenID: process.env.PROXMOX_TOKEN_ID,
	tokenSecret: process.env.PROXMOX_TOKEN_SECRET
});

module.exports = proxmox;