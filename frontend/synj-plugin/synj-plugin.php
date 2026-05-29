<?php
/**
 * Plugin Name: SYNJ Plugin
 * Plugin URI: https://synj.fr
 * Description: Plugin custom SYNJ
 * Version: 1.0.3
 * Author: George Khitaridze & Mohamed Amine Delhem
 */

if (!defined('ABSPATH')) exit;

// SYNJ_API_URL et SYNJ_WORDPRESS_SECRET doivent être définis dans wp-config.php :
// define('SYNJ_API_URL',          'http://100.113.174.49:3000');
// define('SYNJ_WORDPRESS_SECRET', '70ff7f57a6d95966d56072ffd6896918');

// -------------------------------------------------------------------
// Auth
// -------------------------------------------------------------------

function synj_generate_auth_payload(WP_User $user): array {
    $wordpress_id = (int) $user->ID;
    $email        = $user->user_email;
    $first_name   = $user->first_name ?: $user->display_name;
    $last_name    = $user->last_name  ?: '';
    $timestamp    = intval(microtime(true) * 1000);

    $signature = hash_hmac(
        'sha256',
        "{$wordpress_id}:{$email}:{$timestamp}",
        SYNJ_WORDPRESS_SECRET
    );

    return compact('wordpress_id', 'email', 'first_name', 'last_name', 'timestamp', 'signature');
}

// Appelle l'API et stocke les tokens — retourne true ou WP_Error
function synj_call_auth_api(WP_User $user): true|WP_Error {
    $payload  = synj_generate_auth_payload($user);
    $response = wp_remote_post(SYNJ_API_URL . '/auth/wordpress', [
        'headers' => ['Content-Type' => 'application/json'],
        'body'    => wp_json_encode($payload),
        'timeout' => 10,
    ]);

    if (is_wp_error($response)) {
        error_log('[SYNJ] API injoignable: ' . $response->get_error_message());
        return new WP_Error(
            'synj_api_unavailable',
            'Service temporairement indisponible. Veuillez réessayer dans quelques instants.'
        );
    }

    $status = wp_remote_retrieve_response_code($response);
    $body   = json_decode(wp_remote_retrieve_body($response), true);

    if ($status !== 200 || !isset($body['accessToken'])) {
        $message = $body['error']['message'] ?? 'Erreur d\'authentification.';
        error_log('[SYNJ] Erreur API (' . $status . '): ' . $message);
        return new WP_Error('synj_api_error', $message);
    }

    set_transient('synj_tokens_' . $user->ID, [
        'accessToken'  => $body['accessToken'],
        'refreshToken' => $body['refreshToken'],
    ], 60);

    return true;
}

// CONNEXION — bloque le login si l'API est down
function synj_authenticate_user(WP_User|WP_Error $user, string $password): WP_User|WP_Error {
    if (is_wp_error($user)) return $user;

    $result = synj_call_auth_api($user);
    if (is_wp_error($result)) return $result;

    return $user;
}
add_filter('wp_authenticate_user', 'synj_authenticate_user', 10, 2);

// Vérifie que l'API est disponible
function synj_check_api_available(): bool {
    $health = wp_remote_get(SYNJ_API_URL . '/health', ['timeout' => 5]);
    return !is_wp_error($health) && wp_remote_retrieve_response_code($health) === 200;
}

// INSCRIPTION — formulaire natif WordPress
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

// INSCRIPTION — formulaire WooCommerce
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

// INSCRIPTION — après création du compte, appelle l'API
function synj_on_user_register(int $user_id): void {
    $user = get_userdata($user_id);
    if (!$user) return;

    $result = synj_call_auth_api($user);
    if (is_wp_error($result)) {
        error_log('[SYNJ] Échec sync après inscription user_id=' . $user_id . ': ' . $result->get_error_message());
    }
}
add_action('user_register', 'synj_on_user_register', 10, 1);

// DÉCONNEXION — révoque le refresh token via payload signé
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

// Injecte les tokens dans le <head> — consommé une seule fois après login/inscription
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
add_action('wp_head', 'synj_inject_tokens_in_js', 1); // priorité 1 — avant les scripts (priorité 8)

// -------------------------------------------------------------------
// Page admin — Gestion des produits
// -------------------------------------------------------------------

function synj_admin_menu(): void {
    add_menu_page(
        'SYNJ Produits',
        'SYNJ Produits',
        'manage_options',
        'synj-products',
        'synj_admin_products_page',
        'dashicons-cart',
        30
    );
}
add_action('admin_menu', 'synj_admin_menu');

function synj_admin_products_page(): void {
    if (!current_user_can('manage_options')) return;
    ?>
    <div class="wrap">
        <h1>SYNJ — Gestion des produits</h1>
        <div id="synj-admin-app">Chargement...</div>
    </div>
    <?php
}

function synj_enqueue_admin_script(string $hook): void {
    if ($hook !== 'toplevel_page_synj-products') return;

    // synj-auth.js nécessaire pour window.__synj sur les pages admin
    wp_enqueue_script(
        'synj-auth-admin',
        plugin_dir_url(__FILE__) . 'js/synj-auth.js',
        [],
        '1.0.3',
        false
    );
    wp_add_inline_script('synj-auth-admin', 'window.__SYNJ_API_BASE = ' . json_encode(SYNJ_API_URL) . ';', 'before');

    wp_enqueue_script(
        'synj-admin',
        plugin_dir_url(__FILE__) . 'js/synj-admin.js',
        ['synj-auth-admin'],
        '1.0.3',
        true
    );
}
add_action('admin_enqueue_scripts', 'synj_enqueue_admin_script');

// Injecte les tokens dans le <head> admin aussi (login admin → tokens disponibles)
add_action('admin_head', 'synj_inject_tokens_in_js', 1);

// -------------------------------------------------------------------
// Routes REST WordPress (endpoints publics proxifiés)
// -------------------------------------------------------------------

function synj_enregistrer_routes() {
    register_rest_route('synj/v1', '/memory', [
        'methods'             => 'GET',
        'callback'            => fn() => synj_proxy_api('/availability/memory'),
        'permission_callback' => '__return_true',
    ]);

    register_rest_route('synj/v1', '/cpu', [
        'methods'             => 'GET',
        'callback'            => fn() => synj_proxy_api('/availability/cpu'),
        'permission_callback' => '__return_true',
    ]);

    register_rest_route('synj/v1', '/storage', [
        'methods'             => 'GET',
        'callback'            => fn() => synj_proxy_api('/availability/storage'),
        'permission_callback' => '__return_true',
    ]);

    register_rest_route('synj/v1', '/products/(?P<id>[a-z-]+)/options', [
        'methods'             => 'GET',
        'callback'            => function ($request) {
            return synj_proxy_api('/products/' . $request->get_param('id') . '/options');
        },
        'permission_callback' => '__return_true',
    ]);
}
add_action('rest_api_init', 'synj_enregistrer_routes');

function synj_proxy_api(string $endpoint): array {
    $response = wp_remote_get(SYNJ_API_URL . $endpoint, [
        'headers' => ['Content-Type' => 'application/json'],
        'timeout' => 10,
    ]);

    if (is_wp_error($response)) {
        error_log('[SYNJ] Proxy erreur : ' . $response->get_error_message());
        return ['error' => true, 'message' => $response->get_error_message()];
    }

    return json_decode(wp_remote_retrieve_body($response), true) ?? [];
}

// -------------------------------------------------------------------
// Chargement du script produit
// -------------------------------------------------------------------

function synj_charger_scripts() {
    // synj-auth.js chargé sur toutes les pages (dans <head>) — initialise window.__synj
    wp_enqueue_script(
        'synj-auth',
        plugin_dir_url(__FILE__) . 'js/synj-auth.js',
        [],
        '1.0.3',
        false // <head>, pas en footer
    );
    wp_localize_script('synj-auth', '__SYNJ_CONFIG', [
        'apiBase' => SYNJ_API_URL,
    ]);
    // Injecte window.__SYNJ_API_BASE pour synj-auth.js
    wp_add_inline_script('synj-auth', 'window.__SYNJ_API_BASE = ' . json_encode(SYNJ_API_URL) . ';', 'before');

    // synj-prix.js chargé uniquement sur les pages produit
    if (is_product()) {
        wp_enqueue_script(
            'synj-prix',
            plugin_dir_url(__FILE__) . 'js/synj-prix.js',
            ['synj-auth'],
            '1.0.3',
            true
        );
        wp_localize_script('synj-prix', 'SYNJ_CONFIG', [
            'apiBase' => SYNJ_API_URL,
        ]);
    }
}
add_action('wp_enqueue_scripts', 'synj_charger_scripts');

// -------------------------------------------------------------------
// WooCommerce — configuration panier
// -------------------------------------------------------------------

function synj_sauvegarder_config($cart_item_data, $product_id) {
    if (isset($_POST['synj_ram']))      $cart_item_data['synj_ram']      = floatval($_POST['synj_ram']);
    if (isset($_POST['synj_cpu']))      $cart_item_data['synj_cpu']      = floatval($_POST['synj_cpu']);
    if (isset($_POST['synj_stockage'])) $cart_item_data['synj_stockage'] = floatval($_POST['synj_stockage']);
    if (isset($_POST['synj_prix']))     $cart_item_data['synj_prix']     = floatval($_POST['synj_prix']);
    if (isset($_POST['synj_os']))       $cart_item_data['synj_os']       = sanitize_text_field($_POST['synj_os']);
    return $cart_item_data;
}
add_filter('woocommerce_add_cart_item_data', 'synj_sauvegarder_config', 10, 2);

function synj_appliquer_prix($cart) {
    if (is_admin() && !defined('DOING_AJAX')) return;
    foreach ($cart->get_cart() as $item) {
        if (isset($item['synj_prix']) && $item['synj_prix'] > 0) {
            $item['data']->set_price($item['synj_prix']);
        }
    }
}
add_action('woocommerce_before_calculate_totals', 'synj_appliquer_prix', 10, 1);

function synj_afficher_specs_panier($item_data, $cart_item) {
    if (isset($cart_item['synj_ram'])      && $cart_item['synj_ram']      > 0)
        $item_data[] = ['name' => 'RAM',      'value' => $cart_item['synj_ram']      . ' Go'];
    if (isset($cart_item['synj_cpu'])      && $cart_item['synj_cpu']      > 0)
        $item_data[] = ['name' => 'CPU',      'value' => $cart_item['synj_cpu']      . ' cœur(s)'];
    if (isset($cart_item['synj_stockage']) && $cart_item['synj_stockage'] > 0)
        $item_data[] = ['name' => 'Stockage', 'value' => $cart_item['synj_stockage'] . ' Go'];
    if (isset($cart_item['synj_os'])       && !empty($cart_item['synj_os']))
        $item_data[] = ['name' => 'OS',       'value' => $cart_item['synj_os']];
    return $item_data;
}
add_filter('woocommerce_get_item_data', 'synj_afficher_specs_panier', 10, 2);

// -------------------------------------------------------------------
// Shortcode disponibilités
// -------------------------------------------------------------------

function synj_disponibilites_shortcode() {
    ob_start();
    ?>
    <div id="synj-dispo" style="font-family:Arial; max-width:900px;">
        <h2 style="color:#1e3a5f;">Disponibilités serveur en temps réel</h2>
        <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:16px; margin-bottom:24px;">
            <div class="synj-widget">
                <div class="synj-label">RAM disponible</div>
                <div class="synj-value" id="synj-ram-val">—</div>
                <div class="synj-bar-bg"><div class="synj-bar" id="synj-ram-bar"></div></div>
                <div class="synj-pct" id="synj-ram-pct">—</div>
            </div>
            <div class="synj-widget">
                <div class="synj-label">CPU disponible</div>
                <div class="synj-value" id="synj-cpu-val">—</div>
                <div class="synj-bar-bg"><div class="synj-bar" id="synj-cpu-bar"></div></div>
                <div class="synj-pct" id="synj-cpu-pct">—</div>
            </div>
            <div class="synj-widget">
                <div class="synj-label">Stockage disponible</div>
                <div class="synj-value" id="synj-stockage-val">—</div>
                <div class="synj-bar-bg"><div class="synj-bar" id="synj-stockage-bar"></div></div>
                <div class="synj-pct" id="synj-stockage-pct">—</div>
            </div>
        </div>
        <p style="font-size:12px; color:#9ca3af;" id="synj-last-update">Dernière mise à jour : —</p>
    </div>
    <style>
    .synj-widget { background:#fff; border:1px solid #e5e7eb; border-radius:10px; padding:16px; box-shadow:0 1px 4px rgba(0,0,0,0.05); }
    .synj-label  { font-size:11px; color:#6b7280; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:8px; }
    .synj-value  { font-size:26px; font-weight:bold; color:#1e3a5f; margin-bottom:8px; }
    .synj-bar-bg { background:#f3f4f6; border-radius:99px; height:8px; }
    .synj-bar    { height:8px; border-radius:99px; transition:width 0.5s ease; width:0%; }
    .synj-pct    { font-size:12px; margin-top:6px; }
    </style>
    <script>
    async function synj_fetchDispo() {
        try {
            const [ram, cpu, stockage] = await Promise.all([
                fetch('/wp-json/synj/v1/memory').then(r => r.json()),
                fetch('/wp-json/synj/v1/cpu').then(r => r.json()),
                fetch('/wp-json/synj/v1/storage').then(r => r.json()),
            ]);

            const ramDispoGo = (ram.available_memory / 1073741824).toFixed(2);
            const ramTotalGo = (ram.total_memory / 1073741824).toFixed(2);
            const ramUsedGo  = (ram.used_memory / 1073741824).toFixed(2);
            const ramPct     = ((ram.free_memory / ram.total_memory) * 100).toFixed(1);
            const ramColor   = ramPct < 10 ? '#ef4444' : ramPct < 30 ? '#f59e0b' : '#22c55e';
            document.getElementById('synj-ram-val').textContent = ramDispoGo + ' / ' + ramTotalGo + ' Go';
            document.getElementById('synj-ram-bar').style.width      = ramPct + '%';
            document.getElementById('synj-ram-bar').style.background  = ramColor;
            document.getElementById('synj-ram-pct').textContent = ramPct + '% libre (' + ramUsedGo + ' Go utilisés)';
            document.getElementById('synj-ram-pct').style.color  = ramColor;

            const cpuUsage = (parseFloat(cpu.available_cpu) * 100).toFixed(1);
            const cpuDispo = (100 - cpuUsage).toFixed(1);
            const cpuColor = cpuDispo < 15 ? '#ef4444' : cpuDispo < 40 ? '#f59e0b' : '#22c55e';
            document.getElementById('synj-cpu-val').textContent = cpuDispo + '%';
            document.getElementById('synj-cpu-bar').style.width      = cpuDispo + '%';
            document.getElementById('synj-cpu-bar').style.background  = cpuColor;
            document.getElementById('synj-cpu-pct').textContent = cpuDispo + '% disponible';
            document.getElementById('synj-cpu-pct').style.color  = cpuColor;

            const storDispoGo = (stockage.available_storage / 1073741824).toFixed(2);
            const storTotalGo = (stockage.total_storage / 1073741824).toFixed(2);
            const storPct     = ((stockage.available_storage / stockage.total_storage) * 100).toFixed(1);
            const storColor   = storDispoGo < 20 ? '#ef4444' : storDispoGo < 50 ? '#f59e0b' : '#22c55e';
            document.getElementById('synj-stockage-val').textContent = storDispoGo + ' / ' + storTotalGo + ' Go';
            document.getElementById('synj-stockage-bar').style.width      = storPct + '%';
            document.getElementById('synj-stockage-bar').style.background  = storColor;
            document.getElementById('synj-stockage-pct').textContent = storPct + '% disponible';
            document.getElementById('synj-stockage-pct').style.color  = storColor;

            document.getElementById('synj-last-update').textContent =
                'Dernière mise à jour : ' + new Date().toLocaleTimeString('fr-FR');
        } catch(err) {
            console.error('Erreur API SYNJ:', err);
        }
    }
    synj_fetchDispo();
    setInterval(synj_fetchDispo, 30000);
    </script>
    <?php
    return ob_get_clean();
}
add_shortcode('synj_disponibilites', 'synj_disponibilites_shortcode');
