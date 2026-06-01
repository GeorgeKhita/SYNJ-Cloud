// SYNJ — Prix dynamique sur page produit
// Utilise GET /products et POST /products/:id/calculate-price

// window.__synj, window.__SYNJ_API_BASE, apiCall() définis dans synj-auth.js (chargé avant)

// -------------------------------------------------------------------
// Helpers UI
// -------------------------------------------------------------------

function genererPaliers(min, max, step) {
    const paliers = [];
    for (let v = min; v <= max; v += step) paliers.push(v);
    return paliers;
}

function creerSelect(id, ressource, onChange) {
    const paliers = genererPaliers(ressource.min, ressource.max, ressource.step);

    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'margin: 12px 0;';

    const lbl = document.createElement('label');
    lbl.textContent = ressource.label;
    lbl.style.cssText = 'display:block; font-weight:600; color:#1e3a5f; margin-bottom:6px; font-size:14px;';

    const select = document.createElement('select');
    select.id = id;
    select.style.cssText = 'width:200px; padding:8px 12px; border:2px solid #e5e7eb; border-radius:8px; font-size:14px; cursor:pointer;';

    paliers.forEach(p => {
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
// Init page produit
// -------------------------------------------------------------------

async function synj_initProduit() {
    // Récupère le dernier segment de l'URL comme slug (ex: /boutique/serveurs/vps-linux/ → vps-linux)
    const segments = window.location.pathname.split('/').filter(Boolean);
    if (!segments.length) return;
    const wcSlug = segments[segments.length - 1];

    // Cherche le produit correspondant dans l'API
    let produit = null;
    try {
        const data = await fetch(window.__SYNJ_API_BASE + '/products').then(r => r.json());
        produit = (data.products ?? []).find(p => p.slug === wcSlug || wcSlug.includes(p.slug));
    } catch {
        return;
    }

    if (!produit) return;

    const rc = produit.resource_config;

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

    // Calcul de prix via l'API
    async function recalculer() {
        afficherPrix(null); // affiche "Calcul..."
        const resources = {};
        if (rc.cpu)        resources.cpu        = parseInt(document.getElementById('synj-cpu')?.value        || rc.cpu.min);
        if (rc.ram_gb)     resources.ram_gb     = parseInt(document.getElementById('synj-ram')?.value        || rc.ram_gb.min);
        if (rc.storage_gb) resources.storage_gb = parseInt(document.getElementById('synj-stockage')?.value   || rc.storage_gb.min);

        try {
            const res = await fetch(window.__SYNJ_API_BASE + '/products/' + produit.id + '/calculate-price', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ resources }),
            });
            const data = await res.json();
            if (data.price != null) afficherPrix(data.price.toFixed(2));
        } catch {
            afficherPrix('—');
        }
    }

    // Création des selects selon resource_config
    if (rc.cpu)        zone.appendChild(creerSelect('synj-cpu',      rc.cpu,        recalculer));
    if (rc.ram_gb)     zone.appendChild(creerSelect('synj-ram',      rc.ram_gb,     recalculer));
    if (rc.storage_gb) zone.appendChild(creerSelect('synj-stockage', rc.storage_gb, recalculer));

    setupPanier(produit, rc);

    // Prix de base au chargement
    await recalculer();
}

// -------------------------------------------------------------------
// Gestion du panier
// -------------------------------------------------------------------

function injecterChampsCache(produit, rc) {
    ['synj_ram', 'synj_cpu', 'synj_stockage', 'synj_prix', 'synj_product_id'].forEach(id => {
        document.getElementById(id)?.remove();
    });

    const form = document.querySelector('form.cart');
    if (!form) return;

    const cpu        = rc.cpu        ? parseInt(document.getElementById('synj-cpu')?.value)      || rc.cpu.min        : 0;
    const ram        = rc.ram_gb     ? parseInt(document.getElementById('synj-ram')?.value)      || rc.ram_gb.min     : 0;
    const stockage   = rc.storage_gb ? parseInt(document.getElementById('synj-stockage')?.value) || rc.storage_gb.min : 0;
    const prixZone   = document.getElementById('synj-prix-dynamique');
    const prix       = prixZone ? prixZone.textContent.match(/[\d.]+/)?.[0] || '0' : '0';

    [
        { name: 'synj_cpu',        value: cpu        },
        { name: 'synj_ram',        value: ram        },
        { name: 'synj_stockage',   value: stockage   },
        { name: 'synj_prix',       value: prix       },
        { name: 'synj_product_id', value: produit.id },
    ].forEach(({ name, value }) => {
        const input = document.createElement('input');
        input.type  = 'hidden';
        input.id    = name;
        input.name  = name;
        input.value = value;
        form.appendChild(input);
    });
}

function setupPanier(produit, rc) {
    const form = document.querySelector('form.cart');
    if (!form) return;

    const btn = form.querySelector('[type="submit"]');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Pas connecté → message + redirect vers login
        if (!window.__synj?.isLoggedIn) {
            afficherErreur('Vous devez être connecté pour commander.');
            setTimeout(() => {
                window.location.href = '/my-account/?redirect_to=' + encodeURIComponent(window.location.href);
            }, 1500);
            return;
        }

        // Ressources sélectionnées
        const resources = {};
        if (rc.cpu)        resources.cpu        = parseInt(document.getElementById('synj-cpu')?.value)      || rc.cpu.min;
        if (rc.ram_gb)     resources.ram_gb     = parseInt(document.getElementById('synj-ram')?.value)      || rc.ram_gb.min;
        if (rc.storage_gb) resources.storage_gb = parseInt(document.getElementById('synj-stockage')?.value) || rc.storage_gb.min;

        if (btn) { btn.disabled = true; btn.textContent = 'Création du panier...'; }
        document.getElementById('synj-erreur')?.remove();

        try {
            const result = await apiCall('POST', '/cart/items', { productId: produit.id, resources });

            if (result?.cartOrderId) {
                sessionStorage.setItem('synj_cart_id',          result.cartOrderId);
                sessionStorage.setItem('synj_cart_product_url', window.location.href);
                window.location.href = '/checkout-synj/';
            } else {
                const msg = result?.error?.code === 'RATE_LIMIT'
                    ? 'Trop de tentatives. Veuillez patienter 15 minutes.'
                    : (result?.error?.message || 'Erreur lors de la création du panier.');
                afficherErreur(msg);
                if (btn) { btn.disabled = false; btn.textContent = 'Commander'; }
            }
        } catch {
            afficherErreur('Erreur réseau. Veuillez réessayer.');
            if (btn) { btn.disabled = false; btn.textContent = 'Commander'; }
        }
    });
}

document.addEventListener('DOMContentLoaded', synj_initProduit);
