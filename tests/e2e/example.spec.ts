/**
 * Example Playwright E2E test template.
 * 
 * Copy this file as a starting point for new browser tests.
 * Place tests in tests/e2e/ directory.
 * 
 * Run: npx playwright test tests/e2e/example.spec.ts
 */

import { test, expect } from '@playwright/test';

test.describe('Example Feature', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the page before each test
    await page.goto('/');
  });

  test('should load the page', async ({ page }) => {
    // Verify page loads without errors
    await expect(page).toHaveTitle(/.*/);
  });

  test('should demonstrate common patterns', async ({ page }) => {
    // Click an element
    await page.click('#some-button');
    
    // Wait for navigation or content
    await expect(page.locator('#result')).toBeVisible();
    
    // Verify text content
    await expect(page.locator('#result')).toHaveText('Expected content');
    
    // Verify element has specific attribute
    await expect(page.locator('#some-input')).toHaveAttribute('placeholder', 'Enter value');
    
    // Verify element is enabled/disabled
    await expect(page.locator('#submit-btn')).toBeEnabled();
    
    // Verify URL
    await expect(page).toHaveURL(/\/result/);
  });

  test('should handle form submission', async ({ page }) => {
    await page.fill('#name-input', 'Test User');
    await page.fill('#email-input', 'test@example.com');
    await page.click('#submit-btn');
    
    // Wait for success message
    await expect(page.locator('.success-message')).toBeVisible({ timeout: 5000 });
  });

  test('should handle errors gracefully', async ({ page }) => {
    // Trigger an error condition
    await page.click('#error-trigger');
    
    // Verify error is displayed
    await expect(page.locator('.error-message')).toBeVisible();
    await expect(page.locator('.error-message')).toContainText('Something went wrong');
  });
});
