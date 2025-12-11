# Castor iOS - Guía de Migración

## Resumen

Esta guía describe cómo crear una app nativa iOS para Castor, reutilizando el backend existente y la lógica de negocio donde sea posible.

## Opciones de Stack

### Opción A: React Native + Expo (Recomendado)
```
Esfuerzo: ~2-3 semanas MVP
Reutilización: Alta (TypeScript, hooks, tipos)
```

**Pros:**
- Mismo lenguaje (TypeScript)
- Reutilizar hooks y lógica
- Expo Router similar a Next.js App Router
- Hot reload, fácil testing
- Un codebase para iOS y Android

**Cons:**
- No 100% nativo
- Dependencia de Expo/RN

### Opción B: SwiftUI (100% Nativo)
```
Esfuerzo: ~4-6 semanas MVP
Reutilización: Baja (solo API)
```

**Pros:**
- Mejor integración iOS
- Performance óptimo
- Acceso completo a APIs de Apple

**Cons:**
- Reescribir todo en Swift
- Solo iOS (no Android)
- Curva de aprendizaje

---

## Arquitectura Propuesta (Expo)

```
castor-ios/
├── app/                      # Expo Router
│   ├── (tabs)/
│   │   ├── _layout.tsx       # Tab navigator
│   │   ├── index.tsx         # Feed
│   │   ├── studio.tsx        # Compose
│   │   ├── analytics.tsx     # Analytics
│   │   └── settings.tsx      # Settings
│   ├── (auth)/
│   │   └── login.tsx         # Login
│   ├── user/
│   │   └── [username].tsx    # Profile
│   └── _layout.tsx           # Root layout
├── components/
│   ├── feed/
│   │   ├── CastCard.tsx
│   │   ├── FeedList.tsx
│   │   └── FeedTabs.tsx
│   ├── compose/
│   │   ├── ComposeSheet.tsx
│   │   ├── MediaPicker.tsx
│   │   └── ChannelPicker.tsx
│   ├── common/
│   │   ├── Avatar.tsx
│   │   ├── Button.tsx
│   │   └── Input.tsx
│   └── analytics/
│       ├── StatsCards.tsx
│       └── InsightsChat.tsx
├── hooks/                    # Reutilizar de web
│   ├── useAccounts.ts
│   ├── useTemplates.ts
│   ├── useFeed.ts
│   └── useAnalytics.ts
├── services/
│   ├── api.ts               # Cliente API
│   ├── auth.ts              # Manejo de auth
│   └── storage.ts           # AsyncStorage/Keychain
├── lib/
│   ├── constants.ts         # Reutilizar
│   ├── types.ts             # Reutilizar
│   └── utils.ts             # Reutilizar
└── assets/
    └── images/
```

---

## Componentes por Reutilización

### ✅ Reutilizar Directamente
```typescript
// Tipos
src/lib/db/schema.ts          → types.ts (solo tipos, no Drizzle)
src/components/compose/types.ts → types.ts

// Constantes
src/lib/compose/constants.ts  → constants.ts
// MAX_CHARS_STANDARD, MAX_CHARS_PRO, etc.

// Utilidades
src/lib/url-utils.ts          → utils.ts
src/lib/utils.ts              → utils.ts (cn() no aplica)

// Validaciones
src/lib/validations/index.ts  → validations.ts
```

### 🔄 Adaptar
```typescript
// Hooks (cambiar fetch por cliente nativo)
src/hooks/useAccounts.ts      → adaptar fetch
src/hooks/useTemplates.ts     → adaptar fetch
src/hooks/useUserChannels.ts  → adaptar fetch

// Contexto
src/context/SelectedAccountContext.tsx → React Context o Zustand
```

### ❌ Reescribir (UI Nativa)
```
Todos los componentes de src/components/
- Usar React Native components
- NativeWind para estilos (Tailwind en RN)
- React Native Gesture Handler
- Expo Image, Expo Video
```

---

## Dependencias Recomendadas (Expo)

```json
{
  "dependencies": {
    "expo": "~52.0.0",
    "expo-router": "~4.0.0",
    "expo-image": "~2.0.0",
    "expo-video": "~2.0.0",
    "expo-secure-store": "~14.0.0",
    "expo-image-picker": "~16.0.0",
    "expo-notifications": "~0.29.0",
    
    "nativewind": "^4.0.0",
    "tailwindcss": "^3.4.0",
    
    "@tanstack/react-query": "^5.0.0",
    "zustand": "^5.0.0",
    
    "react-native-gesture-handler": "~2.20.0",
    "react-native-reanimated": "~3.16.0",
    "react-native-safe-area-context": "~4.12.0"
  }
}
```

---

## Autenticación en iOS

### Opción 1: WebView para Neynar SIWN
```typescript
// Abrir WebView con URL de auth
const authUrl = `https://app.neynar.com/login?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT}`

// Capturar redirect con token
// Guardar en Keychain (expo-secure-store)
```

### Opción 2: WalletConnect (Nativo)
```typescript
// Usar WalletConnect para firmar
// Implementar SIWE manualmente
// Más complejo pero mejor UX
```

### Almacenamiento de Sesión
```typescript
import * as SecureStore from 'expo-secure-store'

// Guardar token
await SecureStore.setItemAsync('session_token', token)

// Obtener token
const token = await SecureStore.getItemAsync('session_token')

// Eliminar token (logout)
await SecureStore.deleteItemAsync('session_token')
```

---

## Cliente API

```typescript
// services/api.ts
import * as SecureStore from 'expo-secure-store'

const API_BASE = 'https://castor.app/api'

class CastorAPI {
  private token: string | null = null

  async init() {
    this.token = await SecureStore.getItemAsync('session_token')
  }

  private async fetch<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<T> {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`,
        ...options?.headers,
      },
    })
    
    if (!res.ok) {
      const error = await res.json()
      throw new Error(error.message || 'API Error')
    }
    
    return res.json()
  }

  // Feed
  async getFeed(type: 'following' | 'trending', cursor?: string) {
    const params = new URLSearchParams({ type })
    if (cursor) params.set('cursor', cursor)
    return this.fetch(`/feed?${params}`)
  }

  // Casts
  async publishCast(data: PublishCastData) {
    return this.fetch('/casts/publish', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  // Analytics
  async getAnalytics(accountId: string, period: number) {
    return this.fetch(`/analytics?accountId=${accountId}&period=${period}`)
  }

  async getInsights(accountId: string) {
    return this.fetch(`/analytics/insights?accountId=${accountId}`)
  }

  // ... más métodos
}

export const api = new CastorAPI()
```

---

## Navegación (Expo Router)

```typescript
// app/(tabs)/_layout.tsx
import { Tabs } from 'expo-router'
import { Home, PenSquare, BarChart3, Settings } from 'lucide-react-native'

export default function TabLayout() {
  return (
    <Tabs screenOptions={{
      tabBarActiveTintColor: '#6366f1',
      headerShown: false,
    }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Feed',
          tabBarIcon: ({ color }) => <Home size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="studio"
        options={{
          title: 'Studio',
          tabBarIcon: ({ color }) => <PenSquare size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="analytics"
        options={{
          title: 'Analytics',
          tabBarIcon: ({ color }) => <BarChart3 size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color }) => <Settings size={24} color={color} />,
        }}
      />
    </Tabs>
  )
}
```

---

## Componente Ejemplo: CastCard

```typescript
// components/feed/CastCard.tsx
import { View, Text, Pressable, Image } from 'react-native'
import { Heart, Repeat2, MessageCircle } from 'lucide-react-native'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

interface CastCardProps {
  cast: Cast
  onLike: () => void
  onRecast: () => void
  onReply: () => void
}

export function CastCard({ cast, onLike, onRecast, onReply }: CastCardProps) {
  return (
    <View className="p-4 border-b border-gray-200 dark:border-gray-800">
      {/* Header */}
      <View className="flex-row items-center gap-3 mb-2">
        <Image
          source={{ uri: cast.author.pfp_url }}
          className="w-10 h-10 rounded-full"
        />
        <View className="flex-1">
          <Text className="font-semibold text-foreground">
            {cast.author.display_name}
          </Text>
          <Text className="text-sm text-muted-foreground">
            @{cast.author.username} · {formatDistanceToNow(new Date(cast.timestamp), { locale: es, addSuffix: true })}
          </Text>
        </View>
      </View>

      {/* Content */}
      <Text className="text-foreground mb-3">{cast.text}</Text>

      {/* Actions */}
      <View className="flex-row gap-6">
        <Pressable onPress={onLike} className="flex-row items-center gap-1">
          <Heart size={18} color="#6b7280" />
          <Text className="text-muted-foreground">{cast.reactions.likes_count}</Text>
        </Pressable>
        
        <Pressable onPress={onRecast} className="flex-row items-center gap-1">
          <Repeat2 size={18} color="#6b7280" />
          <Text className="text-muted-foreground">{cast.reactions.recasts_count}</Text>
        </Pressable>
        
        <Pressable onPress={onReply} className="flex-row items-center gap-1">
          <MessageCircle size={18} color="#6b7280" />
          <Text className="text-muted-foreground">{cast.replies.count}</Text>
        </Pressable>
      </View>
    </View>
  )
}
```

---

## Features iOS-Específicas

### Push Notifications
```typescript
// Usar expo-notifications
import * as Notifications from 'expo-notifications'

// Registrar para push
const token = await Notifications.getExpoPushTokenAsync()
// Enviar token al backend

// Manejar notificación recibida
Notifications.addNotificationReceivedListener(notification => {
  // Mostrar en-app notification
})
```

### Share Extension
```
// Permitir compartir texto/links a Castor desde otras apps
// Requiere configuración nativa adicional
```

### Deep Links
```typescript
// app.json
{
  "expo": {
    "scheme": "castor",
    "ios": {
      "associatedDomains": ["applinks:castor.app"]
    }
  }
}

// Manejar: castor://user/username
// Manejar: https://castor.app/user/username
```

### Haptic Feedback
```typescript
import * as Haptics from 'expo-haptics'

// En acciones como like, recast
Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
```

---

## Pasos para Empezar

1. **Crear proyecto Expo**
   ```bash
   npx create-expo-app castor-ios --template tabs
   cd castor-ios
   ```

2. **Instalar dependencias**
   ```bash
   npx expo install nativewind tailwindcss
   npx expo install @tanstack/react-query zustand
   npx expo install expo-secure-store expo-image-picker
   ```

3. **Configurar NativeWind**
   ```bash
   # Seguir docs: https://www.nativewind.dev/getting-started/expo-router
   ```

4. **Copiar archivos reutilizables**
   - `types.ts`
   - `constants.ts`
   - `validations.ts`

5. **Crear cliente API**
   - Basado en endpoints documentados

6. **Implementar auth**
   - WebView + SecureStore

7. **Crear componentes UI**
   - CastCard, FeedList, ComposeSheet, etc.

8. **Testing en dispositivo**
   ```bash
   npx expo start
   # Escanear QR con Expo Go
   ```

9. **Build para App Store**
   ```bash
   eas build --platform ios
   ```

---

## Estimación de Tiempo

| Fase | Tiempo | Descripción |
|------|--------|-------------|
| Setup | 1 día | Expo, dependencias, config |
| Auth | 2-3 días | WebView + SecureStore |
| Feed | 3-4 días | Lista, CastCard, infinite scroll |
| Compose | 3-4 días | Editor, media, channel picker |
| Analytics | 2-3 días | Stats, AI chat |
| Settings | 1-2 días | Accounts, preferencias |
| Polish | 3-4 días | Animaciones, haptics, edge cases |
| **Total** | **~3 semanas** | MVP funcional |

---

## Recursos

- [Expo Docs](https://docs.expo.dev/)
- [Expo Router](https://docs.expo.dev/router/introduction/)
- [NativeWind](https://www.nativewind.dev/)
- [React Query](https://tanstack.com/query/latest)
- [Zustand](https://zustand-demo.pmnd.rs/)
