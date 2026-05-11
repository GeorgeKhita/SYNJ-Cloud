require('dotenv').config();

const { cloneContainer, configureContainer, startContainer, getContainerStatus, proxmoxRequest } = require('./proxmox/proxmox.client');

async function testDeploy() {
  const node = 'proxmox';
  const templateId = 900;

  // 1. Obtenir un VMID libre
  console.log('=== OBTENTION VMID ===');
  const newVmId = Number(await proxmoxRequest('get', '/cluster/nextid'));
  console.log('Nouveau VMID:', newVmId);
  if (!newVmId) return console.log('ECHEC: pas de VMID');

  // 2. Cloner le template
  console.log('\n=== CLONAGE ===');
  const clone = await cloneContainer(node, templateId, newVmId);
  console.log('Résultat clone:', clone);
  if (!clone) return console.log('ECHEC: clonage');

  // 3. Attendre que le clonage finisse
  console.log('Attente clonage (30s)...');
  await new Promise(r => setTimeout(r, 30000));

  // 4. Configurer le CT
  console.log('\n=== CONFIGURATION ===');
  const config = await configureContainer(node, newVmId, {
    memory: 1024,
    cores: 1,
    net0: 'name=eth0,bridge=vmbr0,ip=dhcp'
  });
  console.log('Résultat config:', config);

  // 5. Démarrer le CT
  console.log('\n=== DÉMARRAGE ===');
  const start = await startContainer(node, newVmId);
  console.log('Résultat start:', start);

  // 6. Health check
  console.log('\n=== HEALTH CHECK ===');
  for (let i = 0; i < 6; i++) {
    const status = await getContainerStatus(node, newVmId);
    console.log('Tentative', i + 1, ':', status ? status.status : 'pas de réponse');
    if (status && status.status === 'running') {
      console.log('\nSUCCÈS — CT', newVmId, 'est actif !');
      process.exit(0);
    }
    await new Promise(r => setTimeout(r, 5000));
  }

  console.log('ECHEC: CT non démarré après 30s');
  process.exit(1);
}

testDeploy();