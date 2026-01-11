# 🚀 Cómo Testear FASE 1 en Local

## 1️⃣ Preparar el Entorno

```bash
# En tu máquina local (NO en Claude Code)
cd /Users/gsus/Antigravity/Castor

# Cambiar a la rama con FASE 1
git checkout wonderful-heyrovsky

# Verificar que tienes los cambios
git log --oneline -3
# Deberías ver:
# afb3a3f docs: add before/after comparison visual guide
# 1e92e60 docs: add quick start guide for IA improvements
# 85155b8 feat: implement brand voice coherence validation system (FASE 1)
```

## 2️⃣ Instalar Dependencias

```bash
# Si usas npm
npm install

# Si usas pnpm (más rápido)
pnpm install

# Si usas yarn
yarn install
```

## 3️⃣ Configurar Variables de Entorno

```bash
# Copiar archivo .env.example
cp .env.example .env.local

# Editar .env.local y asegurar que tienes:
GEMINI_API_KEY=tu_api_key_aqui
NEXT_PUBLIC_API_URL=http://localhost:3000
# (las demás variables que ya tenías)
```

## 4️⃣ Lanzar Servidor de Desarrollo

```bash
# Opción 1: npm
npm run dev

# Opción 2: pnpm
pnpm dev

# Opción 3: yarn
yarn dev

# El servidor debería iniciar en:
# ➜  Local:   http://localhost:3000
```

## 5️⃣ Abrir en Browser

```
http://localhost:3000/studio
```

---

## 🧪 Qué Testear

### Test 1: Brand Mode Desactivado (Sin cambios visuales)
1. Abre `/studio`
2. Crea un cast
3. Abre AIReplyDialog (click reply con IA)
4. Debería verse normal (sin badges de validación)

### Test 2: Brand Mode Activado
1. Ve a `/accounts/[account-id]/ai`
2. Completa "Brand Voice" (si no está completo)
3. Click "Save"
4. Vuelve a `/studio`
5. Abre AIReplyDialog nuevamente

### Test 3: Badges de Validación ⭐
En AIReplyDialog con Brand Mode ON:
1. Deberías ver badges en cada sugerencia:
   ```
   ✨ Perfect fit      (92%)
   👌 Matches brand    (75%)
   ⚠️  Off-brand       (58%)
   ```
2. **Hover** sobre el badge → tooltip con detalles

### Test 4: Reply Strategy Selector ⭐
En AIReplyDialog con Brand Mode ON:
1. Debería verse una sección "Reply Strategy"
2. Opciones: 👍 Agree | 🤔 Disagree | 💡 Add Value | 😄 Humor | ❓ Question
3. Selecciona una estrategia
4. Cierra AIReplyDialog (sin Brand Mode) → selector desaparece

### Test 5: Suggestion Cards ⭐
En AIReplyDialog:
1. Cada sugerencia está en un "card" mejorado
2. Muestra: texto + badge + botón [Use]
3. Click [Use] → selecciona la sugerencia
4. Puedes copiar con botón copy (visible en hover)

### Test 6: API Endpoint (Postman/curl)
```bash
curl -X POST http://localhost:3000/api/ai/validate-brand \
  -H "Content-Type: application/json" \
  -d '{
    "suggestion": "This is an awesome post!",
    "accountId": "your-account-id"
  }'

# Response esperada:
{
  "validation": {
    "coherenceScore": 92,
    "category": "perfect",
    "violations": [],
    "strengths": ["Perfect tone match"],
    "feedback": "Perfect match for your brand voice!"
  }
}
```

---

## 🐛 Si Algo No Funciona

### Error: "brandValidator not found"
- Verificar que el archivo existe: `src/lib/ai/brand-validator.ts`
- Limpiar caché: `rm -rf .next`
- Reiniciar servidor

### Error: "Cannot find module 'BrandValidationBadge'"
- Verificar ruta: `src/components/ai/BrandValidationBadge.tsx`
- Verificar imports en `AIReplyDialog.tsx`

### Validación no funciona
- Verificar que `GEMINI_API_KEY` está en `.env.local`
- Ver logs: `[BrandValidator]` debería aparecer en console
- Verificar que Brand Mode está ON (completa Brand Voice)

### Endpoint retorna 403
- Verificar que estás autenticado
- Verificar que tienes acceso a la cuenta
- Ver logs de error en servidor

---

## 📊 Puntos Clave para Verificar

| Elemento | Ubicación | Debería Ver |
|----------|-----------|------------|
| Brand Validator | `/api/ai/validate-brand` | Score + feedback |
| Badge | AIReplyDialog | ✨👌⚠️❌ con % |
| Strategy Selector | AIReplyDialog | 5 emojis si Brand Mode ON |
| Suggestion Cards | AIReplyDialog | Cards con badge + botones |
| AI Persona Mejorado | `/accounts/[id]/ai` | Profile con 50 casts |

---

## 🎯 Flujo Completo de Test

```bash
# Terminal 1: Servidor
npm run dev

# Terminal 2: Browser
open http://localhost:3000/studio

# Steps:
1. Login si es necesario
2. Selecciona una cuenta
3. Completa Brand Voice en /accounts/[id]/ai
4. Vuelve a /studio
5. Click en un cast para responder
6. Verifica badges, estrategias, cards
7. Testa API con curl en terminal 3
```

---

## 📸 Screenshots a Tomar

Para documentar la implementación:
1. Brand Config Page (con visual profile card)
2. AIReplyDialog con badges
3. ReplyStrategySelector
4. API response en Postman

---

## 🚀 Próximos Pasos Después del Testing

Si todo funciona:
1. ✅ Merge a main (crear PR)
2. ✅ Deploy a staging
3. ✅ Deploy a producción
4. ✅ Continuar con OPCIÓN A/B/C

Si hay issues:
1. 🐛 Documentar en GitHub
2. 🐛 Fix en rama actual
3. 🔄 Re-test
4. ✅ Merge cuando todo esté listo

---

## 💡 Tips

- **Hot Reload:** Los cambios se recargan automáticamente
- **DevTools:** F12 → Console verá `[BrandValidator]` logs
- **Clear Cache:** Si ves comportamiento extraño, `rm -rf .next`
- **Documentos:** Lee `ANTES_VS_DESPUES.md` mientras testeas

---

¡Listo para testear! 🎉

