# Caster - Farcaster Scheduler

Herramienta interna para programar y gestionar casts en múltiples cuentas de Farcaster.

## Stack

- **Framework**: Next.js 15 con App Router
- **Database**: SQLite (Turso para producción)
- **ORM**: Drizzle
- **UI**: Tailwind CSS + Lucide Icons
- **API**: Neynar SDK v2

## Requisitos

- Node.js 20+
- pnpm (recomendado) o npm

## Setup

```bash
# Instalar dependencias
pnpm install

# Copiar variables de entorno
cp .env.example .env

# Editar .env con tus credenciales
# - NEYNAR_API_KEY: Obtener en https://neynar.com

# Crear base de datos local
pnpm db:push

# Iniciar desarrollo
pnpm dev
```

## Estructura

```
src/
├── app/                    # Next.js App Router
│   ├── (dashboard)/        # Rutas del dashboard
│   └── page.tsx            # Landing page
├── components/             # Componentes React
├── lib/
│   ├── db/                 # Drizzle schema y cliente
│   └── farcaster/          # Cliente Neynar
```

## Comandos

```bash
pnpm dev          # Desarrollo con Turbopack
pnpm build        # Build de producción
pnpm db:studio    # Abrir Drizzle Studio
pnpm db:push      # Sincronizar schema con DB
```

## Cuentas

La app soporta múltiples cuentas:
- **Personales**: Perfiles individuales
- **Empresas**: Cuentas de marca/empresa

Cada cuenta requiere un signer de Neynar para publicar.
