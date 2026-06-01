// SYNJ — Page checkout custom (/checkout-synj/)

function viderSessionCart() {
    ['synj_cart_id', 'synj_cart_product_url'].forEach(k => sessionStorage.removeItem(k));
}

// -------------------------------------------------------------------
// Panier expiré
// -------------------------------------------------------------------

function afficherPanierExpire() {
    viderSessionCart();
    const recap = document.getElementById('synj-recap');
    if (recap) recap.innerHTML =
        '<p style="color:#dc2626;font-weight:600;">⚠️ Votre panier a expiré.</p>'
        + '<a href="/product-category/serveurs/" class="button">Reconfigurer</a>';
}

// -------------------------------------------------------------------
// Timer
// -------------------------------------------------------------------

function lancerTimer(expiresAt) {
    const el = document.getElementById('synj-timer');
    if (!el) return;

    const interval = setInterval(() => {
        const reste = Math.floor((new Date(expiresAt) - Date.now()) / 1000);
        if (reste <= 0) {
            clearInterval(interval);
            afficherPanierExpire();
            return;
        }
        const min = Math.floor(reste / 60);
        const sec = reste % 60;
        el.textContent = `${min}:${sec.toString().padStart(2, '0')}`;
    }, 1000);
}

// -------------------------------------------------------------------
// Affichage du récapitulatif
// -------------------------------------------------------------------

function afficherRecap(cart) {
    const totalEl = document.getElementById('synj-recap-total');
    if (totalEl) totalEl.textContent = cart.total.toFixed(2) + ' ' + cart.currency;

    const listEl = document.getElementById('synj-recap-items');
    if (!listEl) return;

    listEl.innerHTML = cart.items.map(item => `
        <div class="synj-item" style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid #e5e7eb;">
            <div>
                <strong>${item.productName}</strong><br>
                <small style="color:#6b7280;">${Object.entries(item.resources).map(([k, v]) => `${k}: ${v}`).join(' · ')}</small>
            </div>
            <div style="display:flex; align-items:center; gap:12px;">
                <span style="font-weight:600;">${item.price.toFixed(2)} €</span>
                <button data-synj-item-id="${item.itemId}" style="background:#fee2e2; color:#dc2626; border:none; border-radius:4px; padding:4px 10px; cursor:pointer;">✕</button>
            </div>
        </div>
    `).join('');

    listEl.querySelectorAll('[data-synj-item-id]').forEach(btn => {
        btn.addEventListener('click', function () {
            supprimerItem(this.dataset.synjItemId);
        });
    });
}

// -------------------------------------------------------------------
// Supprimer un article
// -------------------------------------------------------------------

async function supprimerItem(itemId) {
    const result = await apiCall('DELETE', `/cart/items/${itemId}`);
    if (!result || result.error) return;

    if (result.released) {
        viderSessionCart();
        window.location.href = sessionStorage.getItem('synj_cart_product_url') || '/product-category/serveurs/';
        return;
    }

    afficherRecap(result);
}

// -------------------------------------------------------------------
// Vider tout le panier (bouton Annuler)
// -------------------------------------------------------------------

function setupBoutonAnnuler() {
    const btn = document.getElementById('synj-btn-annuler');
    if (!btn) return;

    btn.addEventListener('click', async function () {
        this.disabled    = true;
        this.textContent = 'Annulation...';

        await apiCall('DELETE', '/cart');
        const productUrl = sessionStorage.getItem('synj_cart_product_url');
        viderSessionCart();

        window.location.href = productUrl || '/product-category/serveurs/';
    });
}

// -------------------------------------------------------------------
// Chargement du panier au démarrage
// -------------------------------------------------------------------

async function chargerPanier() {
    const data = await apiCall('GET', '/cart');

    if (!data?.cart) {
        afficherPanierExpire();
        return;
    }

    afficherRecap(data.cart);
    lancerTimer(new Date(data.cart.expiresAt));
    setupBoutonAnnuler();
}

// -------------------------------------------------------------------
// Init
// -------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', chargerPanier);
