# SYNJ Cloud — API Documentation

**Base URL :** `http://localhost:3000` (dev) · `https://api.synj.fr` (prod)  
**Format :** JSON (`Content-Type: application/json`)  
**Auth :** Bearer token dans le header `Authorization`

---

## Sommaire

- [Généralités](#généralités)
  - [Format des réponses](#format-des-réponses)
  - [Authentification](#authentification)
  - [Codes d'erreur et comportements](#codes-derreur-et-comportements)
- [Auth](#auth)
  - [POST /auth/wordpress](#post-authwordpress)
  - [POST /auth/refresh](#post-authrefresh)
  - [POST /auth/logout](#post-authlogout)
  - [GET /auth/me](#get-authme)

---

## Généralités

### Format des réponses

**Succès**
```json
{
  "user": { ... }
}
```

**Erreur**
```json
{
  "error": {
    "code": "CODE_ERREUR",
    "message": "Description lisible"
  }
}
```

Le champ `error.code` est la clé machine — c'est lui qu'il faut tester dans le code frontend, pas le `message` qui peut changer.

---

### Authentification

Les routes protégées nécessitent un **access token** dans le header :

```
Authorization: Bearer <accessToken>
```

**Durée de vie des tokens :**

| Token | Durée |
|---|---|
| Access token | 15 minutes |
| Refresh token | 7 jours |

**Stratégie recommandée côté frontend :**

1. Stocker `accessToken` en mémoire (variable JS), **jamais en localStorage**.
2. Stocker `refreshToken` en `httpOnly cookie` ou `localStorage` si cookie impossible.
3. Avant chaque requête, vérifier si l'access token est expiré (décoder le JWT, champ `exp`).
4. Si expiré → appeler `POST /auth/refresh` automatiquement, puis relancer la requête.
5. Si le refresh échoue (`REFRESH_REVOKED` ou `REFRESH_INVALID`) → déconnecter l'utilisateur et rediriger vers login.

---

### Codes d'erreur et comportements

| Code | HTTP | Cause | Comportement frontend |
|---|---|---|---|
| `VALIDATION_ERROR` | 400 | Champ manquant ou format invalide | Afficher le `message` à l'utilisateur sous le champ concerné |
| `BAD_REQUEST` | 400 | Requête malformée | Afficher une erreur générique |
| `WP_PAYLOAD_INVALID` | 400 | Payload WordPress incomplet | Erreur côté WordPress — logger et afficher "Connexion impossible" |
| `WP_TOKEN_EXPIRED` | 401 | Timestamp WordPress > 5 min | Redemander à WordPress de générer un nouveau payload |
| `WP_SIGNATURE_INVALID` | 401 | Signature HMAC incorrecte | Erreur de config WordPress — contacter le support |
| `UNAUTHORIZED` | 401 | Header `Authorization` absent | Rediriger vers login |
| `TOKEN_INVALID` | 401 | Access token malformé ou expiré | Tenter un refresh, sinon rediriger vers login |
| `REFRESH_INVALID` | 401 | Refresh token malformé ou expiré | Déconnecter, rediriger vers login |
| `REFRESH_REVOKED` | 401 | Refresh token révoqué (logout effectué) | Déconnecter, rediriger vers login |
| `USER_NOT_FOUND` | 401 | Utilisateur supprimé entre-temps | Déconnecter, rediriger vers login |
| `FORBIDDEN` | 403 | Accès refusé (rôle insuffisant) | Afficher "Accès refusé" |
| `NOT_FOUND` | 404 | Ressource introuvable | Afficher une page 404 |
| `CONFLICT` | 409 | Ressource déjà existante | Afficher le `message` à l'utilisateur |
| `INTERNAL_ERROR` | 500 | Erreur serveur inattendue | Afficher "Une erreur est survenue, réessayez" — ne pas afficher le `message` en prod |

**Gestion globale conseillée (intercepteur Axios / fetch) :**

```javascript
// Si 401 TOKEN_INVALID → tenter refresh
// Si 401 REFRESH_REVOKED / REFRESH_INVALID / USER_NOT_FOUND → logout forcé
// Si 500 → toast erreur générique
// Tous les autres → laisser chaque composant gérer
```

---

## Auth

### POST /auth/wordpress

Authentifie un utilisateur via un payload signé par WordPress. Retourne les tokens JWT.

WordPress génère ce payload côté serveur avec un HMAC-SHA256 sur le secret partagé `WORDPRESS_SECRET`.

**Aucun token requis.**

#### Request body

| Champ | Type | Requis | Description |
|---|---|---|---|
| `wordpress_id` | `integer` | ✅ | ID utilisateur WordPress |
| `email` | `string` | ✅ | Email (format email valide) |
| `first_name` | `string` | ✅ | Prénom |
| `last_name` | `string` | ❌ | Nom (défaut : `""`) |
| `timestamp` | `integer` | ✅ | Timestamp Unix en ms au moment de la génération |
| `signature` | `string` | ✅ | HMAC-SHA256 hex 64 chars de `"wordpress_id:email:timestamp"` |

```json
{
  "wordpress_id": 42,
  "email": "amine@synj.fr",
  "first_name": "Amine",
  "last_name": "Delhem",
  "timestamp": 1779970482423,
  "signature": "79723d4cbf0e7239f70c089105fc12264c63636aea770c67f0ae18674d6213ee"
}
```

#### Réponse succès `200`

```json
{
  "accessToken": "eyJhbGci...",
  "refreshToken": "eyJhbGci...",
  "user": {
    "id": 1,
    "wordpress_id": 42,
    "email": "amine@synj.fr",
    "first_name": "Amine",
    "last_name": "Delhem",
    "role": "client",
    "status": "active",
    "created_at": "2026-05-28T10:00:00.000Z"
  }
}
```

**Champs user :**

| Champ | Type | Description |
|---|---|---|
| `id` | `integer` | ID interne SYNJ |
| `wordpress_id` | `integer` | ID WordPress |
| `email` | `string` | Email |
| `first_name` | `string` | Prénom |
| `last_name` | `string` | Nom |
| `role` | `"client"` \| `"tech"` \| `"admin"` | Rôle |
| `status` | `"active"` \| `"suspended"` \| `"deleted"` | Statut du compte |
| `created_at` | `string` (ISO 8601) | Date de création |

#### Erreurs possibles

| Code | HTTP | Cause |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Champ manquant ou format invalide |
| `WP_PAYLOAD_INVALID` | 400 | Champs requis manquants dans le payload |
| `WP_TOKEN_EXPIRED` | 401 | `timestamp` vieux de plus de 5 minutes |
| `WP_SIGNATURE_INVALID` | 401 | Signature HMAC incorrecte |

> **Rate limit :** 10 requêtes / minute par IP.

---

### POST /auth/refresh

Émet un nouvel `accessToken` et `refreshToken` à partir d'un refresh token valide. L'ancien refresh token est **révoqué** à chaque appel (rotation).

**Aucun token requis.**

#### Request body

| Champ | Type | Requis | Description |
|---|---|---|---|
| `refreshToken` | `string` | ✅ | Refresh token obtenu lors du login |

```json
{
  "refreshToken": "eyJhbGci..."
}
```

#### Réponse succès `200`

```json
{
  "accessToken": "eyJhbGci...",
  "refreshToken": "eyJhbGci..."
}
```

#### Erreurs possibles

| Code | HTTP | Cause |
|---|---|---|
| `VALIDATION_ERROR` | 400 | `refreshToken` absent |
| `REFRESH_INVALID` | 401 | Token malformé ou expiré (> 7 jours) |
| `REFRESH_REVOKED` | 401 | Token déjà révoqué (logout ou rotation précédente) |
| `USER_NOT_FOUND` | 401 | Compte supprimé depuis l'émission du token |

---

### POST /auth/logout

Révoque le refresh token de l'utilisateur connecté. L'access token reste valide jusqu'à son expiration naturelle (15 min max).

**Token requis.** `Authorization: Bearer <accessToken>`

#### Request body

Aucun.

#### Réponse succès `200`

```json
{
  "message": "Déconnecté"
}
```

#### Erreurs possibles

| Code | HTTP | Cause |
|---|---|---|
| `UNAUTHORIZED` | 401 | Header `Authorization` absent |
| `TOKEN_INVALID` | 401 | Access token invalide ou expiré |

---

### GET /auth/me

Retourne les informations de l'utilisateur connecté.

**Token requis.** `Authorization: Bearer <accessToken>`

#### Request body

Aucun.

#### Réponse succès `200`

```json
{
  "user": {
    "id": 1,
    "wordpress_id": 42,
    "email": "amine@synj.fr",
    "first_name": "Amine",
    "last_name": "Delhem",
    "role": "client",
    "status": "active",
    "created_at": "2026-05-28T10:00:00.000Z"
  }
}
```

#### Erreurs possibles

| Code | HTTP | Cause |
|---|---|---|
| `UNAUTHORIZED` | 401 | Header `Authorization` absent |
| `TOKEN_INVALID` | 401 | Access token invalide ou expiré |
