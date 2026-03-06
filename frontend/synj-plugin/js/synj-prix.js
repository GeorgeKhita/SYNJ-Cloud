// SYNJ — Prix dynamique en temps réel (P11)

const url = window.location.href;
let base = 8; // VPN par défaut
if (url.includes('vps-linux')) base = 12;
else if (url.includes('serveur-nas-personnel')) base = 28;

const config = {
    base: base,
    ramParGo: 3,
    stockageParGo: 0.02,
    cpuParCoeur: 3
}

function calculerPrix() {
    const ram = document.querySelector('select[data-attribute_name="attribute_ram"]');
    const stockage = document.querySelector('select[data-attribute_name="attribute_stockage"]');
    const cpu = document.querySelector('select[data-attribute_name="attribute_cpu"]');

    if (!ram || !stockage || !cpu) return;

    const ramVal = ram.value ? parseFloat(ram.value) : 0;
    const stockageVal = stockage.value ? parseFloat(stockage.value) : 0;
    const cpuVal = cpu.value ? parseFloat(cpu.value) : 0;

    let affichage = document.querySelector('#synj-prix');
    if (!affichage) {
        affichage = document.createElement('div');
        affichage.id = 'synj-prix';
        affichage.style.cssText = `
            background: rgb(0, 0, 0);
            border: 2px solid rgb(0, 0, 0);
            color: rgb(255, 255, 255);
            padding: 16px 20px;
            border-radius: 8px;
            margin: 16px 0;
            font-size: 22px;
            font-weight: bold;
        `;
        const zone = document.querySelector('.wp-block-post-title');
        if (zone) zone.insertAdjacentElement('afterend', affichage);
    }

    if (ramVal === 0 || cpuVal === 0) {
        affichage.textContent = `Prix de base : ${config.base.toFixed(2)} €/mois`;
        affichage.style.display = 'block';
        affichage.style.opacity = '1';
        return;
    }

    const prix = config.base
        + (ramVal * config.ramParGo)
        + (stockageVal * config.stockageParGo)
        + (cpuVal * config.cpuParCoeur);

    affichage.style.display = 'block';
    affichage.style.opacity = '0';
    affichage.style.transition = 'opacity 0.2s ease';

    setTimeout(() => {
        affichage.textContent = `Prix estimé : ${prix.toFixed(2)} €/mois`;
        affichage.style.opacity = '1';
    }, 200);
}

// Cacher le prix statique WooCommerce
document.addEventListener('DOMContentLoaded', () => {
    const prixWooCommerce = document.querySelector('.woocommerce-Price-amount');
    if (prixWooCommerce) {
        const parent = prixWooCommerce.closest('p.price, span.price');
        if (parent) parent.style.display = 'none';
        else prixWooCommerce.style.display = 'none';
    }

    document.querySelectorAll('select').forEach(select => {
        select.addEventListener('change', calculerPrix);
    });

    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('reset_variations')) {
            setTimeout(calculerPrix, 100);
        }
    });

    calculerPrix();
});