import * as serviceRepo from '../repositories/service.repository.js';
import * as proxmox     from '../services/proxmox.service.js';
import * as mail        from '../utils/mail.js';
import logger from '../utils/logger.js';

const DAY_MS = 24 * 60 * 60 * 1000;

async function deleteExpiredServices() {
  const services = await serviceRepo.findExpired();
  if (!services.length) return;

  logger.info({ count: services.length }, 'cleanup:delete_start');

  for (const svc of services) {
    try {
      await proxmox.stopContainer(svc.node_name, svc.vm_id);
      await new Promise(r => setTimeout(r, 3000));
      await proxmox.deleteContainer(svc.node_name, svc.vm_id);
    } catch (err) {
      logger.warn({ err: err.message, vmId: svc.vm_id }, 'cleanup:proxmox_error');
    }

    await serviceRepo.markDeleted(svc.id);
    await mail.sendServiceDeletedEmail(svc.customer_email, svc.customer_name);
    logger.info({ serviceId: svc.id, vmId: svc.vm_id }, 'cleanup:deleted');
  }
}

async function sendReminders() {
  for (const daysLeft of [7, 3]) {
    const services = await serviceRepo.findExpiringSoon(daysLeft);
    for (const svc of services) {
      await mail.sendReminderEmail(svc.customer_email, svc.customer_name, daysLeft);
      logger.info({ serviceId: svc.id, daysLeft }, 'cleanup:reminder_sent');
    }
  }
}

async function runCleanup() {
  logger.info('cleanup:run');
  try {
    await Promise.all([deleteExpiredServices(), sendReminders()]);
  } catch (err) {
    logger.error({ err: err.message }, 'cleanup:error');
  }
}

export function startCleanupCron() {
  runCleanup();
  setInterval(runCleanup, DAY_MS);
  logger.info('cleanup:cron_started');
}
