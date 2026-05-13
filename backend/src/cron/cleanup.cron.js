const cron = require('node-cron');
const serviceRepo = require('../services/service.repository');
const userRepo = require('../services/user.repository');
const proxmoxClient = require('../proxmox/proxmox.client');
const mail = require('../mail/mail.service');

// Tous les jours à 2h du matin
cron.schedule('0 2 * * *', async () => {
  console.log('=== CRON CLEANUP — Vérification services expirés ===');

  // 1. Supprimer les services dont le délai de 14 jours est dépassé
  const expiredServices = await serviceRepo.findExpiredServices();

  for (const service of expiredServices) {
    console.log('Suppression CT', service.vm_id, 'sur', service.node_name);

    await proxmoxClient.stopContainer(service.node_name, service.vm_id);
    await new Promise(resolve => setTimeout(resolve, 5000));
    await proxmoxClient.deleteContainer(service.node_name, service.vm_id);

    await serviceRepo.deleteService(service.id);

    const user = await userRepo.findUserById(service.user_id);
    if (user) {
      await mail.sendServiceDeletedEmail(user.email, user.first_name);
    }

    console.log('Service', service.id, 'supprimé définitivement');
  }

  // 2. Envoyer les rappels J-7
  const soonExpiring = await serviceRepo.findServicesExpiringSoon(7);

  for (const service of soonExpiring) {
    const user = await userRepo.findUserById(service.user_id);
    if (user) {
      await mail.sendReminderEmail(user.email, user.first_name, 7);
    }
  }

  console.log('=== CRON CLEANUP terminé ===');
});

console.log('Cron cleanup programmé — tous les jours à 2h');