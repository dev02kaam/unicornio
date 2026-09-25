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
    if (role === 'STUDENT') test.setTimeout(75_000);
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto('/login.html');
    await expect(page.locator('main')).toBeVisible();
    await expect(page.locator('[role="alert"]')).toHaveAttribute('aria-live', 'assertive');

    await page.getByLabel(/correo|email/i).fill(email);
    await page.getByLabel(/contrase/i).fill('Demo1234!');
    await page.getByRole('button', { name: /entrar/i }).click();
    await page.waitForURL(/dashboard\.html/);

    if (role === 'STUDENT') {
      const instructions = page.getByRole('dialog', { name: 'Instrucciones de bienvenida' });
      await expect(instructions).toBeVisible();
      await expect(page.locator('main')).toHaveAttribute('inert', '');
      // The welcome sequence deliberately blocks the dashboard while both
      // characters speak. Browsers may require a gesture to start the audio.
      await expect(async () => {
        const start = instructions.getByRole('button', { name: 'Escuchar instrucciones' });
        if (await start.isVisible()) await start.click();
        await expect(instructions).toBeHidden({ timeout: 1_000 });
      }).toPass({ timeout: 50_000, intervals: [500] });
      await expect(page.locator('main')).not.toHaveAttribute('inert');
    }

    await expect(page.locator('main')).toBeVisible();
    await expect(page.locator('h1')).toBeVisible();
    await page.keyboard.press('Tab');
    await expect(page.locator(':focus')).toBeVisible();
    await context.close();
  });
}
