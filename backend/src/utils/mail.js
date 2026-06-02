import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import logger from './logger.js';

const transporter = nodemailer.createTransport({
  host:   env.SMTP_HOST,
  port:   env.SMTP_PORT,
  secure: env.SMTP_PORT === 465,
  auth:   { user: env.SMTP_USER, pass: env.SMTP_PASS },
});

async function send(to, subject, html) {
  try {
    await transporter.sendMail({ from: env.SMTP_USER, to, subject, html });
    logger.info({ to, subject }, 'mail:sent');
  } catch (err) {
    logger.error({ err: err.message, to, subject }, 'mail:failed');
  }
}

export async function sendAccessEmail(to, firstName, productType, access, resources) {
  const specs = `
    <ul>
      ${resources.cpu        ? `<li><strong>CPU :</strong> ${resources.cpu} cœur(s)</li>` : ''}
      ${resources.ram_gb     ? `<li><strong>RAM :</strong> ${resources.ram_gb} Go</li>` : ''}
      ${resources.storage_gb ? `<li><strong>Stockage :</strong> ${resources.storage_gb} Go</li>` : ''}
    </ul>`;

  const subjects = { vps: 'VPS', vpn: 'VPN', nas: 'NAS Nextcloud' };
  const label    = subjects[productType] ?? productType.toUpperCase();

  const accessBlock = productType === 'nas'
    ? `<li><strong>URL :</strong> https://${access.ip}</li>
       <li><strong>Identifiant :</strong> ${access.username}</li>
       <li><strong>Mot de passe temporaire :</strong> <code>${access.password}</code></li>`
    : `<li><strong>Adresse IP :</strong> ${access.ip}</li>
       <li><strong>Port :</strong> ${access.port}</li>
       <li><strong>Identifiant :</strong> ${access.username}</li>
       <li><strong>Mot de passe temporaire :</strong> <code>${access.password}</code></li>`;

  await send(to, `SYNJ — Vos accès ${label} sont prêts`, `
    <h2>Bonjour ${firstName},</h2>
    <p>Votre service <strong>${label}</strong> est déployé et actif.</p>
    <h3>Accès :</h3><ul>${accessBlock}</ul>
    <h3>Configuration :</h3>${specs}
    <p><em>Changez votre mot de passe dès la première connexion.</em></p>
    <p>Cordialement,<br>L'équipe SYNJ</p>
  `);
}

export async function sendProvisioningFailedEmail(to, firstName, productType, orderId) {
  const labels = { vps: 'VPS', vpn: 'VPN', nas: 'NAS Nextcloud' };
  const label  = labels[productType] ?? productType.toUpperCase();

  await send(to, `SYNJ — Problème avec votre commande ${label}`, `
    <h2>Bonjour ${firstName},</h2>
    <p>Nous rencontrons un problème technique lors du déploiement de votre service <strong>${label}</strong> (commande ${orderId}).</p>
    <p>Votre remboursement a été déclenché automatiquement et sera crédité sous 3 à 5 jours ouvrés selon votre banque.</p>
    <p>Nous nous excusons pour la gêne occasionnée. N'hésitez pas à nous contacter si vous avez des questions.</p>
    <p>Cordialement,<br>L'équipe SYNJ</p>
  `);
}

export async function sendReminderEmail(to, firstName, daysLeft) {
  await send(to, `SYNJ — Rappel : suppression dans ${daysLeft} jour(s)`, `
    <h2>Bonjour ${firstName},</h2>
    <p>Votre service SYNJ sera <strong>définitivement supprimé dans ${daysLeft} jour(s)</strong>.</p>
    <p>Pour le conserver, régularisez votre paiement depuis votre espace client.</p>
    <p>Cordialement,<br>L'équipe SYNJ</p>
  `);
}

export async function sendServiceDeletedEmail(to, firstName) {
  await send(to, 'SYNJ — Service supprimé', `
    <h2>Bonjour ${firstName},</h2>
    <p>Le délai de 14 jours étant écoulé, votre service SYNJ a été <strong>définitivement supprimé</strong>.</p>
    <p>Cordialement,<br>L'équipe SYNJ</p>
  `);
}
