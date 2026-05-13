const nodemailer = require('nodemailer');
const mailConfig = require('../config/mail.config');

const transporter = nodemailer.createTransport({
  host: mailConfig.host,
  port: mailConfig.port,
  secure: mailConfig.port === 465,
  auth: {
    user: mailConfig.user,
    pass: mailConfig.pass
  }
});

// --- EMAILS ACCÈS (après déploiement) ---

function buildVpnEmail(accessInfo, paymentData) {
  return {
    subject: 'SYNJ — Vos accès VPN sont prêts',
    html: `
      <h2>Bienvenue chez SYNJ !</h2>
      <p>Votre serveur VPN est déployé et actif.</p>
      <h3>Vos accès :</h3>
      <ul>
        <li><strong>Adresse IP :</strong> ${accessInfo.ip}</li>
        <li><strong>Port :</strong> ${accessInfo.port}</li>
        <li><strong>Identifiant :</strong> ${accessInfo.username}</li>
        <li><strong>Mot de passe temporaire :</strong> ${accessInfo.password}</li>
      </ul>
      <p><em>Nous vous recommandons de changer votre mot de passe dès la première connexion.</em></p>
      <p>Cordialement,<br>L'équipe SYNJ</p>
    `
  };
}

function buildVpsEmail(accessInfo, paymentData) {
  const isWindows = paymentData.os === 'windows-server';
  return {
    subject: 'SYNJ — Vos accès VPS sont prêts',
    html: `
      <h2>Bienvenue chez SYNJ !</h2>
      <p>Votre serveur VPS est déployé et actif.</p>
      <h3>Vos accès :</h3>
      <ul>
        <li><strong>Adresse IP :</strong> ${accessInfo.ip}</li>
        <li><strong>Port ${isWindows ? 'RDP' : 'SSH'} :</strong> ${accessInfo.port}</li>
        <li><strong>Identifiant :</strong> ${accessInfo.username}</li>
        <li><strong>Mot de passe temporaire :</strong> ${accessInfo.password}</li>
      </ul>
      <h3>Configuration :</h3>
      <ul>
        <li><strong>RAM :</strong> ${paymentData.ram} Go</li>
        <li><strong>CPU :</strong> ${paymentData.cpu} cœurs</li>
        <li><strong>OS :</strong> ${paymentData.os || 'Ubuntu CLI'}</li>
      </ul>
      <p><em>Nous vous recommandons de changer votre mot de passe dès la première connexion.</em></p>
      <p>Cordialement,<br>L'équipe SYNJ</p>
    `
  };
}

function buildNasEmail(accessInfo, paymentData) {
  return {
    subject: 'SYNJ — Vos accès NAS Nextcloud sont prêts',
    html: `
      <h2>Bienvenue chez SYNJ !</h2>
      <p>Votre serveur NAS Nextcloud est déployé et actif.</p>
      <h3>Vos accès :</h3>
      <ul>
        <li><strong>URL Nextcloud :</strong> https://${accessInfo.ip}</li>
        <li><strong>Identifiant :</strong> ${accessInfo.username}</li>
        <li><strong>Mot de passe temporaire :</strong> ${accessInfo.password}</li>
        <li><strong>Stockage alloué :</strong> ${paymentData.storage} Go</li>
      </ul>
      <p><em>Nous vous recommandons de changer votre mot de passe dès la première connexion.</em></p>
      <p>Cordialement,<br>L'équipe SYNJ</p>
    `
  };
}

async function sendAccessEmail(customerEmail, accessInfo, paymentData) {
  try {
    let emailContent;

    if (paymentData.productId === 'vpn') {
      emailContent = buildVpnEmail(accessInfo, paymentData);
    } else if (paymentData.productId === 'vps') {
      emailContent = buildVpsEmail(accessInfo, paymentData);
    } else if (paymentData.productId === 'nas') {
      emailContent = buildNasEmail(accessInfo, paymentData);
    } else {
      console.log('Type de produit inconnu pour email:', paymentData.productId);
      return false;
    }

    await transporter.sendMail({
      from: mailConfig.from,
      to: customerEmail,
      subject: emailContent.subject,
      html: emailContent.html
    });

    console.log('Email accès envoyé à', customerEmail);
    return true;
  } catch (error) {
    console.log('Erreur envoi email:', error.message);
    return false;
  }
}

// --- EMAILS CYCLE DE VIE ---

async function sendPaymentFailedEmail(customerEmail, firstName) {
  try {
    await transporter.sendMail({
      from: mailConfig.from,
      to: customerEmail,
      subject: 'SYNJ — Échec de paiement — Action requise',
      html: `
        <h2>Bonjour ${firstName},</h2>
        <p>Nous n'avons pas pu prélever votre abonnement SYNJ.</p>
        <p>Votre service a été <strong>suspendu</strong> temporairement. Vous disposez d'un délai de <strong>14 jours</strong> pour régulariser votre paiement.</p>
        <p>Pour mettre à jour votre moyen de paiement, connectez-vous à votre espace client.</p>
        <p><strong>Sans action de votre part, votre service et toutes les données associées seront définitivement supprimés dans 14 jours.</strong></p>
        <p>Cordialement,<br>L'équipe SYNJ</p>
      `
    });
    console.log('Email alerte impayé envoyé à', customerEmail);
    return true;
  } catch (error) {
    console.log('Erreur envoi email impayé:', error.message);
    return false;
  }
}

async function sendServiceReactivatedEmail(customerEmail, firstName) {
  try {
    await transporter.sendMail({
      from: mailConfig.from,
      to: customerEmail,
      subject: 'SYNJ — Service réactivé',
      html: `
        <h2>Bonjour ${firstName},</h2>
        <p>Bonne nouvelle ! Votre paiement a été reçu et votre service SYNJ a été <strong>réactivé</strong>.</p>
        <p>Vos accès sont de nouveau disponibles depuis votre espace client.</p>
        <p>Cordialement,<br>L'équipe SYNJ</p>
      `
    });
    console.log('Email réactivation envoyé à', customerEmail);
    return true;
  } catch (error) {
    console.log('Erreur envoi email réactivation:', error.message);
    return false;
  }
}

async function sendSubscriptionDeletedEmail(customerEmail, firstName) {
  try {
    await transporter.sendMail({
      from: mailConfig.from,
      to: customerEmail,
      subject: 'SYNJ — Résiliation de votre abonnement',
      html: `
        <h2>Bonjour ${firstName},</h2>
        <p>Votre abonnement SYNJ a été résilié.</p>
        <p>Votre service est désormais <strong>inactif</strong>. Vos données seront conservées pendant <strong>14 jours</strong> à compter de cette date.</p>
        <p>Passé ce délai, votre serveur et toutes les données associées seront <strong>définitivement supprimés</strong>.</p>
        <p>Si vous souhaitez réactiver votre service, connectez-vous à votre espace client avant l'expiration du délai.</p>
        <p>Cordialement,<br>L'équipe SYNJ</p>
      `
    });
    console.log('Email résiliation envoyé à', customerEmail);
    return true;
  } catch (error) {
    console.log('Erreur envoi email résiliation:', error.message);
    return false;
  }
}

async function sendReminderEmail(customerEmail, firstName, daysLeft) {
  try {
    await transporter.sendMail({
      from: mailConfig.from,
      to: customerEmail,
      subject: 'SYNJ — Rappel : suppression dans ' + daysLeft + ' jours',
      html: `
        <h2>Bonjour ${firstName},</h2>
        <p>Ceci est un rappel : votre service SYNJ sera <strong>définitivement supprimé dans ${daysLeft} jours</strong>.</p>
        <p>Toutes vos données seront perdues de manière irréversible.</p>
        <p>Pour conserver votre service, régularisez votre paiement depuis votre espace client.</p>
        <p>Cordialement,<br>L'équipe SYNJ</p>
      `
    });
    console.log('Email rappel J-' + daysLeft + ' envoyé à', customerEmail);
    return true;
  } catch (error) {
    console.log('Erreur envoi email rappel:', error.message);
    return false;
  }
}

async function sendServiceDeletedEmail(customerEmail, firstName) {
  try {
    await transporter.sendMail({
      from: mailConfig.from,
      to: customerEmail,
      subject: 'SYNJ — Service supprimé',
      html: `
        <h2>Bonjour ${firstName},</h2>
        <p>Le délai de 14 jours étant écoulé, votre service SYNJ a été <strong>définitivement supprimé</strong>.</p>
        <p>Toutes les données associées ont été effacées.</p>
        <p>Si vous souhaitez souscrire à un nouveau service, rendez-vous sur notre boutique.</p>
        <p>Cordialement,<br>L'équipe SYNJ</p>
      `
    });
    console.log('Email suppression envoyé à', customerEmail);
    return true;
  } catch (error) {
    console.log('Erreur envoi email suppression:', error.message);
    return false;
  }
}

module.exports = {
  sendAccessEmail,
  sendPaymentFailedEmail,
  sendServiceReactivatedEmail,
  sendSubscriptionDeletedEmail,
  sendReminderEmail,
  sendServiceDeletedEmail
};