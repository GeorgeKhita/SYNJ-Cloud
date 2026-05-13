require('dotenv').config();

const { sendAccessEmail } = require('./mail/mail.service');

async function testEmail() {
  console.log('=== TEST ENVOI EMAIL ===');

  const fakeAccessInfo = {
    ip: '192.168.1.100',
    port: '443',
    username: 'root',
    password: 'TempPass123!'
  };

  const fakePaymentData = {
    productId: 'vpn',
    ram: 2,
    cpu: 2,
    storage: 0
  };

  // Remplace par ton adresse email personnelle
  const result = await sendAccessEmail('delhemamine@gmail.com', fakeAccessInfo, fakePaymentData);

  console.log('Résultat:', result ? 'OK — vérifie ta boîte mail !' : 'ECHEC');
  process.exit(0);
}

testEmail();