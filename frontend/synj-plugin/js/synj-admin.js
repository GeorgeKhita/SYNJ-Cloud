// SYNJ — Interface admin gestion des produits

const API = window.__SYNJ_API_BASE;

async function apiAdmin(method, path, body = null) {
    const res = await fetch(API + path, {
        method,
        headers: {
            'Content-Type':  'application/json',
            'Authorization': `Bearer ${window.__synj.accessToken}`,
        },
        body: body ? JSON.stringify(body) : undefined,
    });
    return res.json();
}

async function renderProducts() {
    const { products } = await apiAdmin('GET', '/products/admin/all');
    const app = document.getElementById('synj-admin-app');
    if (!products?.length) {
        app.innerHTML = '<p>Aucun produit.</p>' + renderCreateForm();
        return;
    }

    const rows = products.map(p => `
        <tr>
            <td>${p.id}</td>
            <td>${p.name}</td>
            <td>${p.type}</td>
            <td>${p.base_price} €</td>
            <td><span style="color:${p.status === 'active' ? 'green' : 'red'}">${p.status}</span></td>
            <td>
                <button onclick="editProduct(${p.id})">Modifier</button>
                <button onclick="deleteProduct(${p.id})" style="color:red">Supprimer</button>
            </td>
        </tr>
    `).join('');

    app.innerHTML = `
        <table class="wp-list-table widefat">
            <thead><tr><th>ID</th><th>Nom</th><th>Type</th><th>Prix base</th><th>Statut</th><th>Actions</th></tr></thead>
            <tbody>${rows}</tbody>
        </table>
        <hr>
        <h2>Ajouter un produit</h2>
        ${renderCreateForm()}
    `;
}

function renderCreateForm(product = {}) {
    return `
        <form id="synj-product-form" onsubmit="submitProduct(event, ${product.id ?? 'null'})">
            <table class="form-table">
                <tr><th>Nom</th><td><input name="name" value="${product.name ?? ''}" required></td></tr>
                <tr><th>Slug</th><td><input name="slug" value="${product.slug ?? ''}" placeholder="ex: vps-standard" required></td></tr>
                <tr><th>Type</th><td>
                    <select name="type">
                        <option value="vps" ${product.type === 'vps' ? 'selected' : ''}>VPS</option>
                        <option value="vpn" ${product.type === 'vpn' ? 'selected' : ''}>VPN</option>
                        <option value="nas" ${product.type === 'nas' ? 'selected' : ''}>NAS</option>
                    </select>
                </td></tr>
                <tr><th>Description</th><td><textarea name="description">${product.description ?? ''}</textarea></td></tr>
                <tr><th>Prix de base (€)</th><td><input type="number" step="0.01" name="base_price" value="${product.base_price ?? 0}" required></td></tr>
                <tr><th>pricing_config (JSON)</th><td>
                    <textarea name="pricing_config" rows="4" required>${product.pricing_config ? JSON.stringify(product.pricing_config, null, 2) : '{\n  "cpu": 3.00,\n  "ram_gb": 2.50,\n  "storage_gb": 0.10\n}'}</textarea>
                </td></tr>
                <tr><th>resource_config (JSON)</th><td>
                    <textarea name="resource_config" rows="8" required>${product.resource_config ? JSON.stringify(product.resource_config, null, 2) : '{\n  "cpu":        {"min":1,"max":8,"step":1,"label":"vCPU"},\n  "ram_gb":     {"min":1,"max":32,"step":1,"label":"RAM (Go)"},\n  "storage_gb": {"min":20,"max":500,"step":10,"label":"Stockage (Go)"}\n}'}</textarea>
                </td></tr>
                <tr><th>Template Proxmox ID</th><td><input type="number" name="template_id" value="${product.template_id ?? ''}"></td></tr>
                <tr><th>Nœud Proxmox</th><td><input name="proxmox_node" value="${product.proxmox_node ?? ''}"></td></tr>
            </table>
            <button type="submit" class="button button-primary">${product.id ? 'Enregistrer' : 'Créer'}</button>
            ${product.id ? '<button type="button" class="button" onclick="renderProducts()">Annuler</button>' : ''}
        </form>
    `;
}

async function submitProduct(event, id) {
    event.preventDefault();
    const form = event.target;
    const data = {
        name:            form.name.value,
        slug:            form.slug.value,
        type:            form.type.value,
        description:     form.description.value || undefined,
        base_price:      parseFloat(form.base_price.value),
        pricing_config:  JSON.parse(form.pricing_config.value),
        resource_config: JSON.parse(form.resource_config.value),
        template_id:     form.template_id.value ? parseInt(form.template_id.value) : undefined,
        proxmox_node:    form.proxmox_node.value || undefined,
    };

    const method = id ? 'PATCH' : 'POST';
    const path   = id ? `/products/${id}` : '/products';
    const result = await apiAdmin(method, path, data);

    if (result.product) {
        alert(id ? 'Produit mis à jour !' : 'Produit créé !');
        renderProducts();
    } else {
        alert('Erreur : ' + (result.error?.message ?? 'inconnue'));
    }
}

async function editProduct(id) {
    const { product } = await apiAdmin('GET', `/products/${id}`);
    document.getElementById('synj-admin-app').innerHTML =
        '<h2>Modifier le produit</h2>' + renderCreateForm(product);
}

async function deleteProduct(id) {
    if (!confirm('Désactiver ce produit ?')) return;
    await apiAdmin('DELETE', `/products/${id}`);
    renderProducts();
}

if (document.getElementById('synj-admin-app')) {
    renderProducts();
}
