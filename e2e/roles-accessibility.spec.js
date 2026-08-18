const { test, expect } = require('@playwright/test');

const roleAccounts = [
  ['ADMIN', 'admin@unicornio.local'],
  ['SCHOOL', 'school@unicornio.local'],
  ['TEACHER', 'profesor@unicornio.local'],
  ['PROFESSIONAL', 'profesional@unicornio.local'],
  ['STUDENT', 'alumno@unicornio.local'],
  ['FAMILY', 'familia@unicornio.local'],
];

for (const [role, email] of roleAccounts) {
  test(`${role} conserva acceso por teclado, foco y regiones principales`, async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto('/login.html');
    await expect(page.locator('main')).toBeVisible();
    await expect(page.locator('[role="alert"]')).toHaveAttribute('aria-live', 'assertive');

    await page.getByLabel(/correo|email/i).fill(email);
    await page.getByLabel(/contrase/i).fill('Demo1234!');
    await page.getByRole('button', { name: /entrar/i }).click();
    await page.waitForURL(/dashboard\.html/);

    await expect(page.locator('main')).toBeVisible();
    await expect(page.locator('h1')).toBeVisible();
    await page.keyboard.press('Tab');
    await expect(page.locator(':focus')).toBeVisible();
    await context.close();
  });
}
