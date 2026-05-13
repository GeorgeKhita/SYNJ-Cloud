// require('dotenv').config();

// // --- Test 1 : Encryption ---
// console.log('=== TEST ENCRYPTION ===');
// const { encrypt, decrypt } = require('./utils/encryption');

// const original = '192.168.1.100';
// const encrypted = encrypt(original);
// const decrypted = decrypt(encrypted);

// console.log('Original:', original);
// console.log('Chiffré:', encrypted);
// console.log('Déchiffré:', decrypted);
// console.log('Test encryption:', original === decrypted ? 'OK' : 'ECHEC');

// --- Test 2 : saveService (MySQL) ---
async function testSaveService() {
  console.log('\n=== TEST SAVE SERVICE ===');
  const { saveService } = require('./services/service.repository');

  const fakeService = {
    orderId: 'TEST-001',
    customerEmail: 'test@synj.fr',
    productId: 'vpn',
    node: 'proxmox',
    vmId: 9999,
    ip: '192.168.1.100',
    port: '443',
    username: 'root',
    password: 'motdepasse123',
    ram: 2,
    cpu: 2,
    storage: 0
  };

  const serviceId = await saveService(fakeService);

  if (serviceId) {
    console.log('Service enregistré avec ID:', serviceId);
    console.log('Test saveService: OK');
  } else {
    console.log('Test saveService: ECHEC');
  }

  process.exit(0);
}

testSaveService();