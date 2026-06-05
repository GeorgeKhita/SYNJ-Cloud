import crypto from 'crypto';
import { NodeSSH } from 'node-ssh';
import * as proxmox     from './proxmox.service.js';
import * as serviceRepo from '../repositories/service.repository.js';
import * as reservation from './reservation.service.js';
import * as mail        from '../utils/mail.js';
import { env }    from '../config/env.js';
import logger     from '../utils/logger.js';

const HEALTH_CHECK_MAX = 12;  // 12 × 5 s = 60 s max
const HEALTH_CHECK_MS  = 5_000;
const DHCP_WAIT_MAX_MS = 60_000;
const DHCP_WAIT_INT_MS = 3_000;

// CT template ID pour les VPS Ubuntu (CT 901 sur vmbr1, réseau SYNJ 10.10.10.0/24)
const VPS_UBUNTU_TEMPLATE_ID = 901;
const VPS_BRIDGE = 'vmbr1';

function generatePassword(len = 16) {
  return crypto.randomBytes(len).toString('base64').slice(0, len);
}

// Normalise une chaîne en slug sans accents, alphanum + tirets
function slugify(str) {
  return str
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 20);
}

// Format : vps-ubuntu-{slug-nom}-{N}
function buildHostname(lastName, count) {
  return `vps-ubuntu-${slugify(lastName)}-${count}`;
}

async function waitForRunning(node, vmId) {
  for (let i = 0; i < HEALTH_CHECK_MAX; i++) {
    const status = await proxmox.getContainerStatus(node, vmId);
    if (status?.status === 'running') return true;
    await new Promise(r => setTimeout(r, HEALTH_CHECK_MS));
  }
  return false;
}

// Interroge l'API Proxmox /interfaces jusqu'à obtenir l'IP DHCP sur eth0
async function waitForDhcpIp(node, vmId) {
  const deadline = Date.now() + DHCP_WAIT_MAX_MS;
  while (Date.now() < deadline) {
    try {
      const ifaces = await proxmox.getContainerInterfaces(node, vmId);
      if (Array.isArray(ifaces)) {
        const eth0 = ifaces.find(i => i.name === 'eth0');
        if (eth0?.inet) return eth0.inet.split('/')[0];
      }
    } catch {
      // CT pas encore prêt à répondre
    }
    await new Promise(r => setTimeout(r, DHCP_WAIT_INT_MS));
  }
  throw new Error(`CT ${vmId} : IP DHCP non obtenue après ${DHCP_WAIT_MAX_MS / 1000}s`);
}

// Renomme l'utilisateur admin → username, change le mdp et le hostname dans le CT
// Les entrées sont validées en amont (Zod regex) — pas de risque d'injection
async function configureVpsUser(vmId, username, password, hostname) {
  const ssh = new NodeSSH();
  try {
    await ssh.connect({
      host:           env.PROXMOX_SSH_HOST,
      username:       env.PROXMOX_SSH_USER,
      privateKeyPath: env.PROXMOX_SSH_KEY,
    });

    const cmds = [
      `pct exec ${vmId} -- usermod  -l '${username}' admin`,
      `pct exec ${vmId} -- groupmod -n '${username}' admin`,
      `pct exec ${vmId} -- usermod  -d '/home/${username}' -m '${username}'`,
      `pct exec ${vmId} -- bash -c "echo '${username}:${password}' | chpasswd"`,
      `pct exec ${vmId} -- hostnamectl set-hostname '${hostname}'`,
      `pct exec ${vmId} -- sed -i 's/tpl-vps-ubuntu-server/${hostname}/g' /etc/hosts`,
    ];

    for (const cmd of cmds) {
      const { code, stderr } = await ssh.execCommand(cmd);
      if (code !== 0) throw new Error(`pct exec échoué (code ${code}): ${stderr}`);
    }
  } finally {
    ssh.dispose();
  }
}

// Lance le provisioning en arrière-plan. Met à jour le statut du service en BDD
// (provisioning → active | failed) pour que WooCommerce puisse poller GET /provision/:id/status.
export async function provision(serviceId, {
  email, firstName, lastName, desiredUsername,
  productType, templateId, resources, cartId, externalOrderId,
}) {
  const node     = env.PROXMOX_DEFAULT_NODE;
  const password = generatePassword();
  let vmId;

  try {
    // Détermine le username final dans le CT
    const username = (desiredUsername ?? slugify(firstName)) || 'ubuntu';

    // Calcule le numéro de serveur pour ce client (ex : dupont-1, dupont-2)
    const existingCount = await serviceRepo.countByEmailAndType(email, productType);
    const serverNumber  = existingCount + 1;
    const hostname      = (productType === 'vps' && lastName)
      ? buildHostname(lastName, serverNumber)
      : `${productType}-${slugify(firstName)}-${serverNumber}`;

    vmId = await proxmox.getNextVmId();

    logger.info({ serviceId, vmId, productType, templateId, hostname }, 'provisioning:clone_start');

    const taskUpid = await proxmox.cloneContainer(node, templateId, vmId, { hostname });

    // Attend la fin de la tâche de clonage (au lieu d'un sleep fixe)
    if (typeof taskUpid === 'string' && taskUpid.startsWith('UPID:')) {
      await proxmox.waitForTask(node, taskUpid);
    } else {
      // Fallback conservateur si l'API ne retourne pas le UPID
      await new Promise(r => setTimeout(r, 30_000));
    }

    await proxmox.configureContainer(node, vmId, {
      memory:   (resources.ram_gb || 1) * 1024,
      cores:    resources.cpu || 1,
      net0:     `name=eth0,bridge=${VPS_BRIDGE},ip=dhcp`,
    });

    await proxmox.startContainer(node, vmId);

    const running = await waitForRunning(node, vmId);
    if (!running) throw new Error(`CT ${vmId} non démarré après timeout`);

    logger.info({ serviceId, vmId }, 'provisioning:running');

    // Configure l'utilisateur dans le CT
    await configureVpsUser(vmId, username, password, hostname);

    // Récupère l'IP DHCP attribuée par OPNsense
    const ip = await waitForDhcpIp(node, vmId);

    // Met à jour la BDD
    await serviceRepo.updateVmId(serviceId, vmId);
    await serviceRepo.updateIp(serviceId, ip);
    await serviceRepo.updateStatus(serviceId, 'active');

    logger.info({ serviceId, vmId, ip, username, hostname }, 'provisioning:complete');

    if (cartId) await reservation.release(cartId).catch(() => {});

    mail.sendAccessEmail(email, firstName, productType, { ip, port: '22', username, password }, resources)
        .catch(err => logger.warn({ err: err.message, serviceId }, 'mail:access_failed'));

  } catch (err) {
    logger.error({ err: err.message, serviceId, vmId }, 'provisioning:failed');

    await serviceRepo.markFailed(serviceId, err.message);

    if (vmId) {
      proxmox.stopContainer(node, vmId)
        .catch(() => {})
        .finally(() => proxmox.deleteContainer(node, vmId).catch(() => {}));
    }

    if (cartId) await reservation.release(cartId).catch(() => {});

    mail.sendProvisioningFailedEmail(email, firstName, productType, externalOrderId ?? serviceId)
        .catch(e => logger.warn({ err: e.message, serviceId }, 'mail:failed_email_failed'));
  }
}
