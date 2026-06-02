import crypto from 'crypto';
import { NodeSSH } from 'node-ssh';
import * as proxmox     from './proxmox.service.js';
import * as serviceRepo from '../repositories/service.repository.js';
import * as reservation from './reservation.service.js';
import * as mail        from '../utils/mail.js';
import { env }    from '../config/env.js';
import logger     from '../utils/logger.js';

const CLONE_WAIT_MS    = 30_000;
const HEALTH_CHECK_MAX = 12;        // 12 × 5 s = 60 s max
const HEALTH_CHECK_MS  = 5_000;

function generatePassword(len = 16) {
  return crypto.randomBytes(len).toString('base64').slice(0, len);
}

async function waitForRunning(node, vmId) {
  for (let i = 0; i < HEALTH_CHECK_MAX; i++) {
    const status = await proxmox.getContainerStatus(node, vmId);
    if (status?.status === 'running') return true;
    await new Promise(r => setTimeout(r, HEALTH_CHECK_MS));
  }
  return false;
}

async function setContainerPassword(vmId, password) {
  const ssh = new NodeSSH();
  try {
    await ssh.connect({
      host:           env.PROXMOX_SSH_HOST,
      username:       env.PROXMOX_SSH_USER,
      privateKeyPath: env.PROXMOX_SSH_KEY,
    });
    await ssh.execCommand(`pct exec ${vmId} -- bash -c "echo 'root:${password}' | chpasswd"`);
  } finally {
    ssh.dispose();
  }
}

// Lance le provisioning en arrière-plan. Met à jour le statut du service en BDD
// (provisioning → active | failed) pour que WooCommerce puisse poller GET /provision/:id/status.
export async function provision(serviceId, { email, firstName, productType, templateId, resources, cartId, externalOrderId }) {
  const node     = env.PROXMOX_DEFAULT_NODE;
  const password = generatePassword();
  let vmId;

  try {
    vmId = await proxmox.getNextVmId();

    logger.info({ serviceId, vmId, productType, templateId }, 'provisioning:clone_start');

    await proxmox.cloneContainer(node, templateId, vmId);
    await new Promise(r => setTimeout(r, CLONE_WAIT_MS));

    await proxmox.configureContainer(node, vmId, {
      memory: (resources.ram_gb || 1) * 1024,
      cores:  resources.cpu || 1,
      net0:   'name=eth0,bridge=vmbr0,ip=dhcp',
    });

    await proxmox.startContainer(node, vmId);

    const running = await waitForRunning(node, vmId);
    if (!running) throw new Error(`CT ${vmId} non démarré après timeout`);

    logger.info({ serviceId, vmId }, 'provisioning:running');

    const ip       = await proxmox.getContainerIp(node, vmId) ?? 'en attente';
    const port     = productType === 'vps' ? '22' : '443';
    const username = productType === 'nas' ? 'admin' : 'root';

    await setContainerPassword(vmId, password);

    // Met à jour le service avec les infos d'accès et passe le statut à 'active'
    await serviceRepo.updateIp(serviceId, ip);
    await serviceRepo.updateStatus(serviceId, 'active');

    logger.info({ serviceId, vmId, ip }, 'provisioning:complete');

    // Libère la réservation panier si fournie
    if (cartId) await reservation.release(cartId).catch(() => {});

    // Email d'accès (best-effort — ne bloque pas si SMTP down)
    mail.sendAccessEmail(email, firstName, productType, { ip, port, username, password }, resources)
        .catch(err => logger.warn({ err: err.message, serviceId }, 'mail:access_failed'));

  } catch (err) {
    logger.error({ err: err.message, serviceId, vmId }, 'provisioning:failed');

    await serviceRepo.markFailed(serviceId, err.message);

    // Tente de nettoyer le CT orphelin si vmId a été obtenu (stop avant delete)
    if (vmId) {
      proxmox.stopContainer(node, vmId)
        .catch(() => {})
        .finally(() => proxmox.deleteContainer(node, vmId).catch(() => {}));
    }

    // Libère la réservation panier même en cas d'échec
    if (cartId) await reservation.release(cartId).catch(() => {});

    // Stripe géré côté WordPress (authorize-then-capture) — pas d'appel Stripe ici

    mail.sendProvisioningFailedEmail(email, firstName, productType, externalOrderId ?? serviceId)
        .catch(e => logger.warn({ err: e.message, serviceId }, 'mail:failed_email_failed'));
  }
}
