# Intégration WordPress → SYNJ Cloud API

**Version actuelle — mise à jour le 2026-05-29**

---

## Principe

```
Inscription / Connexion WordPress
        ↓
WordPress vérifie que l'API est disponible
        ↓ (si API down → login/inscription bloqué, message d'erreur affiché)
WordPress génère un payload signé HMAC-SHA256 (PHP)
        ↓
POST /auth/wordpress
        ↓
API retourne { accessToken, refreshToken, user }
        ↓
PHP stocke les tokens → JavaScript les récupère au chargement de la page
        ↓
Frontend utilise les tokens pour appeler les routes protégées
```

---

## Étape 1 — `wp-config.php`

```php
define('SYNJ_API_URL',          'http://100.113.174.49:3000'); // IP Tailscale du backend
define('SYNJ_WORDPRESS_SECRET', '70ff7f57a6d95966d56072ffd6896918');
```

---

## Étape 2 — `functions.php` (code complet à coller)

```php
<?php
// ─────────────────────────────────────────────
// SYNJ Cloud — Intégration API
// ─────────────────────────────────────────────

/**
 * Génère un payload signé HMAC-SHA256.
 * Utilisé pour login, inscription et déconnexion.
 */
function synj_generate_auth_payload(WP_User $user): array {
    $wordpress_id = (int) $user->ID;
    $email        = $user->user_email;
    $first_name   = $user->first_name ?: $user->display_name;
    $last_name    = $user->last_name ?: '';
    $timestamp    = intval(microtime(true) * 1000);

    $signature = hash_hmac(
        'sha256',
        "{$wordpress_id}:{$email}:{$timestamp}",
        SYNJ_WORDPRESS_SECRET
    );

    return compact('wordpress_id', 'email', 'first_name', 'last_name', 'timestamp', 'signature');
}

/**
 * Appelle l'API et stocke les tokens.
 * Retourne true si succès, WP_Error si l'API est indisponible ou renvoie une erreur.
 */
function synj_call_auth_api(WP_User $user): true|WP_Error {
    $payload  = synj_generate_auth_payload($user);
    $response = wp_remote_post(SYNJ_API_URL . '/auth/wordpress', [
        'headers' => ['Content-Type' => 'application/json'],
        'body'    => wp_json_encode($payload),
        'timeout' => 10,
    ]);

    // Erreur réseau ou timeout → API injoignable
    if (is_wp_error($response)) {
        error_log('[SYNJ] API injoignable: ' . $response->get_error_message());
        return new WP_Error(
            'synj_api_unavailable',
            'Service temporairement indisponible. Veuillez réessayer dans quelques instants.'
        );
    }

    $status = wp_remote_retrieve_response_code($response);
    $body   = json_decode(wp_remote_retrieve_body($response), true);

    // Erreur retournée par l'API
    if ($status !== 200 || !isset($body['accessToken'])) {
        $message = $body['error']['message'] ?? 'Erreur d\'authentification.';
        error_log('[SYNJ] Erreur API (' . $status . '): ' . $message);
        return new WP_Error('synj_api_error', $message);
    }

    // Stocker les tokens 60s le temps que la page suivante charge
    set_transient('synj_tokens_' . $user->ID, [
        'accessToken'  => $body['accessToken'],
        'refreshToken' => $body['refreshToken'],
    ], 60);

    return true;
}

/**
 * CONNEXION — se déclenche après vérification du mot de passe, avant création de session.
 * Si l'API est down : bloque la connexion et affiche une erreur.
 */
function synj_authenticate_user(WP_User|WP_Error $user, string $password): WP_User|WP_Error {
    if (is_wp_error($user)) return $user; // Déjà en erreur (mauvais mdp etc.), ne pas interférer

    $result = synj_call_auth_api($user);
    if (is_wp_error($result)) return $result; // Bloque la connexion

    return $user;
}
add_filter('wp_authenticate_user', 'synj_authenticate_user', 10, 2);

/**
 * INSCRIPTION — vérifie que l'API est disponible avant de créer le compte.
 * Couvre les formulaires natifs WordPress ET WooCommerce.
 */
function synj_check_api_available(): bool {
    $health = wp_remote_get(SYNJ_API_URL . '/health', ['timeout' => 5]);
    return !is_wp_error($health) && wp_remote_retrieve_response_code($health) === 200;
}

// Formulaire natif WordPress
function synj_check_api_before_register(WP_Error $errors): WP_Error {
    if (!synj_check_api_available()) {
        $errors->add(
            'synj_api_unavailable',
            '<strong>Erreur</strong> : Inscription impossible, service temporairement indisponible. Réessayez dans quelques instants.'
        );
    }
    return $errors;
}
add_filter('registration_errors', 'synj_check_api_before_register');

// Formulaire WooCommerce
function synj_check_api_before_woo_register(WP_Error $errors): WP_Error {
    if (!synj_check_api_available()) {
        $errors->add(
            'synj_api_unavailable',
            'Inscription impossible : service temporairement indisponible. Réessayez dans quelques instants.'
        );
    }
    return $errors;
}
add_filter('woocommerce_registration_errors', 'synj_check_api_before_woo_register');

/**
 * INSCRIPTION — après création du compte, appelle l'API pour enregistrer l'utilisateur.
 */
function synj_on_user_register(int $user_id): void {
    $user = get_userdata($user_id);
    if (!$user) return;

    $result = synj_call_auth_api($user);
    if (is_wp_error($result)) {
        error_log('[SYNJ] Échec sync après inscription user_id=' . $user_id . ': ' . $result->get_error_message());
    }
}
add_action('user_register', 'synj_on_user_register', 10, 1);

/**
 * DÉCONNEXION — révoque le refresh token côté API.
 * Utilise un payload signé, pas de session PHP nécessaire.
 */
function synj_on_wp_logout(int $user_id): void {
    $user = get_userdata($user_id);
    if (!$user) return;

    $payload = synj_generate_auth_payload($user);

    wp_remote_post(SYNJ_API_URL . '/auth/logout-wp', [
        'headers' => ['Content-Type' => 'application/json'],
        'body'    => wp_json_encode($payload),
        'timeout' => 5,
    ]);

    delete_transient('synj_tokens_' . $user_id);
}
add_action('wp_logout', 'synj_on_wp_logout', 10, 1);

/**
 * Injecte les tokens dans le HTML pour que le JavaScript les récupère.
 * Consommé une seule fois après login/inscription.
 */
function synj_inject_tokens_in_js(): void {
    if (!is_user_logged_in()) return;

    $user_id = get_current_user_id();
    $tokens  = get_transient('synj_tokens_' . $user_id);
    if (!$tokens) return;

    delete_transient('synj_tokens_' . $user_id);

    $access  = esc_js($tokens['accessToken']);
    $refresh = esc_js($tokens['refreshToken']);

    echo "<script>
        window.__SYNJ_ACCESS_TOKEN__  = '{$access}';
        window.__SYNJ_REFRESH_TOKEN__ = '{$refresh}';
    </script>\n";
}
add_action('wp_head', 'synj_inject_tokens_in_js', 1); // priorité 1 — doit s'exécuter avant les scripts (priorité 8)
```

---

## Étape 3 — JavaScript frontend (récupérer les tokens)

```javascript
// ─── À exécuter au chargement de chaque page ───────────────────

// 1. Si PHP vient d'injecter de nouveaux tokens → les sauvegarder
if (window.__SYNJ_ACCESS_TOKEN__) {
    sessionStorage.setItem('synj_access',  window.__SYNJ_ACCESS_TOKEN__);
    sessionStorage.setItem('synj_refresh', window.__SYNJ_REFRESH_TOKEN__);
    delete window.__SYNJ_ACCESS_TOKEN__;
    delete window.__SYNJ_REFRESH_TOKEN__;
}

// 2. Charger les tokens depuis sessionStorage (survit aux changements de page)
window.__synj = {
    get accessToken()  { return sessionStorage.getItem('synj_access');  },
    get refreshToken() { return sessionStorage.getItem('synj_refresh'); },
    set accessToken(v)  { sessionStorage.setItem('synj_access', v);  },
    set refreshToken(v) { sessionStorage.setItem('synj_refresh', v); },
    clear() {
        sessionStorage.removeItem('synj_access');
        sessionStorage.removeItem('synj_refresh');
    },
    get isLoggedIn() { return !!sessionStorage.getItem('synj_access'); },
};

// ─── Appel d'une route protégée ────────────────────────────────

async function apiCall(method, path, body = null) {
    const res = await fetch(`http://100.113.174.49:3000${path}`, {
        method,
        headers: {
            'Content-Type':  'application/json',
            'Authorization': `Bearer ${window.__synj.accessToken}`,
        },
        body: body ? JSON.stringify(body) : undefined,
    });

    // Token expiré → refresh automatique puis on relance
    if (res.status === 401) {
        const data = await res.json();
        if (data.error?.code === 'TOKEN_INVALID') {
            const refreshed = await refreshTokens();
            if (!refreshed) return null; // refresh échoué → déconnexion
            return apiCall(method, path, body); // relance
        }
    }

    return res.json();
}

async function refreshTokens() {
    const res = await fetch('http://100.113.174.49:3000/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: window.__synj.refreshToken }),
    });
    const data = await res.json();
    if (data.accessToken) {
        window.__synj.accessToken  = data.accessToken;
        window.__synj.refreshToken = data.refreshToken;
        return true;
    }
    // Refresh échoué → nettoyer et rediriger vers login
    window.__synj.clear();
    window.location.href = '/connexion';
    return false;
}
```

---

## Comportement selon l'état de l'API

| Situation | Connexion | Inscription |
|---|---|---|
| API disponible | ✅ Login autorisé, tokens émis | ✅ Compte créé, tokens émis |
| API down (réseau) | ❌ Bloqué — *"Service temporairement indisponible"* | ❌ Bloqué — *"Inscription impossible"* |
| API erreur 5xx | ❌ Bloqué — message d'erreur affiché | ❌ Bloqué — message d'erreur affiché |
| Déconnexion, API down | ⚠️ Déconnexion WordPress OK, token Redis non révoqué (expire seul en 7j) | — |

---

## Routes disponibles

### Auth
| Méthode | Route | Auth | Description |
|---|---|---|---|
| `POST` | `/auth/wordpress` | Non | Login / inscription via payload signé |
| `POST` | `/auth/logout-wp` | Non | Déconnexion via payload signé |
| `POST` | `/auth/refresh` | Non | Renouveler les tokens |
| `POST` | `/auth/logout` | Bearer token | Déconnexion depuis JS frontend |
| `GET` | `/auth/me` | Bearer token | Infos utilisateur connecté |
| `GET` | `/health` | Non | Vérifier si l'API est disponible |

### Produits (public)
| Méthode | Route | Auth | Description |
|---|---|---|---|
| `GET` | `/products` | Non | Liste des produits actifs (+ `?type=vpn\|vps\|nas`) |
| `GET` | `/products/:id` | Non | Détail d'un produit |
| `POST` | `/products/:id/calculate-price` | Non | Calcul de prix dynamique |

---

## Tests à faire depuis la console du navigateur

### Test 1 — Tokens présents après login
```javascript
console.log(window.__synj);
// Attendu : { accessToken: "eyJ...", refreshToken: "eyJ..." }
```

### Test 2 — Vérifier le token
```javascript
const res = await fetch('http://100.113.174.49:3000/auth/me', {
    headers: { 'Authorization': `Bearer ${window.__synj.accessToken}` }
});
console.log(await res.json());
// Attendu : { user: { id, wordpress_id, email, first_name, last_name, role, status } }
```

### Test 3 — Refresh
```javascript
const res = await fetch('http://100.113.174.49:3000/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: window.__synj.refreshToken })
});
const data = await res.json();
console.log(data);
// Attendu : { accessToken: "...", refreshToken: "..." }
window.__synj.accessToken  = data.accessToken;
window.__synj.refreshToken = data.refreshToken;
```

### Test 4 — Logout puis refresh (doit échouer)
```javascript
// 1. Se déconnecter de WordPress
// 2. Essayer de rafraîchir l'ancien token
const res = await fetch('http://100.113.174.49:3000/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: '<ancien_token>' })
});
console.log(await res.json());
// Attendu : { error: { code: "REFRESH_REVOKED", message: "Refresh token révoqué" } }
```

### Test 5 — Simuler API down (couper le backend, essayer de se connecter)
- Arrêter le serveur backend
- Tenter une connexion WordPress
- Attendu : message d'erreur *"Service temporairement indisponible"* sur la page de login

---

## Codes d'erreur

| Code | HTTP | Cause | Solution |
|---|---|---|---|
| `WP_SIGNATURE_INVALID` | 401 | `SYNJ_WORDPRESS_SECRET` incorrect | Vérifier que la valeur dans `wp-config.php` correspond au `.env` backend |
| `WP_TOKEN_EXPIRED` | 401 | Décalage d'horloge serveur > 5 min | Synchroniser l'horloge du serveur WordPress (`ntpdate`) |
| `WP_PAYLOAD_INVALID` | 400 | Champ manquant | Vérifier que l'utilisateur a un `user_email` valide |
| `VALIDATION_ERROR` | 400 | Format invalide | `wordpress_id` entier, `email` valide, `signature` 64 hex |
| `REFRESH_REVOKED` | 401 | Token révoqué (logout) | Redemander un login |
| `REFRESH_INVALID` | 401 | Token expiré > 7 jours | Redemander un login |
| `TOKEN_INVALID` | 401 | Access token expiré | Appeler `/auth/refresh` puis relancer |
| `UNAUTHORIZED` | 401 | Header `Authorization` absent | Ajouter `Authorization: Bearer <token>` |
