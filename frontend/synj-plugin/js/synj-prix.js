// SYNJ — Prix dynamique + selects dynamiques (P10/P11)

const SYNJ_PROXY = '/wp-json/synj/v1';

// Config par produit
const SYNJ_PRODUITS = {
    'serveur-vpn':           { base: 8,  label: 'VPN',       ram: true, cpu: false, stockage: false },
    'vps-linux':             { base: 12, label: 'VPS Linux',  ram: true, cpu: true,  stockage: false },
    'serveur-nas-personnel': { base: 28, label: 'NAS',        ram: true, cpu: false, stockage: true  },
};

// Paliers (temporaires pour test avec petit Proxmox)
const PALIERS_RAM      = [0.05, 0.1, 0.2];
const PALIERS_CPU      = [1, 2, 4];
const PALIERS_STOCKAGE = [1, 2, 3, 5];

// Prix add-ons
const PRIX_RAM      = 3;   // €/Go
const PRIX_CPU      = 3;   // €/cœur
const PRIX_STOCKAGE = 0.02; // €/Go

function generateTiers(disponible, paliers) {
    return paliers.filter(p => p <= disponible);
}

function getProduitConfig() {
    const url = window.location.href;
    for (const [slug, config] of Object.entries(SYNJ_PRODUITS)) {
        if (url.includes(slug)) return { slug, ...config };
    }
    return null;
}

function calculerPrix(config, ramVal, cpuVal, stockageVal) {
    let prix = config.base;
    if (ramVal) prix += ramVal * PRIX_RAM;
    if (cpuVal) prix += cpuVal * PRIX_CPU;
    if (stockageVal) prix += stockageVal * PRIX_STOCKAGE;
    return prix.toFixed(2);
}

function creerSelect(id, label, paliers, unite, onChange) {
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'margin: 12px 0;';

    const lbl = document.createElement('label');
    lbl.textContent = label;
    lbl.style.cssText = 'display:block; font-weight:600; color:#1e3a5f; margin-bottom:6px; font-size:14px;';

    const select = document.createElement('select');
    select.id = id;
    select.style.cssText = 'width:200px; padding:8px 12px; border:2px solid #e5e7eb; border-radius:8px; font-size:14px; cursor:pointer;';

    const defaultOpt = document.createElement('option');
    defaultOpt.value = '';
    defaultOpt.textContent = '— Choisir —';
    select.appendChild(defaultOpt);

    paliers.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p;
        opt.textContent = p + ' ' + unite;
        select.appendChild(opt);
    });

    select.addEventListener('change', onChange);
    wrapper.appendChild(lbl);
    wrapper.appendChild(select);
    return wrapper;
}

function afficherPrix(prix, config) {
    let zone = document.getElementById('synj-prix-dynamique');
    if (!zone) {
        zone = document.createElement('div');
        zone.id = 'synj-prix-dynamique';
        zone.style.cssText = 'background:#1e3a5f; color:white; padding:16px 20px; border-radius:10px; margin:16px 0; font-size:22px; font-weight:bold;';
        const selectsZone = document.getElementById('synj-selects');
        if (selectsZone) selectsZone.insertAdjacentElement('afterend', zone);
    }
    zone.textContent = 'Prix estimé : ' + prix + ' €/mois';
}

async function synj_initProduit() {
    const config = getProduitConfig();
    if (!config) return;

    // Cacher le prix WooCommerce
    const prixWC = document.querySelector('.woocommerce-Price-amount, p.price, span.price');
    if (prixWC) prixWC.style.display = 'none';

    // Récupérer les dispos
    const [ramData, cpuData, storData] = await Promise.all([
        fetch(SYNJ_PROXY + '/memory').then(r => r.json()),
        fetch(SYNJ_PROXY + '/cpu').then(r => r.json()),
        fetch(SYNJ_PROXY + '/storage').then(r => r.json()),
    ]);

    const ramDispo = ramData.available_memory / 1073741824;
    const cpuDispo = cpuData.available_cpu;
    const storDispo = storData.available_storage / 1073741824;

    // Générer les paliers
    const paliersRamDispo      = generateTiers(ramDispo, PALIERS_RAM);
    const paliersCpuDispo      = generateTiers(cpuDispo, PALIERS_CPU);
    const paliersStockageDispo = generateTiers(storDispo, PALIERS_STOCKAGE);

    // Zone d'injection
    let zone = document.getElementById('synj-selects');
    if (!zone) {
        zone = document.createElement('div');
        zone.id = 'synj-selects';
        zone.style.cssText = 'margin:20px 0; padding:16px; background:#f8fafc; border-radius:10px; border:1px solid #e5e7eb;';
        const addToCart = document.querySelector('.single_add_to_cart_button, .cart');
        if (addToCart) addToCart.insertAdjacentElement('beforebegin', zone);
    }

    const recalculer = () => {
        const ram = config.ram ? parseFloat(document.getElementById('synj-ram')?.value) || 0 : 0;
        const cpu = config.cpu ? parseFloat(document.getElementById('synj-cpu')?.value) || 0 : 0;
        const stk = config.stockage ? parseFloat(document.getElementById('synj-stockage')?.value) || 0 : 0;
        afficherPrix(calculerPrix(config, ram, cpu, stk), config);
    };

    // Ajouter les selects selon le produit
    if (config.ram && paliersRamDispo.length > 0) {
        zone.appendChild(creerSelect('synj-ram', 'RAM supplémentaire', paliersRamDispo, 'Go', recalculer));
    } else if (config.ram) {
        const msg = document.createElement('p');
        msg.textContent = '⚠️ RAM insuffisante sur le serveur pour ce service.';
        msg.style.color = '#ef4444';
        zone.appendChild(msg);
    }

    if (config.cpu && paliersCpuDispo.length > 0) {
        zone.appendChild(creerSelect('synj-cpu', 'CPU supplémentaire', paliersCpuDispo, 'cœur(s)', recalculer));
    }

    if (config.stockage && paliersStockageDispo.length > 0) {
        zone.appendChild(creerSelect('synj-stockage', 'Stockage supplémentaire', paliersStockageDispo, 'Go', recalculer));
    }

    // Prix de base au chargement
    afficherPrix(config.base.toFixed(2), config);
}

document.addEventListener('DOMContentLoaded', synj_initProduit);