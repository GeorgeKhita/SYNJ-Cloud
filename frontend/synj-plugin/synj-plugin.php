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
    echo '<p style="color:#666; margin-bottom:20px;">Vos serveurs actifs apparaîtront ici après déploiement.</p>';
    
    $serveurs = [
        [
            'nom'     => 'Serveur VPN',
            'ip'      => '192.168.1.100',
            'port'    => '1194',
            'statut'  => 'Actif',
            'expire'  => '03/04/2026'
        ],
        [
            'nom'     => 'VPS Linux',
            'ip'      => '192.168.1.101',
            'port'    => '22',
            'statut'  => 'Suspendu',
            'expire'  => '01/03/2026'
        ]
    ];

    foreach ($serveurs as $serveur) {
        $is_actif = $serveur['statut'] === 'Actif';
        $statut_color = $is_actif ? '#22c55e' : '#ef4444';
        $badge_bg = $is_actif ? '#dcfce7' : '#fee2e2';

        echo '<div style="border: 2px solid #e5e7eb; border-radius: 12px; padding: 20px; margin: 16px 0; background: #fff; box-shadow: 0 1px 4px rgba(0,0,0,0.06);">';
        
        // Header
        echo '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">';
        echo '<h3 style="color:#1e3a5f; margin:0;">' . $serveur['nom'] . '</h3>';
        echo '<span style="background:' . $badge_bg . '; color:' . $statut_color . '; padding:4px 12px; border-radius:20px; font-size:13px; font-weight:600;">● ' . $serveur['statut'] . '</span>';
        echo '</div>';

        // Infos
        echo '<p style="margin:6px 0;"><b>IP :</b> ' . $serveur['ip'] . '</p>';
        echo '<p style="margin:6px 0;"><b>Port :</b> ' . $serveur['port'] . '</p>';
        // Credentials masqués
        echo '<p style="margin:6px 0;"><b>Login :</b> 
        <span id="login-' . $serveur['ip'] . '" style="filter:blur(4px); cursor:pointer;" onclick="revealField(this)">
            client_' . str_replace('.', '', $serveur['ip']) . '
        </span>
        <span onclick="copyField(\'client_' . str_replace('.', '', $serveur['ip']) . '\')" style="cursor:pointer; margin-left:8px; font-size:12px; color:#3b82f6;">📋 Copier</span>
        </p>';

        echo '<p style="margin:6px 0;"><b>Mot de passe :</b> 
        <span id="pwd-' . $serveur['ip'] . '" style="filter:blur(4px); cursor:pointer;" onclick="revealField(this)">
            Syn@' . rand(1000,9999) . '!
        </span>
        <span onclick="copyField(\'Syn@1234!\')" style="cursor:pointer; margin-left:8px; font-size:12px; color:#3b82f6;">📋 Copier</span>
        </p>';
        echo '<p style="margin:6px 0;"><b>Renouvellement :</b> ' . $serveur['expire'] . '</p>';

        // Boutons
        echo '<div style="margin-top:16px; display:flex; gap:10px; flex-wrap:wrap;">';
        if ($is_actif) {
            echo '<a href="#" style="background:#3b82f6; color:white; padding:8px 16px; border-radius:8px; text-decoration:none; font-size:13px; font-weight:600;">🔄 Renouveler</a>';
            echo '<a href="#" style="background:#fee2e2; color:#ef4444; padding:8px 16px; border-radius:8px; text-decoration:none; font-size:13px; font-weight:600;">✕ Résilier</a>';
        } else {
            echo '<a href="#" style="background:#22c55e; color:white; padding:8px 16px; border-radius:8px; text-decoration:none; font-size:13px; font-weight:600;">💳 Régulariser</a>';
        }
        echo '</div>';
        echo '</div>';
        echo '<script>
        function revealField(el) {
            el.style.filter = el.style.filter === "none" ? "blur(4px)" : "none";
        }
        function copyField(val) {
            navigator.clipboard.writeText(val);
            alert("Copié !");
        }
        </script>';
    }

    // Bouton ajouter
    echo '<div style="margin-top:24px;">';
    echo '<a href="/shop" style="background:#1e3a5f; color:white; padding:12px 24px; border-radius:10px; text-decoration:none; font-size:14px; font-weight:600;">+ Ajouter une offre</a>';
    echo '</div>';
}
add_action('woocommerce_account_mes-serveurs_endpoint', 'synj_contenu_onglet_serveurs');

function synj_enregistrer_endpoint_serveurs() {
    add_rewrite_endpoint('mes-serveurs', EP_ROOT | EP_PAGES);
}

// Dashboard Admin SYNJ
function synj_ajouter_menu_admin() {
    add_menu_page(
        'SYNJ Dashboard',
        'SYNJ Dashboard',
        'manage_options',
        'synj-dashboard',
        'synj_page_dashboard',
        'dashicons-server',
        30
    );
}
add_action('admin_menu', 'synj_ajouter_menu_admin');

function synj_page_dashboard() {
    // Données mockées
    $ressources = [
        'ram'      => ['total' => 32, 'used' => 22],
        'cpu'      => ['total' => 16, 'used' => 9],
        'stockage' => ['total' => 500, 'used' => 310],
    ];

    $commandes = [
        ['id' => '#1042', 'client' => 'Jean Dupont',    'service' => 'VPN',       'statut' => 'Actif',    'date' => '06/03/2026', 'prix' => '8€'],
        ['id' => '#1041', 'client' => 'Marie Martin',   'service' => 'VPS Linux', 'statut' => 'Actif',    'date' => '05/03/2026', 'prix' => '15€'],
        ['id' => '#1040', 'client' => 'Paul Bernard',   'service' => 'NAS',       'statut' => 'Suspendu', 'date' => '04/03/2026', 'prix' => '28€'],
        ['id' => '#1039', 'client' => 'Sophie Leclerc', 'service' => 'VPN',       'statut' => 'Actif',    'date' => '03/03/2026', 'prix' => '11€'],
        ['id' => '#1038', 'client' => 'Lucas Moreau',   'service' => 'VPS Linux', 'statut' => 'Actif',    'date' => '02/03/2026', 'prix' => '27€'],
        ['id' => '#1037', 'client' => 'Emma Petit',     'service' => 'NAS',       'statut' => 'Resilié',  'date' => '01/03/2026', 'prix' => '32€'],
        ['id' => '#1036', 'client' => 'Hugo Simon',     'service' => 'VPN',       'statut' => 'Actif',    'date' => '28/02/2026', 'prix' => '8€'],
        ['id' => '#1035', 'client' => 'Lea Dubois',     'service' => 'VPS Linux', 'statut' => 'Suspendu', 'date' => '27/02/2026', 'prix' => '12€'],
        ['id' => '#1034', 'client' => 'Tom Laurent',    'service' => 'NAS',       'statut' => 'Actif',    'date' => '26/02/2026', 'prix' => '28€'],
        ['id' => '#1033', 'client' => 'Clara Thomas',   'service' => 'VPN',       'statut' => 'Actif',    'date' => '25/02/2026', 'prix' => '8€'],
    ];

    $alertes = [
        ['niveau' => 'error',   'message' => 'RAM disponible < 10% sur noeud principal'],
        ['niveau' => 'warning', 'message' => 'Echec deploiement commande #1040 — relance en cours'],
        ['niveau' => 'info',    'message' => 'Cache ressources rafraichi il y a 45 secondes'],
    ];

    $statut_colors = [
        'Actif'    => ['bg' => '#dcfce7', 'color' => '#16a34a'],
        'Suspendu' => ['bg' => '#fee2e2', 'color' => '#dc2626'],
        'Resilié'  => ['bg' => '#f3f4f6', 'color' => '#6b7280'],
    ];

    $alerte_colors = [
        'error'   => ['bg' => '#fee2e2', 'color' => '#dc2626', 'icon' => '🔴'],
        'warning' => ['bg' => '#fef9c3', 'color' => '#ca8a04', 'icon' => '⚠️'],
        'info'    => ['bg' => '#dbeafe', 'color' => '#2563eb', 'icon' => 'ℹ️'],
    ];

    ?>
    <div style="padding: 24px; font-family: Arial, sans-serif; max-width: 1200px;">
        <h1 style="color: #1e3a5f; margin-bottom: 24px;">⚙️ SYNJ Dashboard Admin</h1>

        <!-- Alertes -->
        <h2 style="font-size:16px; color:#1e3a5f; margin-bottom:12px;">🚨 Alertes actives</h2>
        <?php foreach ($alertes as $alerte) : 
            $c = $alerte_colors[$alerte['niveau']];
        ?>
        <div style="background:<?= $c['bg'] ?>; border-left: 4px solid <?= $c['color'] ?>; padding: 10px 16px; border-radius: 6px; margin-bottom: 8px; color: <?= $c['color'] ?>; font-weight: 500;">
            <?= $c['icon'] ?> <?= $alerte['message'] ?>
        </div>
        <?php endforeach; ?>

        <!-- Ressources -->
        <h2 style="font-size:16px; color:#1e3a5f; margin: 24px 0 12px;">🖥️ Ressources Proxmox — Nœud principal</h2>
        <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:16px; margin-bottom:24px;">
        <?php
            $labels = ['ram' => 'RAM (Go)', 'cpu' => 'CPU (cœurs)', 'stockage' => 'Stockage (Go)'];
            foreach ($ressources as $key => $r) :
                $pct = round(($r['used'] / $r['total']) * 100);
                $bar_color = $pct > 85 ? '#dc2626' : ($pct > 60 ? '#ca8a04' : '#16a34a');
        ?>
        <div style="background:#fff; border:1px solid #e5e7eb; border-radius:10px; padding:16px;">
            <div style="font-size:13px; color:#6b7280; margin-bottom:8px;"><?= $labels[$key] ?></div>
            <div style="font-size:22px; font-weight:bold; color:#1e3a5f; margin-bottom:8px;">
                <?= $r['used'] ?> / <?= $r['total'] ?>
            </div>
            <div style="background:#f3f4f6; border-radius:99px; height:8px;">
                <div style="background:<?= $bar_color ?>; width:<?= $pct ?>%; height:8px; border-radius:99px;"></div>
            </div>
            <div style="font-size:12px; color:<?= $bar_color ?>; margin-top:6px;"><?= $pct ?>% utilisé</div>
        </div>
        <?php endforeach; ?>
        </div>

        <!-- Commandes -->
        <h2 style="font-size:16px; color:#1e3a5f; margin-bottom:12px;">📋 10 dernières commandes</h2>
        <table style="width:100%; border-collapse:collapse; background:#fff; border-radius:10px; overflow:hidden; border:1px solid #e5e7eb;">
            <thead>
                <tr style="background:#1e3a5f; color:white;">
                    <th style="padding:10px 14px; text-align:left;">ID</th>
                    <th style="padding:10px 14px; text-align:left;">Client</th>
                    <th style="padding:10px 14px; text-align:left;">Service</th>
                    <th style="padding:10px 14px; text-align:left;">Statut</th>
                    <th style="padding:10px 14px; text-align:left;">Date</th>
                    <th style="padding:10px 14px; text-align:left;">Prix</th>
                </tr>
            </thead>
            <tbody>
            <?php foreach ($commandes as $i => $cmd) :
                $s = $statut_colors[$cmd['statut']];
                $bg = $i % 2 === 0 ? '#ffffff' : '#f9fafb';
            ?>
            <tr style="background:<?= $bg ?>;">
                <td style="padding:10px 14px; font-weight:600; color:#1e3a5f;"><?= $cmd['id'] ?></td>
                <td style="padding:10px 14px;"><?= $cmd['client'] ?></td>
                <td style="padding:10px 14px;"><?= $cmd['service'] ?></td>
                <td style="padding:10px 14px;">
                    <span style="background:<?= $s['bg'] ?>; color:<?= $s['color'] ?>; padding:3px 10px; border-radius:20px; font-size:12px; font-weight:600;">
                        <?= $cmd['statut'] ?>
                    </span>
                </td>
                <td style="padding:10px 14px; color:#6b7280;"><?= $cmd['date'] ?></td>
                <td style="padding:10px 14px; font-weight:600;"><?= $cmd['prix'] ?></td>
            </tr>
            <?php endforeach; ?>
            </tbody>
        </table>
    </div>
    <?php
}


add_action('init', 'synj_enregistrer_endpoint_serveurs');