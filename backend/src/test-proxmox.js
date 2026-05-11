require('dotenv').config();

const { proxmoxRequest } = require('./proxmox/proxmox.client');

async function checkTemplate() {
  console.log('=== CONFIG TEMPLATE 900 ===');
  const config = await proxmoxRequest('get', '/nodes/proxmox/lxc/900/config');
  if (config) {
    console.log('OS:', config.ostype);
    console.log('RAM:', config.memory, 'Mo');
    console.log('CPU:', config.cores, 'coeurs');
    console.log('Réseau:', config.net0);
    console.log('Stockage:', config.rootfs);
  }

  console.log('\n=== CONFIG TEMPLATE 102 ===');
  const config2 = await proxmoxRequest('get', '/nodes/proxmox/lxc/102/config');
  if (config2) {
    console.log('OS:', config2.ostype);
    console.log('RAM:', config2.memory, 'Mo');
    console.log('CPU:', config2.cores, 'coeurs');
    console.log('Réseau:', config2.net0);
    console.log('Stockage:', config2.rootfs);
  }

  process.exit(0);
}

checkTemplate();