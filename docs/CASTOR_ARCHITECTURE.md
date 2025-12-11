# Castor - Arquitectura y Documentación

## Descripción General

Castor es un cliente de Farcaster (red social descentralizada crypto) que permite:
- Publicar y programar casts (posts)
- Gestionar múltiples cuentas
- Ver feed (Following, Trending, Canales)
- Analytics con AI insights
- Asistente de escritura con IA

## Stack Tecnológico

| Categoría | Tecnología |
|-----------|------------|
| Framework | Next.js 16 (App Router) |
| UI | React 19 + TailwindCSS + shadcn/ui |
| Base de datos | SQLite (Turso) + Drizzle ORM |
| Auth | SIWE (Sign In With Ethereum) via Neynar |
| APIs externas | Neynar (Farcaster), Google Gemini (AI) |
| Media | Cloudflare Images, Livepeer (video) |
| Deploy | Netlify |

## Estructura de Carpetas

```
src/
├── app/
│   ├── (app)/              # Rutas autenticadas
│   │   ├── page.tsx        # Feed (home)
│   │   ├── studio/         # Composer + Drafts
│   │   ├── analytics/      # Analytics con AI
│   │   ├── accounts/       # Gestión de cuentas
│   │   ├── settings/       # Configuración
│   │   └── user/[username] # Perfil de usuario
│   ├── (public)/           # Rutas públicas
│   │   └── landing/        # Landing page
│   └── api/                # API Routes
├── components/
│   ├── compose/            # Editor de casts
│   ├── feed/               # Feed y cast cards
│   ├── layout/             # Sidebar, nav, header
│   ├── profile/            # Perfil de usuario
│   ├── ai/                 # Componentes de AI
│   └── ui/                 # shadcn/ui components
├── hooks/                  # Custom hooks
├── lib/
│   ├── db/                 # Schema Drizzle + conexión
│   ├── ai/                 # Lógica de AI (Castor AI)
│   └── utils.ts            # Utilidades
└── context/                # React Context providers
```

## Base de Datos (Schema)

### Tablas Principales

```typescript
// Usuarios
users: {
  id: string (PK)
  address: string (wallet)
  createdAt: timestamp
}

// Cuentas de Farcaster
accounts: {
  id: string (PK)
  ownerId: string (FK -> users)
  fid: number (Farcaster ID)
  username: string
  displayName: string
  pfpUrl: string
  signerUuid: string (Neynar signer)
  isPremium: boolean
  isShared: boolean
}

// Casts programados/borradores
casts: {
  id: string (PK)
  accountId: string (FK -> accounts)
  content: string
  channelId: string?
  scheduledAt: timestamp
  status: 'draft' | 'scheduled' | 'published' | 'failed'
  publishedHash: string?
  parentHash: string? (para replies)
}

// Media adjuntos
castMedia: {
  id: string (PK)
  castId: string (FK -> casts)
  url: string
  type: 'image' | 'video'
  cloudflareId: string?
  livepeerAssetId: string?
}

// Templates
templates: {
  id: string (PK)
  accountId: string (FK -> accounts)
  name: string
  content: string
  channelId: string?
}

// Analytics de casts
castAnalytics: {
  id: string (PK)
  accountId: string (FK -> accounts)
  castHash: string
  content: string
  likes: number
  recasts: number
  replies: number
  publishedAt: timestamp
}

// Cache de AI insights
analyticsInsightsCache: {
  id: string (PK)
  accountId: string (FK -> accounts)
  insights: JSON string
  stats: JSON string
  generatedAt: timestamp
  expiresAt: timestamp (24h)
}

// Knowledge Base por cuenta
accountKnowledgeBase: {
  id: string (PK)
  accountId: string (FK -> accounts)
  brandVoice: string
  bio: string
  expertise: string[]
  alwaysDo: string[]
  neverDo: string[]
  hashtags: string[]
}

// Canales favoritos del usuario
userChannels: {
  id: string (PK)
  userId: string (FK -> users)
  channelId: string
  type: 'favorite' | 'recent'
  lastUsedAt: timestamp
}
```

## Integraciones Externas

### Neynar API (Farcaster)

```typescript
// Base URL
const NEYNAR_API = 'https://api.neynar.com/v2/farcaster'

// Headers
{ 'x-api-key': process.env.NEYNAR_API_KEY }

// Endpoints principales:
GET /feed?feed_type=following&fid={fid}      // Feed following
GET /feed/trending                            // Feed trending
GET /feed/channels?channel_ids={id}           // Feed de canal
GET /feed/user/casts?fid={fid}               // Casts de usuario
GET /user/bulk?fids={fid}                    // Info de usuarios
GET /user/search?q={query}                   // Buscar usuarios
GET /channel/search?q={query}                // Buscar canales
POST /cast                                    // Publicar cast
POST /reaction                                // Like/Recast
POST /signer                                  // Crear signer
```

### Google Gemini API (AI)

```typescript
import { GoogleGenAI } from '@google/genai'

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })

// Modelo usado
const model = 'gemini-2.0-flash'

// Uso
const response = await ai.models.generateContent({
  model: 'gemini-2.0-flash',
  contents: prompt,
})
const text = response.text
```

### Cloudflare Images

```typescript
// Upload
POST https://api.cloudflare.com/client/v4/accounts/{account_id}/images/v1
Authorization: Bearer {CLOUDFLARE_IMAGES_API_KEY}
Content-Type: multipart/form-data

// URL resultante
https://imagedelivery.net/{account_hash}/{image_id}/public
```

### Livepeer (Video)

```typescript
// Request upload URL
POST https://livepeer.studio/api/asset/request-upload
Authorization: Bearer {LIVEPEER_API_KEY}

// Playback URL
https://lp-playback.com/hls/{playbackId}/index.m3u8
```

## Variables de Entorno

```env
# Database (Turso)
DATABASE_URL=libsql://...
DATABASE_AUTH_TOKEN=...

# Auth
SESSION_SECRET=...

# Neynar (Farcaster)
NEYNAR_API_KEY=...
NEYNAR_WEBHOOK_SECRET=...
FARCASTER_DEVELOPER_MNEMONIC=...

# AI
GEMINI_API_KEY=...

# Media
CLOUDFLARE_ACCOUNT_ID=...
CLOUDFLARE_IMAGES_API_KEY=...
LIVEPEER_API_KEY=...

# App
NEXT_PUBLIC_APP_URL=https://...
NEXT_PUBLIC_GIPHY_API_KEY=...
ALLOWED_FIDS=... (opcional, para beta cerrada)
```

## Límites de Farcaster

```typescript
// Caracteres
MAX_CHARS_STANDARD = 1024
MAX_CHARS_PRO = 10000

// Embeds (imágenes, videos, links)
MAX_EMBEDS_STANDARD = 2
MAX_EMBEDS_PRO = 4
```

## Flujos Principales

### 1. Autenticación
1. Usuario hace clic en "Sign In"
2. Se abre popup de Neynar SIWN (Sign In With Neynar)
3. Usuario aprueba con su wallet de Farcaster
4. Callback a `/api/auth/neynar` con datos
5. Se crea/actualiza usuario y cuenta en DB
6. Se guarda sesión en cookie cifrada

### 2. Publicar Cast
1. Usuario escribe en ComposeCard
2. Selecciona cuenta y canal (opcional)
3. Adjunta media (opcional) - se sube a Cloudflare/Livepeer
4. Click "Publicar" o "Programar"
5. Si publicar: POST a Neynar API inmediatamente
6. Si programar: Guarda en DB, cron job lo publica

### 3. AI Insights
1. Usuario va a /analytics
2. Selecciona cuenta
3. Si tiene cache válido (<24h): devuelve cache
4. Si no: obtiene últimos 100 casts de DB
5. Envía a Gemini para análisis
6. Guarda resultado en cache
7. Muestra: mejores horas, días, recomendaciones

### 4. Asistente AI
1. Usuario escribe prompt o selecciona acción
2. Se obtiene knowledge base de la cuenta
3. Se construye system prompt con contexto
4. Gemini genera respuesta
5. Usuario puede editar y publicar
