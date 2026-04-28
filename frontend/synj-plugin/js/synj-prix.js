// SYNJ — Prix dynamique + selects dynamiques (P10/P11)

const SYNJ_PROXY = '/wp-json/synj/v1';

// Config par produit
const SYNJ_PRODUITS = {
    'serveur-vpn': { 
        base: 8, label: 'VPN', 
        ram: true, cpu: true, stockage: false,
        ramBase: 1, cpuBase: 2, stockageBase: 0,
        os: null,
        apiId: 'vpn',
    },
    'vps-linux': { 
        base: 12, label: 'VPS Linux', 
        ram: true, cpu: true, stockage: false,
        ramBase: 4, cpuBase: 1, stockageBase: 0,
        os: ["ubuntu-cli", "ubuntu-desktop", "windows-server"],
        apiId: 'vps',
    },
    'serveur-nas-personnel': { 
        base: 28, label: 'NAS', 
        ram: true, cpu: true, stockage: true,
        ramBase: 2, cpuBase: 2, stockageBase: 100,
        os: null,
        apiId: 'nas',
    },

};


// Prix add-ons
const PRIX_RAM      = 3;   // €/Go
const PRIX_CPU      = 3;   // €/cœur
const PRIX_STOCKAGE = 0.02; // €/Go



function getProduitConfig() {
    const url = window.location.href;
    for (const [slug, config] of Object.entries(SYNJ_PRODUITS)) {
        if (url.includes(slug)) return { slug, ...config };
    }
    return null;
}

function calculerPrix(config, ramVal, cpuVal, stockageVal) {
    let prix = config.base;
    if (ramVal) prix += (ramVal - config.ramBase) * PRIX_RAM;
    if (cpuVal) prix += (cpuVal - config.cpuBase) * PRIX_CPU;
    if (stockageVal) prix += (stockageVal - config.stockageBase) * PRIX_STOCKAGE;
    return Math.max(prix, config.base).toFixed(2);
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

function creerSelectOS(options, onChange) {
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'margin: 12px 0;';

    const lbl = document.createElement('label');
    lbl.textContent = 'Système d\'exploitation';
    lbl.style.cssText = 'display:block; font-weight:600; color:#1e3a5f; margin-bottom:6px; font-size:14px;';

    const select = document.createElement('select');
    select.id = 'synj-os';
    select.style.cssText = 'width:200px; padding:8px 12px; border:2px solid #e5e7eb; border-radius:8px; font-size:14px; cursor:pointer;';

    const defaultOpt = document.createElement('option');
    defaultOpt.value = '';
    defaultOpt.textContent = '— Choisir un OS —';
    select.appendChild(defaultOpt);

    const osLabels = {
        'ubuntu-cli': 'Ubuntu CLI',
        'ubuntu-desktop': 'Ubuntu Desktop',
        'windows-server': 'Windows Server'
    };

    options.forEach(os => {
        const opt = document.createElement('option');
        opt.value = os;
        opt.textContent = osLabels[os] || os;
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

    const data = await fetch(SYNJ_PROXY + '/products/' + config.apiId + '/options').then(r => r.json());

    if (data.error) {
        zone.innerHTML = '<p style="color:#ef4444">⚠️ Ressources temporairement indisponibles.</p>';
        return;
    }
    
    const paliersRamDispo      = data.tiers.ram;
    const paliersCpuDispo      = data.tiers.cpu;
    const paliersStockageDispo = data.tiers.storage;

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

    // ← ICI
    if (config.os && config.os.length > 0) {            zone.appendChild(creerSelectOS(config.os, recalculer));
    }

    setupPanier(config);

    // Prix de base au chargement
    afficherPrix(config.base.toFixed(2), config);
}

function injecterChampsCache(config, ram, cpu, stk, prix) {
    // Supprimer les anciens champs s'ils existent
    ['synj_ram', 'synj_cpu', 'synj_stockage', 'synj_prix', 'synj_os'].forEach(id => {
        const old = document.getElementById(id);
        if (old) old.remove();
    });

    const form = document.querySelector('form.cart');
    if (!form) return;

    const os = config.os ? document.getElementById('synj-os')?.value || '' : '';

    const champs = [
        { name: 'synj_ram', value: ram },
        { name: 'synj_cpu', value: cpu },
        { name: 'synj_stockage', value: stk },
        { name: 'synj_prix', value: prix },
        { name: 'synj_os', value: os },
    ];

    champs.forEach(({ name, value }) => {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.id = name;
        input.name = name;
        input.value = value;
        form.appendChild(input);
    });
}

function setupPanier(config) {
    const form = document.querySelector('form.cart');
    if (!form) return;

    form.addEventListener('submit', (e) => {
        const ram = config.ram ? parseFloat(document.getElementById('synj-ram')?.value) || 0 : 0;
        const cpu = config.cpu ? parseFloat(document.getElementById('synj-cpu')?.value) || 0 : 0;
        const stk = config.stockage ? parseFloat(document.getElementById('synj-stockage')?.value) || 0 : 0;
        const prix = calculerPrix(config, ram, cpu, stk);
        injecterChampsCache(config, ram, cpu, stk, prix);
    });
}

document.addEventListener('DOMContentLoaded', synj_initProduit);