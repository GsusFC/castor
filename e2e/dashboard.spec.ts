import { test, expect } from '@playwright/test'

// Helper para autenticación (mock session para testing)
test.describe('Dashboard (authenticated)', () => {
  // Nota: Para tests completos, necesitas configurar autenticación.
  // Opciones:
  // 1. Usar storageState con cookies de sesión guardadas
  // 2. Mock de la sesión en el servidor
  // 3. Usuario de test con credenciales fijas

  test.skip('should display dashboard with scheduled casts', async ({ page }) => {
    await page.goto('/dashboard')
    
    // Verificar elementos del dashboard
    await expect(page.getByText(/scheduled|programado/i)).toBeVisible()
    
    // Verificar que la lista de casts existe
    const castList = page.locator('[data-testid="cast-list"]')
    await expect(castList).toBeVisible()
  })

  test.skip('should open compose modal on new cast button', async ({ page }) => {
    await page.goto('/dashboard')
    
    // Click en botón de nuevo cast
    await page.click('[data-testid="new-cast-button"]')
    
    // Verificar que el modal está abierto
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByPlaceholder(/what.*mind|qué.*piensas/i)).toBeVisible()
  })

  test.skip('should filter casts by account', async ({ page }) => {
    await page.goto('/dashboard')
    
    // Seleccionar una cuenta específica
    await page.click('[data-testid="account-selector"]')
    await page.click('[data-testid="account-option"]:first-child')
    
    // Verificar que la lista se ha filtrado
    // Los casts mostrados deberían ser solo de esa cuenta
  })
})

test.describe('Dashboard Mobile', () => {
  test.use({ viewport: { width: 375, height: 667 } })

  test.skip('should show mobile navigation', async ({ page }) => {
    await page.goto('/dashboard')
    
    // Verificar navegación móvil
    const mobileNav = page.locator('nav').filter({ has: page.getByRole('link', { name: /home/i }) })
    await expect(mobileNav).toBeVisible()
  })

  test.skip('should open drafts sheet from mobile nav', async ({ page }) => {
    await page.goto('/dashboard')
    
    // Click en Drafts
    await page.click('button:has-text("Drafts")')
    
    // Verificar que el sheet está abierto
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByText(/borrador|draft/i)).toBeVisible()
  })
})
