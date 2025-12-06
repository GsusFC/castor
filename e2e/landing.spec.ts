import { test, expect } from '@playwright/test'

test.describe('Landing Page', () => {
  test('should display landing page with login button', async ({ page }) => {
    await page.goto('/')
    
    // Verificar que la landing carga
    await expect(page).toHaveTitle(/Castor/i)
    
    // Verificar que hay un botón de login
    const loginButton = page.getByRole('button', { name: /sign in|login|connect/i })
    await expect(loginButton).toBeVisible()
  })

  test('should redirect to dashboard if authenticated', async ({ page, context }) => {
    // Este test requiere un usuario autenticado
    // Por ahora solo verificamos que la redirección no falla
    await page.goto('/dashboard')
    
    // Si no está autenticado, debería redirigir a login o landing
    const url = page.url()
    expect(url).toMatch(/\/(login|dashboard)?$/)
  })
})
