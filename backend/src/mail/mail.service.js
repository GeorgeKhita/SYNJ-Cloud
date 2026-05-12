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

module.exports = {sendAccessEmail};