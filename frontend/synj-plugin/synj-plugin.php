<?php
/**
 * Plugin Name: SYNJ Plugin
 * Plugin URI: https://synj.fr
 * Description: Plugin custom SYNJ — gestion des ressources dynamiques, prix en temps réel, messages UX et espace client.
 * Version: 1.0.0
 * Author: George Khitaridze & Mohamed Amine
 * Author URI: https://synj.fr
 */

if (!defined('ABSPATH')) exit;

// Chargement des scripts
function synj_charger_scripts() {
    if (is_product()) {
        wp_enqueue_script(
            'synj-messages',
            plugin_dir_url(__FILE__) . 'js/synj-messages.js',
            array(),
            '1.0',
            true
        );
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

// Onglet "Mes serveurs" dans Mon Compte
function synj_ajouter_onglet_serveurs($items) {
    $items['mes-serveurs'] = 'Mes serveurs';
    return $items;
}
add_filter('woocommerce_account_menu_items', 'synj_ajouter_onglet_serveurs');

function synj_contenu_onglet_serveurs() {
    echo '<h2>Mes serveurs</h2>';
    echo '<p>Vos serveurs actifs apparaîtront ici après déploiement.</p>';
    
    $serveurs = [
        [
            'nom' => 'Serveur VPN',
            'ip' => '192.168.1.100',
            'port' => '1194',
            'statut' => 'Actif',
            'expire' => '03/04/2026'
        ]
    ];

    foreach ($serveurs as $serveur) {
        echo '<div style="border: 2px solid #3b82f6; border-radius: 8px; padding: 16px; margin: 16px 0; background: #eff6ff;">';
        echo '<h3 style="color: #1e3a5f;">' . $serveur['nom'] . '</h3>';
        echo '<p><b>IP :</b> ' . $serveur['ip'] . '</p>';
        echo '<p><b>Port :</b> ' . $serveur['port'] . '</p>';
        echo '<p><b>Statut :</b> <span style="color: green;">● ' . $serveur['statut'] . '</span></p>';
        echo '<p><b>Renouvellement :</b> ' . $serveur['expire'] . '</p>';
        echo '</div>';
    }
}
add_action('woocommerce_account_mes-serveurs_endpoint', 'synj_contenu_onglet_serveurs');

function synj_enregistrer_endpoint_serveurs() {
    add_rewrite_endpoint('mes-serveurs', EP_ROOT | EP_PAGES);
}
add_action('init', 'synj_enregistrer_endpoint_serveurs');