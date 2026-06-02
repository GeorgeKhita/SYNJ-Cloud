// SYNJ — Prix dynamique sur page produit

// Config statique par produit (slug WooCommerce → ressources)
const SYNJ_PRODUITS = {
    'vps': {
        type: 'vps', label: 'VPS', base_price: 12,
        cpu:        { min: 1,  max: 8,   step: 1,  label: 'vCPU',        prix: 3.00 },
        ram_gb:     { min: 2,  max: 32,  step: 1,  label: 'RAM (Go)',     prix: 2.50 },
        storage_gb: { min: 20, max: 500, step: 20, label: 'Stockage (Go)',prix: 0.02 },
    },
    'vpn': {
        type: 'vpn', label: 'VPN', base_price: 8,
        cpu:        { min: 1, max: 4,  step: 1, label: 'vCPU',    prix: 3.00 },
        ram_gb:     { min: 1, max: 8,  step: 1, label: 'RAM (Go)',prix: 2.50 },
        storage_gb: null,
    },
    'nas': {
        type: 'nas', label: 'NAS', base_price: 28,
        cpu:        { min: 1,   max: 4,    step: 1,  label: 'vCPU',        prix: 3.00 },
        ram_gb:     { min: 2,   max: 16,   step: 1,  label: 'RAM (Go)',     prix: 2.50 },
        storage_gb: { min: 100, max: 2000, step: 100,label: 'Stockage (Go)',prix: 0.02 },
    },
};

// Trouve la config selon le slug WooCommerce dans l'URL
function getProduitConfig() {
    const slug = window.location.pathname.split('/').filter(Boolean).pop() || '';
    for (const [key, config] of Object.entries(SYNJ_PRODUITS)) {
        if (slug.includes(key)) return { key, ...config };
    }
    return null;
}

// Calcule le prix côté client
function calculerPrix(config) {
    let prix = config.base_price;
    if (config.cpu)        prix += (getVal('synj-cpu')      - config.cpu.min)        * config.cpu.prix;
    if (config.ram_gb)     prix += (getVal('synj-ram')      - config.ram_gb.min)     * config.ram_gb.prix;
    if (config.storage_gb) prix += (getVal('synj-stockage') - config.storage_gb.min) * config.storage_gb.prix;
    return Math.max(prix, config.base_price).toFixed(2);
}

function getVal(id) {
    return parseFloat(document.getElementById(id)?.value) || 0;
}

// -------------------------------------------------------------------
// UI
// -------------------------------------------------------------------

function genererPaliers(min, max, step) {
    const paliers = [];
    for (let v = min; v <= max; v += step) paliers.push(v);
    return paliers;
}

function creerSelect(id, ressource, onChange) {
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'margin: 12px 0;';

    const lbl = document.createElement('label');
    lbl.textContent = ressource.label;
    lbl.style.cssText = 'display:block; font-weight:600; color:#1e3a5f; margin-bottom:6px; font-size:14px;';

    const select = document.createElement('select');
    select.id = id;
    select.style.cssText = 'width:200px; padding:8px 12px; border:2px solid #e5e7eb; border-radius:8px; font-size:14px; cursor:pointer;';

    genererPaliers(ressource.min, ressource.max, ressource.step).forEach(p => {
        const opt = document.createElement('option');
        opt.value = p;
        opt.textContent = p + ' ' + ressource.label;
        if (p === ressource.min) opt.selected = true;
        select.appendChild(opt);
    });

    select.addEventListener('change', onChange);
    wrapper.appendChild(lbl);
    wrapper.appendChild(select);
    return wrapper;
}

function afficherErreur(message) {
    let zone = document.getElementById('synj-erreur');
    if (!zone) {
        zone = document.createElement('div');
        zone.id = 'synj-erreur';
        zone.style.cssText = 'background:#fee2e2; color:#dc2626; padding:12px 16px; border-radius:8px; margin:12px 0; font-size:14px;';
        const selectsZone = document.getElementById('synj-selects');
        if (selectsZone) selectsZone.insertAdjacentElement('afterend', zone);
    }
    zone.textContent = message;
}

function afficherPrix(prix) {
    let zone = document.getElementById('synj-prix-dynamique');
    if (!zone) {
        zone = document.createElement('div');
        zone.id = 'synj-prix-dynamique';
        zone.style.cssText = 'background:#1e3a5f; color:white; padding:16px 20px; border-radius:10px; margin:16px 0; font-size:22px; font-weight:bold;';
        const selectsZone = document.getElementById('synj-selects');
        if (selectsZone) selectsZone.insertAdjacentElement('afterend', zone);
    }
    zone.textContent = prix ? 'Prix estimé : ' + prix + ' €/mois' : 'Calcul...';
}

// -------------------------------------------------------------------
// Init
// -------------------------------------------------------------------

async function synj_initProduit() {
    const config = getProduitConfig();
    if (!config) return;

    // Cacher le prix WooCommerce
    const prixWC = document.querySelector('.woocommerce-Price-amount, p.price, span.price');
    if (prixWC) prixWC.style.display = 'none';

    // Zone des selects
    let zone = document.getElementById('synj-selects');
    if (!zone) {
        zone = document.createElement('div');
        zone.id = 'synj-selects';
        zone.style.cssText = 'margin:20px 0; padding:16px; background:#f8fafc; border-radius:10px; border:1px solid #e5e7eb;';
        const addToCart = document.querySelector('.single_add_to_cart_button, .cart');
        if (addToCart) addToCart.insertAdjacentElement('beforebegin', zone);
    }

    // Vérification disponibilité
    const minResources = { cpu: config.cpu?.min ?? 1, ram_gb: config.ram_gb?.min ?? 1 };
    if (config.storage_gb) minResources.storage_gb = config.storage_gb.min;

    try {
        const dispo = await fetch('/wp-json/synj/v1/availability/check', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(minResources),
        }).then(r => r.json());

        if (!dispo.available) {
            zone.innerHTML = `<p style="color:#ef4444; font-weight:600;">
                ⚠️ Ce service est temporairement indisponible.<br>
                <small style="font-weight:normal;color:#6b7280;">Nos serveurs sont à capacité maximale. Revenez dans quelques heures.</small>
            </p>`;
            const btn = document.querySelector('.single_add_to_cart_button');
            if (btn) { btn.disabled = true; btn.style.opacity = '0.5'; }
            return;
        }
    } catch { /* backend injoignable → on laisse passer */ }

    // Selects
    const recalculer = () => afficherPrix(calculerPrix(config));
    if (config.cpu)        zone.appendChild(creerSelect('synj-cpu',      config.cpu,        recalculer));
    if (config.ram_gb)     zone.appendChild(creerSelect('synj-ram',      config.ram_gb,     recalculer));
    if (config.storage_gb) zone.appendChild(creerSelect('synj-stockage', config.storage_gb, recalculer));

    setupPanier(config);
    afficherPrix(calculerPrix(config));
}

// -------------------------------------------------------------------
// Panier WooCommerce
// -------------------------------------------------------------------

function setupPanier(config) {
    const form = document.querySelector('form.cart');
    if (!form) return;

    form.addEventListener('submit', async function (e) {
        // Deuxième passage : les champs sont déjà injectés, laisser WooCommerce gérer
        if (document.getElementById('synj_ram_gb')) return;

        e.preventDefault();

        const resources = {
            cpu:        getVal('synj-cpu')      || config.cpu?.min        || 1,
            ram_gb:     getVal('synj-ram')      || config.ram_gb?.min     || 1,
            storage_gb: getVal('synj-stockage') || config.storage_gb?.min || 0,
        };

        try {
            const res = await fetch(window.__SYNJ_API_BASE + '/cart/reserve', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json', 'X-API-Key': window.__SYNJ_API_KEY },
                body:    JSON.stringify({ cartId: window.__SYNJ_CART_ID, resources }),
            });

            if (res.status === 409) {
                const zone = document.getElementById('synj-selects');
                if (zone) {
                    const err = document.createElement('p');
                    err.id = 'synj-reserve-error';
                    err.style.cssText = 'color:#ef4444; font-weight:600; margin-top:8px;';
                    err.textContent = 'Ressources réservées par d\'autres clients. Réessayez dans quelques minutes.';
                    document.getElementById('synj-reserve-error')?.remove();
                    zone.appendChild(err);
                }
                return;
            }
        } catch { /* backend injoignable → fail-open, on continue */ }

        // Injecter les champs cachés
        ['synj_ram_gb', 'synj_cpu', 'synj_storage_gb', 'synj_prix', 'synj_type'].forEach(id => {
            document.getElementById(id)?.remove();
        });

        [
            { name: 'synj_cpu',        value: resources.cpu        },
            { name: 'synj_ram_gb',     value: resources.ram_gb     },
            { name: 'synj_storage_gb', value: resources.storage_gb },
            { name: 'synj_prix',       value: calculerPrix(config) },
            { name: 'synj_type',       value: config.type          },
        ].forEach(({ name, value }) => {
            const input = document.createElement('input');
            input.type = 'hidden'; input.id = name; input.name = name; input.value = value;
            form.appendChild(input);
        });

        // Re-déclencher via le bouton pour que WooCommerce capture l'événement
        form.querySelector('.single_add_to_cart_button')?.click();
    });
}

document.addEventListener('DOMContentLoaded', synj_initProduit);
