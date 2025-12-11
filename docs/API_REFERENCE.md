# Castor - API Reference

## Base URL
```
Production: https://castor.app/api
Development: http://localhost:3000/api
```

## Autenticación
Todas las rutas (excepto `/api/auth/*`) requieren sesión activa via cookie.

---

## Auth

### POST /api/auth/neynar
Callback de autenticación Neynar SIWN.

**Body:**
```json
{
  "signer_uuid": "string",
  "fid": "number",
  "user": {
    "username": "string",
    "display_name": "string",
    "pfp_url": "string"
  }
}
```

**Response:** Redirect a `/`

### GET /api/auth/logout
Cerrar sesión.

**Response:** Redirect a `/landing`

---

## Me (Usuario actual)

### GET /api/me
Obtener usuario actual y sus cuentas.

**Response:**
```json
{
  "user": {
    "id": "string",
    "address": "string"
  },
  "accounts": [
    {
      "id": "string",
      "fid": "number",
      "username": "string",
      "displayName": "string",
      "pfpUrl": "string",
      "isPremium": "boolean"
    }
  ]
}
```

---

## Casts

### GET /api/casts
Lista de casts del usuario.

**Query params:**
- `status`: `draft` | `scheduled` | `published` | `failed`
- `accountId`: Filtrar por cuenta

**Response:**
```json
{
  "casts": [
    {
      "id": "string",
      "content": "string",
      "channelId": "string | null",
      "scheduledAt": "ISO string",
      "status": "string",
      "account": {
        "username": "string",
        "pfpUrl": "string"
      },
      "media": [
        {
          "url": "string",
          "type": "image | video"
        }
      ]
    }
  ]
}
```

### POST /api/casts/schedule
Programar un cast.

**Body:**
```json
{
  "accountId": "string",
  "content": "string",
  "channelId": "string (optional)",
  "scheduledAt": "ISO string",
  "embeds": [
    {
      "url": "string",
      "type": "image | video (optional)"
    }
  ],
  "parentHash": "string (optional, for replies)",
  "isDraft": "boolean (optional)"
}
```

**Response:**
```json
{
  "cast": {
    "id": "string",
    "status": "scheduled | draft"
  }
}
```

### POST /api/casts/publish
Publicar cast inmediatamente.

**Body:**
```json
{
  "accountId": "string",
  "content": "string",
  "channelId": "string (optional)",
  "embeds": [{ "url": "string" }],
  "parentHash": "string (optional)"
}
```

**Response:**
```json
{
  "success": true,
  "hash": "0x..."
}
```

### POST /api/casts/schedule-thread
Programar un thread (múltiples casts).

**Body:**
```json
{
  "accountId": "string",
  "channelId": "string (optional)",
  "scheduledAt": "ISO string",
  "casts": [
    {
      "content": "string",
      "embeds": [{ "url": "string" }]
    }
  ]
}
```

### PATCH /api/casts/[id]
Actualizar cast programado/borrador.

**Body:** (campos opcionales)
```json
{
  "content": "string",
  "channelId": "string",
  "scheduledAt": "ISO string",
  "embeds": []
}
```

### DELETE /api/casts/[id]
Eliminar cast.

---

## Feed

### GET /api/feed
Obtener feed de Farcaster.

**Query params:**
- `type`: `following` | `trending` | `channel`
- `channelId`: Requerido si type=channel
- `cursor`: Para paginación

**Response:**
```json
{
  "casts": [
    {
      "hash": "string",
      "author": {
        "fid": "number",
        "username": "string",
        "display_name": "string",
        "pfp_url": "string"
      },
      "text": "string",
      "timestamp": "ISO string",
      "reactions": {
        "likes_count": "number",
        "recasts_count": "number"
      },
      "replies": { "count": "number" },
      "embeds": []
    }
  ],
  "next": { "cursor": "string" }
}
```

### GET /api/feed/user/[fid]
Casts de un usuario específico.

**Query params:**
- `cursor`: Para paginación

---

## Accounts

### GET /api/accounts
Lista de cuentas del usuario.

### POST /api/accounts/connect
Conectar nueva cuenta (via Neynar).

### DELETE /api/accounts/[id]
Desconectar cuenta.

### GET /api/accounts/[id]/context
Obtener knowledge base de cuenta.

**Response:**
```json
{
  "brandVoice": "string",
  "bio": "string",
  "expertise": ["string"],
  "alwaysDo": ["string"],
  "neverDo": ["string"],
  "hashtags": ["string"]
}
```

### PUT /api/accounts/[id]/context
Actualizar knowledge base.

**Body:** (todos opcionales)
```json
{
  "brandVoice": "string",
  "bio": "string",
  "expertise": ["string"],
  "alwaysDo": ["string"],
  "neverDo": ["string"],
  "hashtags": ["string"]
}
```

### GET /api/accounts/[id]/style-profile
Analizar estilo de escritura con AI (basado en últimos 1000 casts).

**Response:**
```json
{
  "profile": {
    "tone": "string",
    "topics": ["string"],
    "avgLength": "number",
    "emojiUsage": "string",
    "hashtagUsage": "string"
  }
}
```

---

## Analytics

### GET /api/analytics
Métricas de analytics.

**Query params:**
- `accountId`: Filtrar por cuenta
- `period`: `7` | `30` | `90` (días)

**Response:**
```json
{
  "accounts": [
    {
      "id": "string",
      "username": "string",
      "pfpUrl": "string"
    }
  ],
  "totals": {
    "casts": "number",
    "likes": "number",
    "recasts": "number",
    "replies": "number"
  },
  "topCasts": [
    {
      "castHash": "string",
      "content": "string",
      "likes": "number",
      "recasts": "number",
      "replies": "number",
      "publishedAt": "ISO string"
    }
  ]
}
```

### POST /api/analytics/backfill
Importar casts históricos de Neynar.

**Body:**
```json
{
  "accountId": "string (optional)",
  "limit": "number (default: 100)"
}
```

**Response:**
```json
{
  "importedCasts": "number",
  "skippedCasts": "number"
}
```

### GET /api/analytics/insights
AI insights sobre rendimiento (cacheado 24h).

**Query params:**
- `accountId`: Requerido
- `refresh`: `true` para forzar regeneración

**Response:**
```json
{
  "insights": {
    "summary": "string",
    "bestHours": ["10:00", "18:00"],
    "bestDays": ["Monday", "Wednesday"],
    "avgEngagement": "number",
    "topPerformingTopics": ["string"],
    "recommendations": ["string"]
  },
  "stats": {
    "totalCasts": "number",
    "avgEngagement": "number",
    "topPerformers": "number",
    "lowPerformers": "number"
  },
  "cached": "boolean",
  "generatedAt": "ISO string",
  "expiresAt": "ISO string"
}
```

### POST /api/analytics/chat
Chat con AI sobre analytics.

**Body:**
```json
{
  "question": "string",
  "accountId": "string",
  "insights": {},
  "stats": {},
  "history": [
    {
      "role": "user | assistant",
      "content": "string"
    }
  ]
}
```

**Response:**
```json
{
  "answer": "string"
}
```

---

## Channels

### GET /api/channels
Buscar canales.

**Query params:**
- `q`: Query de búsqueda

**Response:**
```json
{
  "channels": [
    {
      "id": "string",
      "name": "string",
      "description": "string",
      "image_url": "string",
      "follower_count": "number"
    }
  ]
}
```

### GET /api/channels/favorites
Canales favoritos del usuario.

### POST /api/channels/favorites
Añadir canal a favoritos.

**Body:**
```json
{
  "channelId": "string"
}
```

### DELETE /api/channels/favorites
Quitar de favoritos.

**Body:**
```json
{
  "channelId": "string"
}
```

### POST /api/channels/track
Trackear uso de canal (para recientes).

**Body:**
```json
{
  "channelId": "string"
}
```

---

## Templates

### GET /api/templates
Templates de cuenta.

**Query params:**
- `accountId`: Requerido

### POST /api/templates
Crear template.

**Body:**
```json
{
  "accountId": "string",
  "name": "string",
  "content": "string",
  "channelId": "string (optional)"
}
```

### DELETE /api/templates/[id]
Eliminar template.

---

## AI

### POST /api/ai/assistant
Asistente de escritura.

**Body:**
```json
{
  "action": "ideas | improve | generate | continue | shorter | longer | professional | casual",
  "content": "string (optional)",
  "topic": "string (optional)",
  "accountId": "string (optional, for context)"
}
```

**Response:**
```json
{
  "result": "string",
  "suggestions": ["string"] // solo para action=ideas
}
```

### POST /api/ai/translate
Traducir texto.

**Body:**
```json
{
  "text": "string",
  "targetLanguage": "es | en | fr | de | pt"
}
```

---

## Media

### POST /api/media/upload
Subir imagen a Cloudflare.

**Body:** `multipart/form-data`
- `file`: Archivo de imagen

**Response:**
```json
{
  "url": "https://imagedelivery.net/.../public",
  "cloudflareId": "string"
}
```

### POST /api/media/video
Subir video a Livepeer.

**Body:** `multipart/form-data`
- `file`: Archivo de video

**Response:**
```json
{
  "url": "https://lp-playback.com/hls/.../index.m3u8",
  "livepeerAssetId": "string",
  "livepeerPlaybackId": "string"
}
```

---

## Reactions (Neynar proxy)

### POST /api/reactions
Like o recast.

**Body:**
```json
{
  "accountId": "string",
  "castHash": "string",
  "type": "like | recast"
}
```

### DELETE /api/reactions
Quitar like o recast.

**Body:**
```json
{
  "accountId": "string",
  "castHash": "string",
  "type": "like | recast"
}
```

---

## Users (Neynar proxy)

### GET /api/users/search
Buscar usuarios.

**Query params:**
- `q`: Query de búsqueda

### GET /api/users/[fid]
Info de usuario por FID.

### GET /api/users/by-username/[username]
Info de usuario por username.
