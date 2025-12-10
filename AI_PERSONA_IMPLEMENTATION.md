# Especificación Técnica: Gemelo Digital (AI Persona)

Este documento detalla el plan de implementación para permitir que la IA de Castor "aprenda" y mimetice el estilo de escritura de cada usuario basándose en su historial de Farcaster.

## 1. Arquitectura de Datos

### Base de Datos (Drizzle ORM)
Necesitamos almacenar el "ADN" del estilo del usuario. Como un usuario puede gestionar varias cuentas (personal, empresa, etc.), este dato pertenece a la tabla `accounts`.

**Archivo:** `src/lib/db/schema.ts`

```typescript
export const accounts = sqliteTable('accounts', {
  // ... campos existentes
  
  // Nuevo campo para guardar el prompt de personalidad
  aiPersona: text('ai_persona'), 
  
  // Opcional: Fecha del último análisis para permitir re-entrenar
  lastAnalyzedAt: integer('last_analyzed_at', { mode: 'timestamp' }),
})
```

## 2. Flujo de Análisis (Entrenamiento)

Este proceso se ejecuta bajo demanda (botón "Analizar mi estilo" en Ajustes/Perfil).

**Endpoint:** `POST /api/ai/analyze-style`

### Pasos:
1.  **Fetch Historial (Neynar API):**
    *   Obtener los **Top 50 casts** históricos (ordenados por likes/recasts) para capturar los "Greatest Hits" de personalidad.
    *   Obtener los **Últimos 50 casts** para capturar el contexto y temas actuales.
    *   *Total:* ~100 textos representativos.

2.  **Generación del Perfil (Gemini 1.5 Pro/Flash):**
    *   Enviamos los 100 textos a Gemini con un prompt de análisis lingüístico.
    *   **Input:** Lista de casts.
    *   **Output:** Un "System Prompt" detallado describiendo al usuario.

### Prompt de Análisis (Sugerido):
```text
Eres un experto lingüista y psicólogo analizando patrones de comunicación en redes sociales.
Aquí tienes 100 publicaciones de un usuario de Farcaster:
[LISTA_DE_CASTS]

Tu tarea es crear un "System Persona Prompt" para una IA que debe imitar a este usuario.
Analiza y extrae explícitamente:
1. Longitud promedio de frases.
2. Uso de emojis (frecuencia, tipos específicos, posición).
3. Uso de mayúsculas/minúsculas (¿todo minúsculas? ¿capitalización correcta?).
4. Jerga, muletillas o vocabulario específico (crypto-slang, dev-speak, etc.).
5. Tono general (optimista, cínico, shitposter, educativo, formal).
6. Formato (hilos, one-liners, listas).

Salida requerida: ÚNICAMENTE el prompt de instrucción en segunda persona.
Ejemplo de salida: "Eres un usuario que escribe en minúsculas, usa mucho el emoji 🫡, tiende a ser sarcástico y usa términos técnicos de Ethereum..."
```

3.  **Guardado:**
    *   Actualizar `accounts.aiPersona` con la salida de Gemini.

## 3. Flujo de Generación (Inferencia)

Actualizar el endpoint existente para usar el perfil guardado.

**Endpoint:** `POST /api/ai/reply`

### Lógica Actualizada:
1.  Recibir `tone`, `language`, `context` y `accountId`.
2.  Consultar DB para obtener `accounts.aiPersona` del usuario actual.
3.  Construir el prompt final para Gemini.

### Prompt de Generación (Sugerido):
```text
[SYSTEM INSTRUCTION]
{aiPersona}

[TASK]
Genera una respuesta para el siguiente cast de Farcaster.
Cast Original: "{originalCast}"
Autor: @{authorUsername}

[CONSTRAINTS]
- Idioma: {language}
- Modificador de Tono actual: {tone} (Este modificador matiza tu personalidad base, no la reemplaza).
- Mantén tu estilo de escritura definido en las instrucciones del sistema.
```

## 4. Implementación UI

### Panel de Configuración de IA (`/dashboard/settings` o `/dashboard/profile`)
*   Sección: "Personalidad AI / Gemelo Digital".
*   Estado: Mostrar si ya existe un perfil analizado ("Último análisis: Hace 2 días").
*   Acción: Botón "Analizar mi estilo (Neynar)".
    *   *Feedback:* Loader "Leyendo tus mejores casts...", "Analizando patrones...", "Guardando perfil".

### CastCard (Composer)
*   El usuario no necesita hacer nada extra. Si tiene una `aiPersona` configurada, el backend la usará automáticamente.
*   Quizás añadir un pequeño indicador en el Popover de AI: "✨ Usando tu estilo personalizado".

## 5. Roadmap de Desarrollo

1.  [ ] **DB Migration:** Añadir columna `ai_persona`.
2.  [ ] **Backend Analysis:** Crear endpoint de análisis con conexión a Neynar (requiere API Key de Neynar con acceso a historial).
3.  [ ] **Backend Reply:** Conectar `ai_persona` al prompt de generación.
4.  [ ] **Frontend:** Crear UI de configuración y botón de análisis.
