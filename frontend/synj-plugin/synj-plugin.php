<?php
/**
 * Plugin Name: SYNJ Plugin
 * Plugin URI: https://synj.fr
 * Description: Plugin custom SYNJ
 * Version: 2.0.0
 * Author: George Khitaridze & Mohamed Amine Delhem
 */

if (!defined('ABSPATH')) exit;

// SYNJ_API_URL doit être défini dans wp-config.php :
// define('SYNJ_API_URL', 'http://100.113.174.49:3000');
//
// La clé API est stockée dans les options WordPress (Settings > SYNJ) :
// synj_api_key = d0132a0ee01b2efcdb40a82b18d41ed4da013c6283ead6afa6fc91bd4df1c3a9

// -------------------------------------------------------------------
// Page de réglages (Settings > SYNJ)
// -------------------------------------------------------------------

add_action('admin_menu', function () {
    add_options_page('SYNJ', 'SYNJ', 'manage_options', 'synj-settings', function () {
        ?>
        <div class="wrap">
            <h1>Réglages SYNJ</h1>
            <form method="post" action="options.php">
                <?php
                settings_fields('synj_settings');
                do_settings_sections('synj-settings');
                submit_button();
                ?>
            </form>
        </div>
        <?php
    });
});

add_action('admin_init', function () {
    register_setting('synj_settings', 'synj_api_key');
    register_setting('synj_settings', 'synj_api_base');

    add_settings_section('synj_main', 'Configuration API', null, 'synj-settings');

    add_settings_field('synj_api_key', 'Clé API (X-API-Key)', function () {
        $val = esc_attr(get_option('synj_api_key'));
        echo "<input type='text' name='synj_api_key' value='$val' style='width:500px;'>";
    }, 'synj-settings', 'synj_main');

    add_settings_field('synj_api_base', 'URL du backend', function () {
        $val = esc_attr(get_option('synj_api_base', SYNJ_API_URL));
        echo "<input type='text' name='synj_api_base' value='$val' style='width:400px;'>";
    }, 'synj-settings', 'synj_main');
});

function synj_get_api_key(): string {
    return get_option('synj_api_key', defined('API_KEY') ? API_KEY : '');
}

function synj_get_api_url(): string {
    return get_option('synj_api_base', defined('SYNJ_API_URL') ? SYNJ_API_URL : '');
}

// -------------------------------------------------------------------
// Proxy API backend (server-to-server avec X-API-Key)
// -------------------------------------------------------------------

function synj_api_post(string $endpoint, array $body): array {
    $response = wp_remote_post(synj_get_api_url() . $endpoint, [
        'headers' => [
            'Content-Type' => 'application/json',
            'X-API-Key'    => synj_get_api_key(),
        ],
        'body'    => json_encode($body),
        'timeout' => 15,
    ]);

    if (is_wp_error($response)) {
        error_log('[SYNJ] API POST error: ' . $response->get_error_message());
        return ['error' => true, 'message' => $response->get_error_message()];
    }

    return json_decode(wp_remote_retrieve_body($response), true) ?? [];
}

function synj_api_delete(string $endpoint): array {
    $response = wp_remote_request(synj_get_api_url() . $endpoint, [
        'method'  => 'DELETE',
        'headers' => [
            'Content-Type' => 'application/json',
            'X-API-Key'    => synj_get_api_key(),
        ],
        'timeout' => 10,
    ]);

    if (is_wp_error($response)) {
        error_log('[SYNJ] API DELETE error: ' . $response->get_error_message());
        return ['error' => true];
    }

    return json_decode(wp_remote_retrieve_body($response), true) ?? [];
}

function synj_proxy_api(string $endpoint): array {
    $response = wp_remote_get(synj_get_api_url() . $endpoint, [
        'headers' => [
            'Content-Type' => 'application/json',
            'X-API-Key'    => synj_get_api_key(),
        ],
        'timeout' => 10,
    ]);

    if (is_wp_error($response)) {
        error_log('[SYNJ] Proxy erreur : ' . $response->get_error_message());
        return ['error' => true, 'message' => $response->get_error_message()];
    }

    return json_decode(wp_remote_retrieve_body($response), true) ?? [];
}

// -------------------------------------------------------------------
// Routes REST WordPress
// -------------------------------------------------------------------

add_action('rest_api_init', function () {

    register_rest_route('synj/v1', '/availability/check', [
        'methods'             => 'POST',
        'callback'            => function (WP_REST_Request $request) {
            return rest_ensure_response(synj_api_post('/availability/check', $request->get_json_params() ?? []));
        },
        'permission_callback' => '__return_true',
    ]);

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
});

// -------------------------------------------------------------------
// Chargement des scripts
// -------------------------------------------------------------------

add_action('wp_enqueue_scripts', function () {
    if (!is_product()) return;

    wp_enqueue_script('synj-prix', plugin_dir_url(__FILE__) . 'js/synj-prix.js', [], '2.0.0', true);

    // Injecter la clé API et les données produit pour le JS
    $product_id = get_queried_object_id();
    $cart_id = '';
    if (function_exists('WC') && WC()->session) {
        $cart_id = WC()->session->get_customer_id() ?? '';
    }

    wp_add_inline_script(
        'synj-prix',
        'window.__SYNJ_API_KEY  = ' . json_encode(synj_get_api_key()) . ';' .
        'window.__SYNJ_API_BASE = ' . json_encode(synj_get_api_url()) . ';' .
        'window.__SYNJ_CART_ID  = ' . json_encode($cart_id) . ';',
        'before'
    );

    wp_localize_script('synj-prix', '__SYNJ_PRODUCT', [
        'type'           => get_post_meta($product_id, 'synj_product_type',   true),
        'templateId'     => (int)   get_post_meta($product_id, 'synj_template_id',    true),
        'basePrice'      => (float) get_post_meta($product_id, 'synj_base_price',     true),
        'pricingConfig'  => json_decode(get_post_meta($product_id, 'synj_pricing_config',  true), true),
        'resourceConfig' => json_decode(get_post_meta($product_id, 'synj_resource_config', true), true),
    ]);
});

// -------------------------------------------------------------------
// WooCommerce — configuration panier
// -------------------------------------------------------------------

add_filter('woocommerce_add_cart_item_data', function ($cart_item_data, $product_id) {
    if (isset($_POST['synj_cpu']))        $cart_item_data['synj_cpu']        = floatval($_POST['synj_cpu']);
    if (isset($_POST['synj_ram_gb']))     $cart_item_data['synj_ram_gb']     = floatval($_POST['synj_ram_gb']);
    if (isset($_POST['synj_storage_gb'])) $cart_item_data['synj_storage_gb'] = floatval($_POST['synj_storage_gb']);
    if (isset($_POST['synj_prix']))       $cart_item_data['synj_prix']       = floatval($_POST['synj_prix']);
    return $cart_item_data;
}, 10, 2);

add_action('woocommerce_before_calculate_totals', function ($cart) {
    if (is_admin() && !defined('DOING_AJAX')) return;
    foreach ($cart->get_cart() as $item) {
        if (isset($item['synj_prix']) && $item['synj_prix'] > 0) {
            $item['data']->set_price($item['synj_prix']);
        }
    }
});

add_filter('woocommerce_get_item_data', function ($item_data, $cart_item) {
    if (!empty($cart_item['synj_cpu']))        $item_data[] = ['name' => 'CPU',      'value' => $cart_item['synj_cpu']        . ' cœur(s)'];
    if (!empty($cart_item['synj_ram_gb']))     $item_data[] = ['name' => 'RAM',      'value' => $cart_item['synj_ram_gb']     . ' Go'];
    if (!empty($cart_item['synj_storage_gb'])) $item_data[] = ['name' => 'Stockage', 'value' => $cart_item['synj_storage_gb'] . ' Go'];
    return $item_data;
}, 10, 2);

// Copier les meta du panier vers les items de commande
add_action('woocommerce_checkout_create_order_line_item', function ($item, $cart_item_key, $values, $order) {
    foreach (['synj_cpu', 'synj_ram_gb', 'synj_storage_gb'] as $key) {
        if (!empty($values[$key])) $item->add_meta_data($key, $values[$key], true);
    }
}, 10, 4);

// -------------------------------------------------------------------
// Provisioning après paiement confirmé
// -------------------------------------------------------------------

add_action('woocommerce_payment_complete', function (int $order_id): void {
    $order = wc_get_order($order_id);
    if (!$order) return;

    foreach ($order->get_items() as $item) {
        $product_id   = $item->get_product_id();
        $template_id  = (int) get_post_meta($product_id, 'synj_template_id',  true);
        $product_type =       get_post_meta($product_id, 'synj_product_type', true);

        if (!$template_id || !$product_type) {
            error_log('[SYNJ] Provisioning impossible — meta manquantes pour produit ' . $product_id);
            continue;
        }

        $cpu        = (int) $item->get_meta('synj_cpu');
        $ram_gb     = (int) $item->get_meta('synj_ram_gb');
        $storage_gb = (int) $item->get_meta('synj_storage_gb');

        if (!$cpu || !$ram_gb) {
            error_log('[SYNJ] Provisioning impossible — ressources nulles pour commande WC-' . $order_id . ' (cpu=' . $cpu . ' ram_gb=' . $ram_gb . ')');
            continue;
        }

        $cart_id = '';
        if (function_exists('WC') && WC()->session) {
            $cart_id = WC()->session->get_customer_id() ?? '';
        }
        if (!$cart_id) {
            $cart_id = $order->get_meta('_customer_user') ? 'user-' . $order->get_meta('_customer_user') : 'wc-' . $order_id;
        }

        $payment_intent_id = $order->get_meta('_stripe_intent_id') ?: '';

        $body = [
            'email'           => $order->get_billing_email(),
            'firstName'       => $order->get_billing_first_name(),
            'productType'     => $product_type,
            'templateId'      => $template_id,
            'externalOrderId' => 'WC-' . $order_id,
            'cartId'          => $cart_id,
            'paymentIntentId' => $payment_intent_id,
            'resources'       => [
                'cpu'        => $cpu,
                'ram_gb'     => $ram_gb,
                'storage_gb' => $storage_gb,
            ],
        ];

        error_log('[SYNJ] Appel /provision — body: ' . wp_json_encode($body));

        $response = wp_remote_post(synj_get_api_url() . '/provision', [
            'headers' => [
                'Content-Type' => 'application/json',
                'X-API-Key'    => synj_get_api_key(),
            ],
            'body'    => wp_json_encode($body),
            'timeout' => 15,
        ]);

        if (!is_wp_error($response)) {
            $http_code = wp_remote_retrieve_response_code($response);
            $body_raw  = wp_remote_retrieve_body($response);
            $data      = json_decode($body_raw, true);
            error_log('[SYNJ] Réponse /provision — HTTP ' . $http_code . ' — ' . $body_raw);
            if (!empty($data['serviceId'])) {
                update_post_meta($order_id, 'synj_service_id', $data['serviceId']);
                error_log('[SYNJ] Provisioning lancé — serviceId: ' . $data['serviceId'] . ' pour commande WC-' . $order_id);
            }
        } else {
            error_log('[SYNJ] Provisioning wp_error : ' . $response->get_error_message());
        }
    }
});

// -------------------------------------------------------------------
// Shortcode disponibilités
// -------------------------------------------------------------------

add_shortcode('synj_disponibilites', function () {
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
            const ramPct = ((ram.free_memory / ram.total_memory) * 100).toFixed(1);
            const ramColor = ramPct < 10 ? '#ef4444' : ramPct < 30 ? '#f59e0b' : '#22c55e';
            document.getElementById('synj-ram-val').textContent = (ram.available_memory/1073741824).toFixed(2) + ' / ' + (ram.total_memory/1073741824).toFixed(2) + ' Go';
            document.getElementById('synj-ram-bar').style.cssText = 'width:' + ramPct + '%;background:' + ramColor;
            document.getElementById('synj-ram-pct').textContent = ramPct + '% libre';
            document.getElementById('synj-ram-pct').style.color = ramColor;

            const cpuDispo = (100 - parseFloat(cpu.available_cpu) * 100).toFixed(1);
            const cpuColor = cpuDispo < 15 ? '#ef4444' : cpuDispo < 40 ? '#f59e0b' : '#22c55e';
            document.getElementById('synj-cpu-val').textContent = cpuDispo + '%';
            document.getElementById('synj-cpu-bar').style.cssText = 'width:' + cpuDispo + '%;background:' + cpuColor;
            document.getElementById('synj-cpu-pct').textContent = cpuDispo + '% disponible';
            document.getElementById('synj-cpu-pct').style.color = cpuColor;

            const storPct = ((stockage.available_storage / stockage.total_storage) * 100).toFixed(1);
            const storColor = storPct < 20 ? '#ef4444' : storPct < 50 ? '#f59e0b' : '#22c55e';
            document.getElementById('synj-stockage-val').textContent = (stockage.available_storage/1073741824).toFixed(2) + ' / ' + (stockage.total_storage/1073741824).toFixed(2) + ' Go';
            document.getElementById('synj-stockage-bar').style.cssText = 'width:' + storPct + '%;background:' + storColor;
            document.getElementById('synj-stockage-pct').textContent = storPct + '% disponible';
            document.getElementById('synj-stockage-pct').style.color = storColor;

            document.getElementById('synj-last-update').textContent = 'Dernière mise à jour : ' + new Date().toLocaleTimeString('fr-FR');
        } catch(err) { console.error('Erreur SYNJ:', err); }
    }
    synj_fetchDispo();
    setInterval(synj_fetchDispo, 30000);
    </script>
    <?php
    return ob_get_clean();
});
