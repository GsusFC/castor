# Sistema de Notificaciones en Tiempo Real

Este documento explica cómo funciona el sistema de notificaciones de Castor y cómo está optimizado para funcionar en Netlify.

## Problema

**Netlify no soporta Server-Sent Events (SSE) de larga duración** debido a:
- Timeout de funciones serverless: 10s (síncronas), 26s (asíncronas)
- Los proxies cierran conexiones que no envían datos constantemente
- No hay soporte real para conexiones persistentes

Esto causaba que el EventSource se conectara y fallara inmediatamente en bucle:

```
[Notifications] Stream connected ✅
[Notifications] Stream error, reconnecting... ❌
[Notifications] Stream connected ✅
[Notifications] Stream error, reconnecting... ❌
```

## Solución: Estrategia Adaptativa (SSE + Polling Fallback)

El sistema ahora usa una **estrategia adaptativa**:

1. **Intenta SSE primero** (si `NEXT_PUBLIC_USE_SSE !== 'false'`)
2. **Detecta fallos rápidos** (< 10 segundos)
3. **Cambia automáticamente a polling** después de 3 fallos rápidos
4. **Polling cada 30 segundos** para reducir carga en la API

### Flujo de Detección

```typescript
// Si SSE falla 3 veces en < 10 segundos
if (fastFailuresCount >= 3) {
  console.warn('Too many fast failures, switching to polling')
  setUsePolling(true)
}
```

### Polling Mode

```typescript
// Fetch cada 30 segundos
setInterval(() => {
  fetch('/api/notifications?since=2024-01-24T10:00:00Z')
}, 30000)
```

## Endpoints

### 1. `/api/notifications/stream` (SSE)

Endpoint de Server-Sent Events para notificaciones en tiempo real.

**Limitación**: No funciona bien en Netlify (se cierra rápidamente).

**Uso**: Automático si SSE está habilitado y funciona.

```typescript
const eventSource = new EventSource('/api/notifications/stream')
eventSource.onmessage = (event) => {
  const notification = JSON.parse(event.data)
  // Procesar notificación
}
```

### 2. `/api/notifications` (Polling)

Endpoint GET para obtener notificaciones recientes.

**Query Params**:
- `since` (opcional): ISO timestamp para obtener solo notificaciones nuevas
- `limit` (opcional): número máximo de notificaciones (default: 20, max: 50)

**Respuesta**:
```json
{
  "notifications": [
    {
      "id": "notif_123",
      "type": "like",
      "actor": {
        "fid": 6099,
        "username": "gsus",
        "displayName": "Gsus",
        "pfpUrl": "https://..."
      },
      "castHash": "0x...",
      "content": "Great post!",
      "timestamp": "2024-01-24T10:22:40.000Z",
      "read": false
    }
  ],
  "timestamp": "2024-01-24T10:22:40.000Z"
}
```

## Configuración

### Variables de Entorno

```bash
# .env.local o Netlify Environment Variables

# Forzar polling (recomendado para Netlify)
NEXT_PUBLIC_USE_SSE="false"

# Auto-detectar (default, intenta SSE primero)
# NEXT_PUBLIC_USE_SSE="true"
```

### Para Netlify (Recomendado)

Agregar en el dashboard de Netlify:

```
NEXT_PUBLIC_USE_SSE = false
```

Esto **fuerza polling desde el inicio** y evita los intentos fallidos de SSE.

## Hook: `useNotificationStream`

### Uso Básico

```typescript
import { useNotificationStream } from '@/hooks'

function MyComponent() {
  useNotificationStream({
    onNotification: (notification) => {
      console.log('Nueva notificación:', notification)
    },
    showToast: true, // Mostrar toast automático
  })

  return <div>...</div>
}
```

### Retorno

```typescript
const { reconnect, mode } = useNotificationStream(options)

// reconnect: función para forzar reconexión/re-poll
// mode: 'sse' | 'polling' (modo actual)
```

### Logs de Consola

El hook loguea su estado para debugging:

**SSE Mode**:
```
[Notifications] SSE connected
[Notifications] SSE fast failure detected {count: 1, duration: 234}
[Notifications] Too many fast failures, switching to polling
```

**Polling Mode**:
```
[Notifications] Using polling mode (interval: 30s)
[Notifications Polling] Request failed: 401
```

## Monitoreo

### Verificar Modo Actual

En la consola del navegador:

```javascript
// Buscar logs
// SSE: "[Notifications] SSE connected"
// Polling: "[Notifications] Using polling mode"
```

### Forzar Cambio de Modo

```javascript
// Forzar polling
localStorage.setItem('FORCE_POLLING', 'true')
location.reload()

// Forzar SSE
localStorage.removeItem('FORCE_POLLING')
location.reload()
```

## Performance

### SSE (Ideal)
- ✅ Latencia baja (< 1 segundo)
- ✅ No carga innecesaria al servidor
- ❌ No funciona en Netlify

### Polling (Netlify)
- ✅ Compatible con cualquier plataforma
- ✅ Confiable
- ⚠️ Latencia de hasta 30 segundos
- ⚠️ Requests cada 30s (carga moderada)

### Optimizaciones Aplicadas

1. **Polling incremental**: Solo fetch notificaciones desde último timestamp
2. **Límite de 20 notificaciones** por request
3. **Invalidación de React Query**: Cache se actualiza automáticamente
4. **Debounce implícito**: 30 segundos entre polls

## Migración Futura

Si migras a una plataforma con soporte SSE real:

1. **Vercel**: Cambiar `NEXT_PUBLIC_USE_SSE="true"` (ya funciona)
2. **Railway/Fly.io**: Cambiar `NEXT_PUBLIC_USE_SSE="true"`
3. **VPS tradicional**: Cambiar `NEXT_PUBLIC_USE_SSE="true"`

No requiere cambios de código, solo configuración.

## Troubleshooting

### Problema: "No recibo notificaciones"

**Solución**:
1. Verifica que la sesión esté activa (no 401)
2. Revisa logs de consola
3. Verifica variable `NEXT_PUBLIC_USE_SSE`

### Problema: "Too many requests 429"

**Solución**:
- El polling está configurado a 30s
- Verifica que no haya múltiples tabs abiertos
- Revisa rate limits en `/api/notifications`

### Problema: "SSE loop infinito"

**Solución**:
- Cambiar `NEXT_PUBLIC_USE_SSE="false"` para forzar polling
- Verificar que Netlify no esté cerrando la conexión

## Archivo de Implementación

- **Hook**: `src/hooks/useNotificationStream.ts`
- **Provider**: `src/components/providers/NotificationsProvider.tsx`
- **API SSE**: `src/app/api/notifications/stream/route.ts`
- **API Polling**: `src/app/api/notifications/route.ts`

---

**Actualizado**: 2024-01-24
**Autor**: Claude Code
