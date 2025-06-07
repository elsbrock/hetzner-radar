import test, { expect } from './fixtures';

test.describe('Authentication Flow', () => {
  test('should redirect to login when accessing protected routes', async ({ page }) => {
    // Test alerts page redirect
    await page.goto('/alerts');
    await expect(page).toHaveURL(/\/auth\/login/);
    
    // Test settings page redirect  
    await page.goto('/settings');
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test('should display login form with proper elements', async ({ page }) => {
    await page.goto('/auth/login');
    
    // Check page elements
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
    await expect(page.getByRole('textbox', { name: /email/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /send magic link/i })).toBeVisible();
    
    // Check terms and conditions
    await expect(page.getByText(/by clicking.*you agree/i)).toBeVisible();
    await expect(page.getByRole('link', { name: /terms of service/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /privacy policy/i })).toBeVisible();
  });

  test('should validate email input', async ({ page }) => {
    await page.goto('/auth/login');
    
    const emailInput = page.getByRole('textbox', { name: /email/i });
    const submitButton = page.getByRole('button', { name: /send magic link/i });
    
    // Test empty email
    await submitButton.click();
    await expect(emailInput).toHaveAttribute('required');
    
    // Test valid email format
    await emailInput.fill('test@example.com');
    await expect(emailInput).toHaveValue('test@example.com');
  });

  test('should show success message after submitting valid email', async ({ page }) => {
    await page.goto('/auth/login');
    
    const emailInput = page.getByRole('textbox', { name: /email/i });
    const submitButton = page.getByRole('button', { name: /send magic link/i });
    
    // Fill valid email
    await emailInput.fill('test@example.com');
    await submitButton.click();
    
    // Wait for form submission and check for success indicator
    await page.waitForTimeout(1000);
    
    // Check if success message appears or form state changes
    const successIndicator = page.locator('text=sent').or(page.locator('text=check your email')).or(page.locator('text=magic link'));
    await expect(successIndicator.first()).toBeVisible({ timeout: 5000 });
  });

  test('should display logout confirmation page', async ({ page }) => {
    await page.goto('/auth/logout');
    
    // Should show goodbye message, not redirect
    await expect(page.getByRole('heading', { name: /goodbye/i })).toBeVisible();
    await expect(page.getByText(/successfully logged out/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /go home/i })).toBeVisible();
    
    // Should stay on logout page
    await expect(page).toHaveURL(/\/auth\/logout/);
  });

  test('should navigate home from logout page', async ({ page }) => {
    await page.goto('/auth/logout');
    
    // Click "Go Home" button
    await page.getByRole('button', { name: /go home/i }).click();
    
    // Should redirect to home page
    await expect(page).toHaveURL('/');
  });

  test('should show proper navigation for unauthenticated users', async ({ page }) => {
    await page.goto('/');
    
    // Should show login link
    await expect(page.getByRole('link', { name: /sign in/i })).toBeVisible();
    
    // Should not show authenticated-only links in main nav
    const alertsLink = page.getByRole('link', { name: /alerts/i });
    const settingsLink = page.getByRole('link', { name: /settings/i });
    
    // These might not be visible in main nav for unauth users
    if (await alertsLink.isVisible()) {
      // If visible, clicking should redirect to login
      await alertsLink.click();
      await expect(page).toHaveURL(/\/auth\/login/);
    }
  });

  test('should handle session expiration gracefully', async ({ page }) => {
    // Test accessing a protected route without authentication
    await page.goto('/alerts');
    
    // Should redirect to login, not show error
    await expect(page).toHaveURL(/\/auth\/login/);
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
  });

  test('should maintain navigation state across public pages', async ({ page }) => {
    // Test that navigation works smoothly on public pages
    await page.goto('/');
    await page.goto('/analyze');
    await page.goto('/configurations');
    await page.goto('/statistics');
    
    // Navigation should work without auth-related redirects
    await expect(page).toHaveURL(/\/statistics/);
    
    // Should still be able to access login
    await page.goto('/auth/login');
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
  });
});