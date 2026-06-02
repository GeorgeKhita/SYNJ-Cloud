# Plan de tests — SYNJ Cloud

Trois sections :
- **A** — Tests backend Node.js (API seule, sans WordPress)
- **B** — Tests côté WordPress (comportement UI/UX)
- **C** — Tests d'intégration bout en bout (WordPress + Backend + Proxmox)

Convention de résultat : ✅ Passé — ❌ Échoué — ⏭️ Non testé

---

## A — Tests Backend Node.js

> Tester avec curl ou Postman directement sur `http://100.113.174.49:3000`
> Remplacer `<API_KEY>` par la valeur dans le `.env`

---

### A.1 — Health check

**A.1.1 — Le serveur répond**
```bash
curl http://100.113.174.49:3000/health
```
Résultat attendu : `{ "status": "ok" }` — HTTP 200
Résultat obtenu : [ ]

---

### A.2 — Authentification API Key

**A.2.1 — Requête sans API Key**
```bash
curl -X POST http://100.113.174.49:3000/availability/check \
  -H "Content-Type: application/json" \
  -d '{"cpu":2,"ram_gb":4,"storage_gb":50}'
```
Résultat attendu : HTTP 401 — `{ "error": "API key invalide" }`
Résultat obtenu : [ ]

**A.2.2 — Requête avec une mauvaise API Key**
```bash
curl -X POST http://100.113.174.49:3000/availability/check \
  -H "Content-Type: application/json" \
  -H "X-API-Key: cle_fausse" \
  -d '{"cpu":2,"ram_gb":4,"storage_gb":50}'
```
Résultat attendu : HTTP 401
Résultat obtenu : [ ]

**A.2.3 — Requête avec la bonne API Key**
```bash
curl -X POST http://100.113.174.49:3000/availability/check \
  -H "Content-Type: application/json" \
  -H "X-API-Key: <API_KEY>" \
  -d '{"cpu":2,"ram_gb":4,"storage_gb":50}'
```
Résultat attendu : HTTP 200 — `{ "available": true }` ou `{ "available": false, "reason": "..." }`
Résultat obtenu : [ ]

---

### A.3 — Disponibilité des ressources

**A.3.1 — Check ressources normales**
```bash
curl -X POST http://100.113.174.49:3000/availability/check \
  -H "Content-Type: application/json" \
  -H "X-API-Key: <API_KEY>" \
  -d '{"cpu":2,"ram_gb":4,"storage_gb":50}'
```
Résultat attendu : HTTP 200 — `{ "available": true }`
Résultat obtenu : [ ]

**A.3.2 — Check ressources excessives (demander plus que ce qu'on a)**
```bash
curl -X POST http://100.113.174.49:3000/availability/check \
  -H "Content-Type: application/json" \
  -H "X-API-Key: <API_KEY>" \
  -d '{"cpu":9999,"ram_gb":9999,"storage_gb":9999}'
```
Résultat attendu : HTTP 200 — `{ "available": false, "reason": "..." }`
Résultat obtenu : [ ]

**A.3.3 — Check avec un champ manquant**
```bash
curl -X POST http://100.113.174.49:3000/availability/check \
  -H "Content-Type: application/json" \
  -H "X-API-Key: <API_KEY>" \
  -d '{"cpu":2,"ram_gb":4}'
```
Résultat attendu : HTTP 400 — erreur de validation (storage_gb manquant)
Résultat obtenu : [ ]

**A.3.4 — Check avec une valeur négative**
```bash
curl -X POST http://100.113.174.49:3000/availability/check \
  -H "Content-Type: application/json" \
  -H "X-API-Key: <API_KEY>" \
  -d '{"cpu":-1,"ram_gb":4,"storage_gb":50}'
```
Résultat attendu : HTTP 400 — erreur de validation
Résultat obtenu : [ ]

**A.3.5 — GET /availability/memory**
```bash
curl http://100.113.174.49:3000/availability/memory \
  -H "X-API-Key: <API_KEY>"
```
Résultat attendu : HTTP 200 — objet avec `total_memory`, `used_memory`, `free_memory`
Résultat obtenu : [ ]

**A.3.6 — GET /availability/cpu**
```bash
curl http://100.113.174.49:3000/availability/cpu \
  -H "X-API-Key: <API_KEY>"
```
Résultat attendu : HTTP 200 — `{ "available_cpu": 0.xx }`
Résultat obtenu : [ ]

**A.3.7 — GET /availability/storage**
```bash
curl http://100.113.174.49:3000/availability/storage \
  -H "X-API-Key: <API_KEY>"
```
Résultat attendu : HTTP 200 — objet avec `total_storage`, `available_storage`
Résultat obtenu : [ ]

---

### A.4 — Réservation panier (anti-survente)

**A.4.1 — Réserver des ressources**
```bash
curl -X POST http://100.113.174.49:3000/cart/reserve \
  -H "Content-Type: application/json" \
  -H "X-API-Key: <API_KEY>" \
  -d '{"cartId":"test-cart-001","resources":{"cpu":2,"ram_gb":4,"storage_gb":50}}'
```
Résultat attendu : HTTP 200 — `{ "reserved": true, "expiresIn": 900 }`
Résultat obtenu : [ ]

**A.4.2 — Réserver avec le même cartId (renouvellement TTL)**
Rejouer la commande A.4.1 immédiatement après.
Résultat attendu : HTTP 200 — `{ "reserved": true, "expiresIn": 900 }` (pas d'erreur)
Résultat obtenu : [ ]

**A.4.3 — Libérer une réservation**
```bash
curl -X DELETE http://100.113.174.49:3000/cart/reserve/test-cart-001 \
  -H "X-API-Key: <API_KEY>"
```
Résultat attendu : HTTP 200 — `{ "released": true }`
Résultat obtenu : [ ]

**A.4.4 — Libérer un cartId qui n'existe pas**
```bash
curl -X DELETE http://100.113.174.49:3000/cart/reserve/cart-inexistant \
  -H "X-API-Key: <API_KEY>"
```
Résultat attendu : HTTP 200 — `{ "released": true }` (pas d'erreur, Redis `DEL` est idempotent)
Résultat obtenu : [ ]

**A.4.5 — Réserver avec ressources excessives**
```bash
curl -X POST http://100.113.174.49:3000/cart/reserve \
  -H "Content-Type: application/json" \
  -H "X-API-Key: <API_KEY>" \
  -d '{"cartId":"test-cart-999","resources":{"cpu":9999,"ram_gb":9999,"storage_gb":9999}}'
```
Résultat attendu : HTTP 409 — `{ "code": "CAPACITY_EXCEEDED" }`
Résultat obtenu : [ ]

**A.4.6 — Deux clients réservent en même temps (anti-survente)**
Ouvrir deux terminaux et lancer simultanément deux réservations avec des ressources proches de la limite.
Résultat attendu : L'un reçoit `reserved: true`, l'autre reçoit HTTP 409
Résultat obtenu : [ ]

---

### A.5 — Provisioning

**A.5.1 — Lancer un provisioning valide**
```bash
curl -X POST http://100.113.174.49:3000/provision \
  -H "Content-Type: application/json" \
  -H "X-API-Key: <API_KEY>" \
  -d '{
    "email": "test@synj.fr",
    "firstName": "Test",
    "productType": "vps",
    "templateId": 101,
    "externalOrderId": "WC-TEST-001",
    "cartId": "test-cart-001",
    "resources": { "cpu": 1, "ram_gb": 1, "storage_gb": 10 }
  }'
```
Résultat attendu : HTTP 202 — `{ "serviceId": X, "status": "provisioning" }`
Résultat obtenu : [ ]
serviceId obtenu : [ ]

**A.5.2 — Poller le statut immédiatement après**
```bash
curl http://100.113.174.49:3000/provision/<serviceId>/status \
  -H "X-API-Key: <API_KEY>"
```
Résultat attendu : `{ "status": "provisioning" }`
Résultat obtenu : [ ]

**A.5.3 — Poller jusqu'à active (attendre ~2 minutes)**
Relancer la commande A.5.2 toutes les 5 secondes.
Résultat attendu : après ~1-2 min, `{ "status": "active", "access": { "ip": "...", "port": "22", "username": "root", "password": "..." } }`
Résultat obtenu : [ ]
Temps d'attente réel : [ ]

**A.5.4 — Vérifier que l'email d'accès a bien été reçu**
Vérifier la boîte mail `test@synj.fr`.
Résultat attendu : email reçu avec IP, port, identifiants
Résultat obtenu : [ ]

**A.5.5 — Lancer un provisioning avec un templateId inexistant**
```bash
curl -X POST http://100.113.174.49:3000/provision \
  -H "Content-Type: application/json" \
  -H "X-API-Key: <API_KEY>" \
  -d '{
    "email": "test@synj.fr",
    "firstName": "Test",
    "productType": "vps",
    "templateId": 99999,
    "externalOrderId": "WC-TEST-002",
    "resources": { "cpu": 1, "ram_gb": 1, "storage_gb": 10 }
  }'
```
Résultat attendu : HTTP 202 — puis en pollant, `{ "status": "failed", "reason": "..." }`
Résultat obtenu : [ ]

**A.5.6 — Poller un serviceId inexistant**
```bash
curl http://100.113.174.49:3000/provision/99999/status \
  -H "X-API-Key: <API_KEY>"
```
Résultat attendu : HTTP 404
Résultat obtenu : [ ]

**A.5.7 — Lancer un provisioning sans cartId (sans réservation)**
Même commande que A.5.1 mais sans le champ `cartId`.
Résultat attendu : HTTP 202 — provisioning se lance normalement
Résultat obtenu : [ ]

**A.5.8 — Body invalide (champ manquant)**
```bash
curl -X POST http://100.113.174.49:3000/provision \
  -H "Content-Type: application/json" \
  -H "X-API-Key: <API_KEY>" \
  -d '{"email":"test@synj.fr"}'
```
Résultat attendu : HTTP 400 — erreur de validation
Résultat obtenu : [ ]

**A.5.9 — Email invalide**
```bash
curl -X POST http://100.113.174.js:3000/provision \
  -H "Content-Type: application/json" \
  -H "X-API-Key: <API_KEY>" \
  -d '{
    "email": "pasunemail",
    "firstName": "Test",
    "productType": "vps",
    "templateId": 101,
    "externalOrderId": "WC-TEST-003",
    "resources": { "cpu": 1, "ram_gb": 1, "storage_gb": 10 }
  }'
```
Résultat attendu : HTTP 400 — erreur de validation sur `email`
Résultat obtenu : [ ]

---

### A.6 — Liste des services

**A.6.1 — Lister tous les services**
```bash
curl http://100.113.174.49:3000/services \
  -H "X-API-Key: <API_KEY>"
```
Résultat attendu : HTTP 200 — `{ "services": [...] }` — doit contenir le service créé en A.5.3
Résultat obtenu : [ ]

**A.6.2 — Filtrer par email**
```bash
curl "http://100.113.174.49:3000/services?email=test@synj.fr" \
  -H "X-API-Key: <API_KEY>"
```
Résultat attendu : HTTP 200 — liste avec uniquement les services de `test@synj.fr`
Résultat obtenu : [ ]

**A.6.3 — Filtrer par email inexistant**
```bash
curl "http://100.113.174.49:3000/services?email=personne@synj.fr" \
  -H "X-API-Key: <API_KEY>"
```
Résultat attendu : HTTP 200 — `{ "services": [] }`
Résultat obtenu : [ ]

---

### A.7 — Robustesse

**A.7.1 — Rate limiting (plus de 100 requêtes en 1 minute)**
Envoyer 110 requêtes GET /health en moins d'une minute.
```bash
for i in $(seq 1 110); do curl -s http://100.113.174.49:3000/health; done
```
Résultat attendu : les premières répondent 200, à partir de la 101ème → HTTP 429
Résultat obtenu : [ ]

**A.7.2 — Requête avec body malformé (JSON invalide)**
```bash
curl -X POST http://100.113.174.49:3000/availability/check \
  -H "Content-Type: application/json" \
  -H "X-API-Key: <API_KEY>" \
  -d 'pas_du_json{'
```
Résultat attendu : HTTP 400
Résultat obtenu : [ ]

---

## B — Tests côté WordPress

> Tester dans le navigateur sur le site WordPress en dev (`synj-site.local`)
> Ouvrir la console navigateur (F12) pour voir les requêtes réseau

---

### B.1 — Page produit — Ressources disponibles

**B.1.1 — Page produit se charge normalement**
Aller sur la page d'un produit VPS/VPN/NAS.
Résultat attendu : le bouton "Ajouter au panier" est visible et actif
Résultat obtenu : [ ]

**B.1.2 — La requête /availability/check est bien envoyée au chargement**
Ouvrir l'onglet Réseau (F12) et recharger la page produit.
Résultat attendu : une requête POST vers `/availability/check` apparaît avec HTTP 200
Résultat obtenu : [ ]

**B.1.3 — Le bouton reste actif si available: true**
Résultat attendu : bouton cliquable, pas de message d'indisponibilité
Résultat obtenu : [ ]

---

### B.2 — Page produit — Ressources indisponibles

> Pour ce test, modifier temporairement le plugin WordPress pour envoyer cpu=9999

**B.2.1 — Le bouton est désactivé si available: false**
Résultat attendu : bouton "Ajouter au panier" grisé et non cliquable
Résultat obtenu : [ ]

**B.2.2 — Le message d'indisponibilité s'affiche**
Résultat attendu : message visible du type "Ce service est temporairement indisponible"
Résultat obtenu : [ ]

**B.2.3 — Le formulaire de configuration est masqué**
Résultat attendu : les selects CPU/RAM/Stockage ne sont pas affichés
Résultat obtenu : [ ]

---

### B.3 — Ajout au panier

**B.3.1 — Cliquer "Ajouter au panier" envoie une réservation**
Dans l'onglet Réseau (F12), cliquer "Ajouter au panier".
Résultat attendu : requête POST vers `/cart/reserve` visible avec HTTP 200
Résultat obtenu : [ ]

**B.3.2 — Le produit est bien ajouté au panier WooCommerce**
Résultat attendu : icône panier mise à jour, produit visible dans le panier
Résultat obtenu : [ ]

**B.3.3 — Si /cart/reserve retourne 409, l'ajout est bloqué**
> Simuler un 409 en mockant la réponse ou en épuisant les ressources
Résultat attendu : message d'erreur "Ce service n'est plus disponible", le produit n'est pas ajouté
Résultat obtenu : [ ]

---

### B.4 — Checkout

**B.4.1 — Ouverture de la page checkout renouvelle la réservation**
Aller sur la page checkout. Vérifier dans l'onglet Réseau.
Résultat attendu : requête POST vers `/cart/reserve` avec le même cartId, HTTP 200
Résultat obtenu : [ ]

**B.4.2 — Si le renouvellement échoue (409), redirection vers le panier**
> Simuler un 409 pendant le checkout
Résultat attendu : redirection vers la page panier avec message "Ressources plus disponibles"
Résultat obtenu : [ ]

---

### B.5 — Abandon du panier

**B.5.1 — Vider le panier libère la réservation**
Vider le panier depuis la page panier WooCommerce.
Résultat attendu : requête DELETE vers `/cart/reserve/:cartId` visible dans l'onglet Réseau
Résultat obtenu : [ ]

**B.5.2 — Fermer la session (expiration) libère la réservation automatiquement**
Attendre 15 minutes après avoir ajouté au panier sans payer.
Résultat attendu : la réservation expire automatiquement côté Redis (pas d'action WordPress nécessaire)
Résultat obtenu : [ ]

---

### B.6 — Après paiement — Page d'attente

**B.6.1 — La page d'attente s'affiche après paiement**
Passer une vraie commande jusqu'au bout.
Résultat attendu : page "Déploiement en cours..." avec animation visible
Résultat obtenu : [ ]

**B.6.2 — Le polling démarre bien toutes les 5 secondes**
Vérifier dans l'onglet Réseau.
Résultat attendu : requêtes GET vers `/provision/:id/status` toutes les ~5 secondes
Résultat obtenu : [ ]

**B.6.3 — La page d'attente ne se ferme pas si on ne fait rien**
Laisser la page ouverte pendant 2 minutes.
Résultat attendu : le polling continue, pas de redirection automatique tant que c'est `provisioning`
Résultat obtenu : [ ]

---

### B.7 — Après paiement — Succès

**B.7.1 — La page de confirmation s'affiche quand status = active**
Résultat attendu : affichage IP, port, identifiant, mot de passe
Résultat obtenu : [ ]

**B.7.2 — Le mot de passe est bien affiché (pas masqué)**
Résultat attendu : mot de passe en clair sur la page de confirmation
Résultat obtenu : [ ]

**B.7.3 — Un email a été reçu avec les mêmes infos**
Vérifier la boîte mail du client de test.
Résultat attendu : email reçu avec les accès correspondants à ceux affichés
Résultat obtenu : [ ]

**B.7.4 — La commande WooCommerce passe au statut "Terminée"**
Vérifier dans WooCommerce > Commandes.
Résultat attendu : statut "Terminée" ou "Complétée"
Résultat obtenu : [ ]

---

### B.8 — Après paiement — Échec du provisioning

**B.8.1 — La page d'erreur s'affiche quand status = failed**
> Utiliser un templateId invalide pour forcer l'échec
Résultat attendu : message "Une erreur est survenue lors du déploiement"
Résultat obtenu : [ ]

**B.8.2 — Le remboursement est déclenché automatiquement**
Résultat attendu : remboursement visible dans WooCommerce > Commandes
Résultat obtenu : [ ]

**B.8.3 — Comportement si le client ferme la page d'attente avant la fin**
Fermer l'onglet pendant le provisioning, puis rouvrir la commande dans l'espace client.
Résultat attendu : le statut du provisioning est toujours visible (actif ou échoué)
Résultat obtenu : [ ]

---

### B.9 — Timeout WordPress

**B.9.1 — Timeout après 3 minutes sans réponse**
> Mettre le backend hors ligne après le POST /provision
Résultat attendu : après 3 minutes, WordPress arrête le polling et déclenche le remboursement
Résultat obtenu : [ ]

---

## C — Tests d'intégration bout en bout

> Ces tests vérifient que WordPress + Backend + Proxmox fonctionnent ensemble.
> Les faire dans l'ordre, chaque test repart d'un état propre.

---

### C.1 — Parcours complet VPS (happy path)

**Étapes :**
1. Aller sur la page produit VPS
2. Vérifier que le bouton "Ajouter au panier" est actif
3. Configurer : 1 CPU, 1 Go RAM, 10 Go stockage
4. Ajouter au panier
5. Aller au checkout
6. Remplir les infos et passer la commande
7. Attendre la page de confirmation

**Résultats attendus :**
- [ ] Bouton actif à l'étape 2
- [ ] Réservation bien créée à l'étape 4 (`POST /cart/reserve` → 200)
- [ ] `POST /provision` appelé à l'étape 6 → 202
- [ ] Page d'attente visible à l'étape 7
- [ ] Status passe à `active` en moins de 3 minutes
- [ ] IP, port, identifiants affichés sur la page de confirmation
- [ ] Email d'accès reçu
- [ ] Container visible et actif dans Proxmox (vérifier l'interface Proxmox)
- [ ] Commande WooCommerce au bon statut

Durée totale du test : [ ]

---

### C.2 — Parcours complet VPN

Même étapes que C.1 avec le produit VPN.

**Résultats attendus :**
- [ ] Port affiché : 443 (pas 22)
- [ ] Username : root
- [ ] Container VPN actif dans Proxmox

---

### C.3 — Parcours complet NAS

Même étapes que C.1 avec le produit NAS.

**Résultats attendus :**
- [ ] URL affichée (https://IP) à la place de l'IP + port
- [ ] Username : admin (pas root)
- [ ] Container NAS actif dans Proxmox

---

### C.4 — Ressources indisponibles dès la page produit

**Étapes :**
1. Saturer artificiellement les ressources Proxmox (ou modifier temporairement les seuils)
2. Aller sur la page produit VPS

**Résultats attendus :**
- [ ] Bouton désactivé
- [ ] Message d'indisponibilité visible
- [ ] Impossible d'ajouter au panier
- [ ] Pas de requête `/cart/reserve` envoyée

---

### C.5 — Ressources épuisées entre l'ajout au panier et le paiement

**Étapes :**
1. Client A ajoute au panier (ressources réservées)
2. Les ressources restantes sont insuffisantes pour un deuxième client
3. Client B essaie d'ajouter le même produit au panier

**Résultats attendus :**
- [ ] Client A : réservation OK
- [ ] Client B : bouton désactivé ou message "plus disponible"
- [ ] Un seul container est créé au final

---

### C.6 — Deux clients passent commande en même temps

**Étapes :**
1. Ouvrir deux navigateurs (ou deux sessions)
2. Les deux ajoutent le même produit au panier simultanément
3. Les deux vont au checkout en même temps
4. Les deux paient en même temps

**Résultats attendus :**
- [ ] Un seul des deux obtient la réservation (`/cart/reserve`)
- [ ] Le second reçoit un 409 au moment de l'ajout ou du checkout
- [ ] Un seul container est créé sur Proxmox

---

### C.7 — Échec provisioning → remboursement automatique

**Étapes :**
1. Passer une commande avec un `templateId` inexistant (à configurer côté WooCommerce pour ce test)
2. Attendre la fin du polling

**Résultats attendus :**
- [ ] `POST /provision` → 202
- [ ] Polling renvoie `{ "status": "failed" }` après ~2 minutes
- [ ] Page d'erreur affichée côté WordPress
- [ ] Remboursement déclenché automatiquement
- [ ] Aucun container orphelin visible dans Proxmox (le backend doit avoir nettoyé)

---

### C.8 — Abandon panier + expiration réservation

**Étapes :**
1. Ajouter un produit au panier
2. Vérifier la réservation dans Redis :
   ```bash
   redis-cli keys "cart:rsv:*"
   ```
3. Vider le panier côté WordPress
4. Vérifier que la réservation a été supprimée dans Redis

**Résultats attendus :**
- [ ] Clé Redis présente après l'ajout au panier
- [ ] Clé Redis supprimée après abandon
- [ ] Les ressources sont à nouveau disponibles pour un autre client

---

### C.9 — Cron de nettoyage des containers expirés

> Ce test prend du temps — à faire en dehors des heures de pointe

**Étapes :**
1. Créer manuellement en BDD un service avec :
   - `status = 'suspended'`
   - `expires_at = NOW() - INTERVAL 1 MINUTE` (déjà expiré)
   - Un `vm_id` d'un container de test valide sur Proxmox
2. Attendre le prochain passage du cron (toutes les 24h, ou redémarrer le backend pour forcer le passage immédiat)

**Résultats attendus :**
- [ ] Container stoppé sur Proxmox
- [ ] Container supprimé sur Proxmox
- [ ] `status = 'deleted'` en BDD
- [ ] Email "service supprimé" reçu par le client

---

### C.10 — Coupure réseau backend pendant le provisioning

**Étapes :**
1. Lancer un provisioning (`POST /provision`)
2. Couper le backend (arrêter le serveur Node.js) pendant que le container se crée
3. Relancer le backend

**Résultats attendus :**
- [ ] Le service reste en `status = 'provisioning'` en BDD (pas de crash de la BDD)
- [ ] WordPress continue à poller et finit par atteindre le timeout de 3 minutes
- [ ] WordPress déclenche le remboursement
- [ ] Vérifier manuellement sur Proxmox s'il y a un container orphelin à nettoyer

---

### C.11 — Backend injoignable au moment de l'achat

**Étapes :**
1. Éteindre le backend Node.js
2. Aller sur la page produit

**Résultats attendus :**
- [ ] La page produit affiche le bouton actif (fail-open — on ne bloque pas les ventes si le backend est down)
- [ ] Le clic sur "Ajouter au panier" déclenche une erreur gérée proprement (pas de crash WordPress)
- [ ] Message affiché au client : "Service temporairement indisponible, réessayez dans quelques instants"

---

## Récapitulatif

| Section | Nb de tests | Passés | Échoués | Non testés |
|---------|-------------|--------|---------|------------|
| A — Backend | 28 | | | |
| B — WordPress | 22 | | | |
| C — Intégration | 11 | | | |
| **Total** | **61** | | | |
