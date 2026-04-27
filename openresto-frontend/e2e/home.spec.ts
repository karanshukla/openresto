import { test, expect } from '@playwright/test';

test.describe('Home Page', () => {
  test('should load the home page and show restaurants', async ({ page }) => {
    await page.goto('/');
    
    // Check if the app name is visible in the hero section
    await expect(page.locator('text=Open Resto')).toBeVisible();

    // Check if Navbar is visible
    await expect(page.getByRole('link', { name: 'Home' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'My Bookings' })).toBeVisible();

    // Check if we have restaurant cards
    const restaurantCards = page.getByRole('link').filter({ has: page.locator('text=/./') }).filter({ hasNotText: 'Home' }).filter({ hasNotText: 'My Bookings' }).filter({ hasNotText: 'Admin' });
    
    // Wait for the API to load and cards to appear
    await expect(restaurantCards.first()).toBeVisible({ timeout: 15000 });
    
    const count = await restaurantCards.count();
    console.log(`Found ${count} restaurant cards`);
    expect(count).toBeGreaterThan(0);
  });

  test('should navigate to booking page when clicking a restaurant', async ({ page }) => {
    await page.goto('/');
    
    const restaurantCards = page.getByRole('link').filter({ has: page.locator('text=/./') }).filter({ hasNotText: 'Home' }).filter({ hasNotText: 'My Bookings' }).filter({ hasNotText: 'Admin' });
    
    await expect(restaurantCards.first()).toBeVisible({ timeout: 15000 });
    
    // Click the card
    await restaurantCards.first().click({ force: true });
    
    // Wait for URL change
    await page.waitForURL(/.*book\?restaurantId=.*/, { timeout: 10000 });
    
    // Check if the booking form is present
    await expect(page.locator('text=Book a Table')).toBeVisible();
  });
});
