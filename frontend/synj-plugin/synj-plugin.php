<?php
/**
 * Plugin Name: SYNJ Plugin
 * Plugin URI: https://synj.fr
 * Description: Plugin custom SYNJ
 * Version: 1.0.0
 * Author: George Khitaridze & Mohamed Amine
 */

if (!defined('ABSPATH')) exit;

// Configuration API
define('SYNJ_API_BASE', '');
define('SYNJ_API_KEY', '');

// Proxy PHP
function synj_proxy_api($endpoint) {
    $response = wp_remote_get(SYNJ_API_BASE . $endpoint, [
        'headers' => [
            'X-API-Key' => SYNJ_API_KEY,
            'Content-Type' => 'application/json'
        ],
        'timeout' => 10
    ]);
    
    if (is_wp_error($response)) {
        error_log('SYNJ API Error: ' . $response->get_error_message());
        return ['error' => true, 'message' => $response->get_error_message()];
    }
    
    $code = wp_remote_retrieve_response_code($response);
    $body = wp_remote_retrieve_body($response);
    
    error_log('SYNJ API Response Code: ' . $code);
    error_log('SYNJ API Response: ' . $body);
    
    return json_decode($body, true);
}

// Routes REST
function synj_enregistrer_routes() {
    register_rest_route('synj/v1', '/memory', [
        'methods' => 'GET',
        'callback' => fn() => synj_proxy_api('/availability/memory'),
        'permission_callback' => '__return_true'
    ]);
    register_rest_route('synj/v1', '/cpu', [
        'methods' => 'GET',
        'callback' => fn() => synj_proxy_api('/availability/cpu'),
        'permission_callback' => '__return_true'
    ]);
    register_rest_route('synj/v1', '/storage', [
        'methods' => 'GET',
        'callback' => fn() => synj_proxy_api('/availability/storage'),
        'permission_callback' => '__return_true'
    ]);
}
add_action('rest_api_init', 'synj_enregistrer_routes');

// Shortcode disponibilités
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
    .synj-label { font-size:11px; color:#6b7280; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:8px; }
    .synj-value { font-size:26px; font-weight:bold; color:#1e3a5f; margin-bottom:8px; }
    .synj-bar-bg { background:#f3f4f6; border-radius:99px; height:8px; }
    .synj-bar { height:8px; border-radius:99px; transition:width 0.5s ease; width:0%; }
    .synj-pct { font-size:12px; margin-top:6px; }
    </style>

    <script>
    async function synj_fetchDispo() {
        try {
            const [ram, cpu, stockage] = await Promise.all([
                fetch('/wp-json/synj/v1/memory').then(r => r.json()),
                fetch('/wp-json/synj/v1/cpu').then(r => r.json()),
                fetch('/wp-json/synj/v1/storage').then(r => r.json()),
            ]);

            // RAM
            const ramDispoGo = (ram.available_memory / 1073741824).toFixed(2);
            const ramTotalGo = (ram.total_memory / 1073741824).toFixed(2);
            const ramUsedGo = (ram.used_memory / 1073741824).toFixed(2);
            const ramPct = ((ram.free_memory / ram.total_memory) * 100).toFixed(1);
            const ramColor = ramPct < 10 ? '#ef4444' : ramPct < 30 ? '#f59e0b' : '#22c55e';
            document.getElementById('synj-ram-val').textContent = ramDispoGo + ' / ' + ramTotalGo + ' Go';
            document.getElementById('synj-ram-bar').style.width = ramPct + '%';
            document.getElementById('synj-ram-bar').style.background = ramColor;
            document.getElementById('synj-ram-pct').textContent = ramPct + '% libre (' + ramUsedGo + ' Go utilisés)';
            document.getElementById('synj-ram-pct').style.color = ramColor;

            // CPU
            const cpuUsage = (parseFloat(cpu.available_cpu) * 100).toFixed(1);
            const cpuDispo = (100 - cpuUsage).toFixed(1);
            const cpuColor = cpuDispo < 15 ? '#ef4444' : cpuDispo < 40 ? '#f59e0b' : '#22c55e';
            document.getElementById('synj-cpu-val').textContent = cpuDispo + '%';
            document.getElementById('synj-cpu-bar').style.width = cpuDispo + '%';
            document.getElementById('synj-cpu-bar').style.background = cpuColor;
            document.getElementById('synj-cpu-pct').textContent = cpuDispo + '% disponible';
            document.getElementById('synj-cpu-pct').style.color = cpuColor;

            // Stockage
            const storDispoGo = (stockage.available_storage / 1073741824).toFixed(2);
            const storTotalGo = (stockage.total_storage / 1073741824).toFixed(2);
            const storPct = ((stockage.available_storage / stockage.total_storage) * 100).toFixed(1);
            const storColor = storDispoGo < 20 ? '#ef4444' : storDispoGo < 50 ? '#f59e0b' : '#22c55e';
            document.getElementById('synj-stockage-val').textContent = storDispoGo + ' / ' + storTotalGo + ' Go';
            document.getElementById('synj-stockage-bar').style.width = storPct + '%';
            document.getElementById('synj-stockage-bar').style.background = storColor;
            document.getElementById('synj-stockage-pct').textContent = storPct + '% disponible';
            document.getElementById('synj-stockage-pct').style.color = storColor;

            // Timestamp
            const now = new Date();
            document.getElementById('synj-last-update').textContent = 
                'Dernière mise à jour : ' + now.toLocaleTimeString('fr-FR');

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


function synj_charger_scripts() {
    if (is_product()) {
        wp_enqueue_script(
            'synj-prix',
            plugin_dir_url(__FILE__) . 'js/synj-prix.js',
            array(),
            '1.0',
            true
        );
    }
}
add_action('wp_enqueue_scripts', 'synj_charger_scripts');


add_shortcode('synj_disponibilites', 'synj_disponibilites_shortcode');