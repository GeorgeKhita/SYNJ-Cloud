# Intégration WordPress / WooCommerce ↔ Backend SYNJ

---

## ⚠️ MIGRATION OBLIGATOIRE — Lire en premier

Le backend a été entièrement refactorisé. Il ne gère plus l'authentification, les produits, ni les paiements. Tout ce qui touchait à ces sujets **doit être supprimé ou réécrit** côté WordPress. Ce document liste exactement ce qu'il faut changer, fichier par fichier.

---

## 1. Ce qui a changé — vue d'ensemble

| Avant | Maintenant |
|-------|------------|
| Backend gère auth (JWT, refresh tokens) | **Supprimé** — WordPress gère ses sessions tout seul |
| Backend gère le catalogue produits | **Supprimé** — WooCommerce gère les produits |
| Backend calcule les prix | **Supprimé** — calcul en JS local dans la page |
| Backend gère les paniers en BDD | **Supprimé** — WooCommerce gère le panier |
| Backend gère Stripe | **Supprimé** — WooCommerce gère le paiement |
| Authentification via Bearer token JWT | **Remplacé** par une API Key fixe dans le header `X-API-Key` |
| `/auth/wordpress` | **N'existe plus** |
| `/auth/logout-wp` | **N'existe plus** |
| `/auth/refresh` | **N'existe plus** |
| `/products` | **N'existe plus** |
| `/products/:id/calculate-price` | **N'existe plus** |
| `/products/:id/options` | **N'existe plus** |
| `/cart` (panier BDD) | **N'existe plus** |
| `/orders` | **N'existe plus** |
| `/webhook` (Stripe) | **N'existe plus** |

---

## 2. Ce qu'il faut supprimer dans `synj-plugin.php`

### Supprimer — constante devenue inutile
```php
// SUPPRIMER cette ligne dans wp-config.php
define('SYNJ_WORDPRESS_SECRET', '70ff7f57a6d95966d56072ffd6896918');
```
Le backend ne vérifie plus de signature HMAC.

---

### Supprimer — toutes les fonctions d'authentification
Ces fonctions appellent des routes qui n'existent plus :

```php
// SUPPRIMER — génère un payload signé pour /auth/wordpress (route supprimée)
function synj_generate_auth_payload(WP_User $user): array { ... }

// SUPPRIMER — appelle /auth/wordpress (route supprimée)
function synj_call_auth_api(WP_User $user): true|WP_Error { ... }

// SUPPRIMER — bloque le login si l'API est down, utilisait synj_call_auth_api
function synj_authenticate_user(...) { ... }
add_filter('wp_authenticate_user', 'synj_authenticate_user', 10, 2);

// SUPPRIMER — appelait /auth/wordpress après inscription
function synj_on_user_register(int $user_id): void { ... }
add_action('user_register', 'synj_on_user_register', 10, 1);

// SUPPRIMER — appelait /auth/logout-wp (route supprimée)
function synj_on_wp_logout(int $user_id): void { ... }
add_action('wp_logout', 'synj_on_wp_logout', 10, 1);

// SUPPRIMER — injectait les tokens JWT dans le <head>
function synj_inject_tokens_in_js(): void { ... }
add_action('wp_head', 'synj_inject_tokens_in_js', 1);
```

---

### Supprimer — la route REST produits
```php
// SUPPRIMER ce register_rest_route — /products/:id/options n'existe plus
register_rest_route('synj/v1', '/products/(?P<id>[a-z-]+)/options', [
    'methods'  => 'GET',
    'callback' => function ($request) {
        return synj_proxy_api('/products/' . $request->get_param('id') . '/options');
    },
    ...
]);
```

---

### Modifier — ajouter X-API-Key dans le proxy
La fonction `synj_proxy_api` ne passe pas la clé API. Elle doit l'inclure dans tous les appels :

```php
// REMPLACER la fonction synj_proxy_api par celle-ci
function synj_proxy_api(string $endpoint): array {
    $response = wp_remote_get(SYNJ_API_URL . $endpoint, [
        'headers' => [
            'Content-Type' => 'application/json',
            'X-API-Key'    => get_option('synj_api_key'), // ← AJOUT OBLIGATOIRE
        ],
        'timeout' => 10,
    ]);

    if (is_wp_error($response)) return ['error' => true];
    return json_decode(wp_remote_retrieve_body($response), true) ?? [];
}
```

---

### Modifier — injecter l'API Key pour synj-prix.js
`synj-prix.js` a besoin de `window.__SYNJ_API_KEY` pour appeler `/availability/check`. Ajouter dans `synj_charger_scripts()` :

```php
// AJOUTER dans la fonction synj_charger_scripts(), dans le bloc if (is_product())
wp_add_inline_script(
    'synj-prix',
    'window.__SYNJ_API_KEY = ' . json_encode(get_option('synj_api_key')) . ';',
    'before'
);

// ET injecter les données produit pour les paliers dynamiques
$product_id = get_queried_object_id();
wp_localize_script('synj-prix', '__SYNJ_PRODUCT', [
    'type'           => get_post_meta($product_id, 'synj_product_type', true),
    'templateId'     => (int)   get_post_meta($product_id, 'synj_template_id',   true),
    'basePrice'      => (float) get_post_meta($product_id, 'synj_base_price',    true),
    'pricingConfig'  => json_decode(get_post_meta($product_id, 'synj_pricing_config',  true), true),
    'resourceConfig' => json_decode(get_post_meta($product_id, 'synj_resource_config', true), true),
]);
```

---

### Modifier — noms des champs panier
Les champs cachés ont changé de nom (`synj_stockage` → `synj_storage_gb`, `synj_ram` → `synj_ram_gb`) :

```php
// REMPLACER synj_sauvegarder_config par :
function synj_sauvegarder_config($cart_item_data, $product_id) {
    if (isset($_POST['synj_cpu']))        $cart_item_data['synj_cpu']        = floatval($_POST['synj_cpu']);
    if (isset($_POST['synj_ram_gb']))     $cart_item_data['synj_ram_gb']     = floatval($_POST['synj_ram_gb']);
    if (isset($_POST['synj_storage_gb'])) $cart_item_data['synj_storage_gb'] = floatval($_POST['synj_storage_gb']);
    if (isset($_POST['synj_prix']))       $cart_item_data['synj_prix']       = floatval($_POST['synj_prix']);
    return $cart_item_data;
}

// REMPLACER synj_afficher_specs_panier par :
function synj_afficher_specs_panier($item_data, $cart_item) {
    if (!empty($cart_item['synj_cpu']))        $item_data[] = ['name' => 'CPU',      'value' => $cart_item['synj_cpu']        . ' cœur(s)'];
    if (!empty($cart_item['synj_ram_gb']))     $item_data[] = ['name' => 'RAM',      'value' => $cart_item['synj_ram_gb']     . ' Go'];
    if (!empty($cart_item['synj_storage_gb'])) $item_data[] = ['name' => 'Stockage', 'value' => $cart_item['synj_storage_gb'] . ' Go'];
    return $item_data;
}
```

---

### Ajouter — déclencher le provisioning après paiement

C'est la partie la plus importante. Après confirmation du paiement WooCommerce, il faut appeler le backend pour ouvrir le container. Ajouter ce hook :

```php
add_action('woocommerce_payment_complete', 'synj_declencher_provisioning');

function synj_declencher_provisioning(int $order_id): void {
    $order = wc_get_order($order_id);
    if (!$order) return;

    foreach ($order->get_items() as $item) {
        $product_id  = $item->get_product_id();
        $cart_meta   = $item->get_meta_data(); // récupère synj_cpu, synj_ram_gb, etc.

        $cpu        = (int)   $item->get_meta('synj_cpu');
        $ram_gb     = (int)   $item->get_meta('synj_ram_gb');
        $storage_gb = (int)   $item->get_meta('synj_storage_gb');
        $template_id = (int)  get_post_meta($product_id, 'synj_template_id',  true);
        $product_type =       get_post_meta($product_id, 'synj_product_type', true);

        $body = [
            'email'           => $order->get_billing_email(),
            'firstName'       => $order->get_billing_first_name(),
            'productType'     => $product_type,
            'templateId'      => $template_id,
            'externalOrderId' => 'WC-' . $order_id,
            'cartId'          => WC()->session?->get_customer_id() ?? '',
            'resources'       => [
                'cpu'        => $cpu,
                'ram_gb'     => $ram_gb,
                'storage_gb' => $storage_gb,
            ],
        ];

        $response = wp_remote_post(SYNJ_API_URL . '/provision', [
            'headers' => [
                'Content-Type' => 'application/json',
                'X-API-Key'    => get_option('synj_api_key'),
            ],
            'body'    => wp_json_encode($body),
            'timeout' => 15,
        ]);

        if (!is_wp_error($response)) {
            $data = json_decode(wp_remote_retrieve_body($response), true);
            if (!empty($data['serviceId'])) {
                // Sauvegarder le serviceId pour le polling côté client
                update_post_meta($order_id, 'synj_service_id', $data['serviceId']);
            }
        }
    }
}
```

---

### Ajouter — stocker la clé API dans les options WordPress

Ajouter dans ton panneau d'options WordPress (Settings > SYNJ ou similaire) :

```php
// Enregistrement de l'option
register_setting('synj_settings', 'synj_api_key');
register_setting('synj_settings', 'synj_api_base');

// Valeurs par défaut à configurer une fois en admin :
// synj_api_key  = d0132a0ee01b2efcdb40a82b18d41ed4da013c6283ead6afa6fc91bd4df1c3a9
// synj_api_base = http://100.113.174.49:3000
```

---

## 3. Ce qu'il faut supprimer dans `synj-auth.js`

**Ce fichier gère entièrement les tokens JWT qui n'existent plus.** Il faut soit le supprimer entièrement, soit ne garder que ce qui ne touche pas à l'auth.

```js
// SUPPRIMER — injecte et stocke les tokens JWT (plus de JWT)
if (window.__SYNJ_ACCESS_TOKEN__) { ... }

// SUPPRIMER — tout l'objet window.__synj (gérait les tokens)
window.__synj = { ... }

// SUPPRIMER — appelait /auth/refresh (route supprimée)
async function refreshTokens() { ... }

// SUPPRIMER — utilisait Bearer token pour les appels API
async function apiCall(method, path, body) { ... }
```

Les appels au backend ne passent plus par `apiCall()` avec un Bearer token. Ils passent par `fetch` avec le header `X-API-Key` directement. Voir la section 4 pour le nouveau pattern.

---

## 4. Ce qu'il faut supprimer dans `synj-admin.js`

**Ce fichier entier est obsolète.** Il gérait le catalogue produits côté backend (CRUD `/products`, `/products/admin/all`). Ces routes n'existent plus.

Les produits sont maintenant gérés directement dans WooCommerce. Le fichier `synj-admin.js` doit être supprimé et la page admin correspondante aussi.

---

## 5. Ce qu'il faut modifier dans `synj-prix.js`

Le fichier appelle deux routes qui n'existent plus :
- `GET /products` → pour récupérer `resource_config` et `pricing_config`
- `POST /products/:id/calculate-price` → pour calculer le prix

**Nouveau fonctionnement :** les données sont injectées par PHP via `wp_localize_script` (voir section 2), et le calcul de prix se fait en JavaScript sans appel réseau.

Le seul appel réseau qui reste dans `synj-prix.js` est `POST /availability/check` pour activer ou désactiver le bouton "Ajouter au panier".

Voici les deux parties à réécrire :

```js
// SUPPRIMER — récupérait le produit depuis le backend
const data = await fetch(window.__SYNJ_API_BASE + '/products').then(r => r.json());
produit = (data.products ?? []).find(...);

// REMPLACER PAR — lire les données injectées par PHP
const produit = window.__SYNJ_PRODUCT;
if (!produit?.resourceConfig) return;
```

```js
// SUPPRIMER — calculait le prix via le backend
const res = await fetch(window.__SYNJ_API_BASE + '/products/' + produit.id + '/calculate-price', {
    method: 'POST',
    body:   JSON.stringify({ resources }),
});

// REMPLACER PAR — calcul local
// Formule : base_price + (cpu × prix_cpu) + (ram_gb × prix_ram) + (storage_gb × prix_storage)
function calculerPrix(resources) {
    const pc   = window.__SYNJ_PRODUCT.pricingConfig;
    let   prix = window.__SYNJ_PRODUCT.basePrice ?? 0;
    if (resources.cpu        && pc.cpu)        prix += resources.cpu        * pc.cpu;
    if (resources.ram_gb     && pc.ram_gb)     prix += resources.ram_gb     * pc.ram_gb;
    if (resources.storage_gb && pc.storage_gb) prix += resources.storage_gb * pc.storage_gb;
    return prix.toFixed(2);
}
```

Et pour vérifier la disponibilité, utiliser `X-API-Key` au lieu du Bearer token :

```js
// REMPLACER — les appels fetch doivent utiliser X-API-Key, plus de Bearer token
const res = await fetch(window.__SYNJ_API_BASE + '/availability/check', {
    method:  'POST',
    headers: {
        'Content-Type': 'application/json',
        'X-API-Key':    window.__SYNJ_API_KEY,  // injecté par PHP
    },
    body: JSON.stringify(resources),
});
```

---

## 6. Meta WooCommerce à renseigner par produit

Chaque produit WooCommerce doit avoir ces 8 meta renseignées dans l'admin :

| Clé meta | Exemple | Description |
|----------|---------|-------------|
| `synj_product_type` | `vps` | Type : `vps`, `vpn` ou `nas` |
| `synj_template_id` | `101` | ID du template LXC sur Proxmox |
| `synj_base_price` | `12.00` | Prix de base mensuel en € |
| `synj_pricing_config` | `{"cpu":3.00,"ram_gb":3.00,"storage_gb":0.02}` | Prix ajouté par unité |
| `synj_resource_config` | voir ci-dessous | Paliers de configuration |
| `synj_cpu` | `2` | CPU par défaut (valeur fixe si pas de paliers) |
| `synj_ram_gb` | `4` | RAM par défaut en Go |
| `synj_storage_gb` | `50` | Stockage par défaut en Go |

**Exemple `synj_resource_config` pour un VPS :**
```json
{
  "cpu":        { "min": 1, "max": 8,   "step": 1,  "label": "CPU" },
  "ram_gb":     { "min": 2, "max": 32,  "step": 1,  "label": "RAM (Go)" },
  "storage_gb": { "min": 20,"max": 500, "step": 20, "label": "Stockage (Go)" }
}
```

**Exemple `synj_pricing_config` pour un VPS :**
```json
{ "cpu": 3.00, "ram_gb": 3.00, "storage_gb": 0.02 }
```

**Formule de calcul du prix :**
```
prix = base_price + (cpu × 3.00) + (ram_gb × 3.00) + (storage_gb × 0.02)
```
Exemple : 12€ + 2×3 + 4×3 + 50×0.02 = **31€/mois**

---

## 7. Les endpoints disponibles

### `GET /health`
Vérifie que le backend est en ligne. Pas besoin de X-API-Key.
```json
{ "status": "ok" }
```

---

### `POST /availability/check`
Vérifie si les ressources demandées sont disponibles, en tenant compte des réservations en cours.

**Quand l'appeler :** au chargement de la page produit et au clic sur "Ajouter au panier".

**Requête :**
```json
{ "cpu": 2, "ram_gb": 4, "storage_gb": 50 }
```
**Réponse dispo :** `{ "available": true }`

**Réponse indispo :**
```json
{ "available": false, "reason": "Ressources insuffisantes : ram_gb (disponible: 2, demandé: 4)" }
```

> Si Proxmox est injoignable, la réponse est toujours `{ "available": true }` — on ne bloque pas les ventes.

---

### `GET /availability/memory` / `GET /availability/cpu` / `GET /availability/storage`
Données brutes Proxmox. Utilisées par le shortcode `[synj_disponibilites]`. Ces routes nécessitent `X-API-Key` — le proxy PHP `synj_proxy_api` doit le passer (voir section 2).

---

### `POST /cart/reserve`
Réserve des ressources pour un panier pendant 15 minutes (anti-survente).

**Quand l'appeler :** au clic "Ajouter au panier" et à l'ouverture du checkout.

**Requête :**
```json
{
  "cartId": "wc_session_abc123",
  "resources": { "cpu": 2, "ram_gb": 4, "storage_gb": 50 }
}
```
**Réponse :** `{ "reserved": true, "expiresIn": 900 }`

**Si ressources insuffisantes (HTTP 409) :**
```json
{ "error": "...", "code": "CAPACITY_EXCEEDED" }
```

---

### `DELETE /cart/reserve/:cartId`
Libère la réservation d'un panier immédiatement.

**Quand l'appeler :** quand le client vide son panier ou abandonne le checkout.

```
DELETE /cart/reserve/wc_session_abc123
```
**Réponse :** `{ "released": true }`

---

### `POST /provision`
Lance l'ouverture d'un container. À appeler dans le hook `woocommerce_payment_complete`.

**Requête :**
```json
{
  "email":           "client@example.com",
  "firstName":       "Jean",
  "productType":     "vps",
  "templateId":      101,
  "externalOrderId": "WC-1234",
  "cartId":          "wc_session_abc123",
  "resources": { "cpu": 2, "ram_gb": 4, "storage_gb": 50 }
}
```

| Champ | D'où ça vient |
|-------|---------------|
| `email` | `$order->get_billing_email()` |
| `firstName` | `$order->get_billing_first_name()` |
| `productType` | Meta produit `synj_product_type` |
| `templateId` | Meta produit `synj_template_id` |
| `externalOrderId` | `"WC-" . $order->get_id()` |
| `cartId` | `WC()->session->get_customer_id()` |
| `resources` | Champs cachés du formulaire panier (`synj_cpu`, `synj_ram_gb`, `synj_storage_gb`) |

**Réponse (HTTP 202) :**
```json
{ "serviceId": 42, "status": "provisioning" }
```
Sauvegarder le `serviceId` : `update_post_meta($order_id, 'synj_service_id', 42)`

---

### `GET /provision/:serviceId/status`
Statut du provisioning. À poller toutes les 5 secondes côté client.

**En cours :** `{ "status": "provisioning" }`

**Succès :**
```json
{
  "status": "active",
  "access": { "ip": "192.168.1.50", "port": "22", "username": "root", "password": "xK9mP2qL" }
}
```

**Échec :** `{ "status": "failed", "reason": "..." }` → déclencher le remboursement WooCommerce

---

### `GET /services`
Liste les services actifs. Filtrable par email.

```
GET /services?email=client@example.com
```

---

## 8. Comportement attendu page par page

### Page produit
1. PHP injecte `__SYNJ_PRODUCT` et `__SYNJ_API_KEY` via `wp_localize_script`
2. `synj-prix.js` génère les selects à partir de `resourceConfig`
3. À chaque changement de select : appel `POST /availability/check` → bouton actif ou grisé
4. Prix calculé en local, affiché instantanément

**Si `available: false`** → bouton grisé + message *"Ce service est temporairement indisponible."*

### Ajout au panier
1. Vérification `POST /availability/check`
2. `POST /cart/reserve`
3. Si 409 → bloquer, afficher *"Ressources réservées par d'autres clients."*
4. Si OK → ajouter au panier WooCommerce normalement

### Checkout
- Rappeler `POST /cart/reserve` avec le même `cartId` pour renouveler les 15 min
- Si 409 → vider le panier, rediriger avec message d'erreur

### Abandon panier
- Appeler `DELETE /cart/reserve/:cartId`

### Après paiement
1. Hook `woocommerce_payment_complete` → `POST /provision`
2. Sauvegarder `serviceId` dans les meta commande
3. Afficher page d'attente avec polling `GET /provision/:serviceId/status` toutes les 5s
4. Timeout : 3 minutes maximum
5. `active` → afficher les accès + passer commande en "Terminée"
6. `failed` → rembourser + passer commande en "Échouée" + afficher message d'erreur

### Backend injoignable
- Page produit : bouton actif (fail-open)
- Ajout panier / checkout : message *"Service temporairement indisponible, réessayez."*
- Pendant polling : traiter comme `failed` après 3 minutes

---

## 9. Codes d'erreur HTTP

| Code | Quand | Quoi faire |
|------|-------|------------|
| `200` | OK | Traiter la réponse |
| `202` | Provisioning lancé | Commencer le polling |
| `400` | Champ manquant ou invalide | Vérifier les données envoyées |
| `401` | X-API-Key absente ou fausse | Vérifier `get_option('synj_api_key')` |
| `404` | serviceId inexistant | Logger l'erreur |
| `409` | Ressources insuffisantes (`CAPACITY_EXCEEDED`) | Bloquer l'action, afficher message client |
| `500` | Erreur interne backend | Afficher message générique, logger |
