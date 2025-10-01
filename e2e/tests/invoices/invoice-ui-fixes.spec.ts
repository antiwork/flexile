import { test, expect } from '@playwright/test';
import { auth } from '../../helpers/auth';
import { Factories } from '../../factories';

test.describe('Invoice UI Fixes', () => {
  test.beforeEach(async ({ page }) => {
    await auth.login(page);
  });

  test.describe('New Invoice Activation Dialog', () => {
    test('shows activation dialog when tax details incomplete', async ({ page }) => {
      // Create a user without completed tax setup
      const user = await Factories.users.create({
        taxInformationConfirmedAt: null,
        address: { street_address: null }
      });

      await auth.loginAs(page, user);
      await page.goto('/invoices');

      // Try to click new invoice button
      await page.getByRole('button', { name: 'New invoice' }).click();

      // Should show activation dialog instead of navigating
      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(page.getByText('Complete setup to create invoices')).toBeVisible();
      await expect(page.getByText('Please provide your legal details')).toBeVisible();

      // Check for deep-link to tax setup
      const taxLink = page.getByRole('link', { name: 'Complete tax setup' });
      await expect(taxLink).toBeVisible();
      await expect(taxLink).toHaveAttribute('href', '/settings/tax');
    });

    test('shows activation dialog when payout method missing', async ({ page }) => {
      // Create a user without payout method
      const user = await Factories.users.create({
        taxInformationConfirmedAt: new Date(),
        hasPayoutMethodForInvoices: false,
        address: { street_address: '123 Main St' }
      });

      await auth.loginAs(page, user);
      await page.goto('/invoices');

      await page.getByRole('button', { name: 'New invoice' }).click();

      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(page.getByText('Please provide a payout method')).toBeVisible();

      const payoutLink = page.getByRole('link', { name: 'Set up payouts' });
      await expect(payoutLink).toBeVisible();
      await expect(payoutLink).toHaveAttribute('href', '/settings/payouts');
    });

    test('allows navigation when setup complete', async ({ page }) => {
      // Create a fully set up user
      const user = await Factories.users.create({
        taxInformationConfirmedAt: new Date(),
        hasPayoutMethodForInvoices: true,
        address: { street_address: '123 Main St' }
      });

      await auth.loginAs(page, user);
      await page.goto('/invoices');

      await page.getByRole('button', { name: 'New invoice' }).click();

      // Should navigate to new invoice page
      await expect(page).toHaveURL(/\/invoices\/new/);
      await expect(page.getByText('New invoice')).toBeVisible();
    });

    test('shows multiple requirements in dialog', async ({ page }) => {
      // Create user missing multiple requirements
      const user = await Factories.users.create({
        taxInformationConfirmedAt: null,
        hasPayoutMethodForInvoices: false,
        address: { street_address: null }
      });

      await auth.loginAs(page, user);
      await page.goto('/invoices');

      await page.getByRole('button', { name: 'New invoice' }).click();

      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(page.getByText('legal details')).toBeVisible();
      await expect(page.getByText('payout method')).toBeVisible();
    });
  });

  test.describe('Add More Info Toggle', () => {
    test('expands and collapses inline form', async ({ page }) => {
      const user = await Factories.users.create({
        taxInformationConfirmedAt: new Date(),
        hasPayoutMethodForInvoices: true,
        address: { street_address: '123 Main St' }
      });

      await auth.loginAs(page, user);
      await page.goto('/invoices');

      const toggleButton = page.getByRole('button', { name: 'Add more info' });

      // Initially collapsed
      await expect(toggleButton).toBeVisible();
      await expect(toggleButton).toHaveAttribute('aria-expanded', 'false');
      await expect(page.getByLabel('Description')).not.toBeVisible();

      // Click to expand
      await toggleButton.click();

      await expect(toggleButton).toHaveAttribute('aria-expanded', 'true');
      await expect(toggleButton).toHaveText('Show less');
      await expect(page.getByLabel('Description')).toBeVisible();
      await expect(page.getByLabel('Invoice Number')).toBeVisible();
      await expect(page.getByLabel('Notes')).toBeVisible();

      // Click to collapse
      await toggleButton.click();

      await expect(toggleButton).toHaveAttribute('aria-expanded', 'false');
      await expect(toggleButton).toHaveText('Add more info');
      await expect(page.getByLabel('Description')).not.toBeVisible();
    });

    test('supports keyboard navigation', async ({ page }) => {
      const user = await Factories.users.create({
        taxInformationConfirmedAt: new Date(),
        hasPayoutMethodForInvoices: true,
        address: { street_address: '123 Main St' }
      });

      await auth.loginAs(page, user);
      await page.goto('/invoices');

      const toggleButton = page.getByRole('button', { name: 'Add more info' });

      // Focus and press Enter
      await toggleButton.focus();
      await page.keyboard.press('Enter');

      await expect(toggleButton).toHaveAttribute('aria-expanded', 'true');
      await expect(page.getByLabel('Description')).toBeVisible();

      // Press Space to collapse
      await page.keyboard.press(' ');

      await expect(toggleButton).toHaveAttribute('aria-expanded', 'false');
      await expect(page.getByLabel('Description')).not.toBeVisible();
    });

    test('preserves form state when toggling', async ({ page }) => {
      const user = await Factories.users.create({
        taxInformationConfirmedAt: new Date(),
        hasPayoutMethodForInvoices: true,
        address: { street_address: '123 Main St' }
      });

      await auth.loginAs(page, user);
      await page.goto('/invoices');

      // Fill in basic form
      await page.getByLabel('Rate').fill('50');
      await page.getByLabel('Hours / Qty').fill('40');

      // Expand and fill additional fields
      await page.getByRole('button', { name: 'Add more info' }).click();
      await page.getByLabel('Description').fill('Consulting work');
      await page.getByLabel('Invoice Number').fill('INV-2024-001');
      await page.getByLabel('Notes').fill('Additional project notes');

      // Collapse and expand again
      await page.getByRole('button', { name: 'Show less' }).click();
      await page.getByRole('button', { name: 'Add more info' }).click();

      // Verify form state preserved
      await expect(page.getByLabel('Rate')).toHaveValue('50');
      await expect(page.getByLabel('Description')).toHaveValue('Consulting work');
      await expect(page.getByLabel('Invoice Number')).toHaveValue('INV-2024-001');
      await expect(page.getByLabel('Notes')).toHaveValue('Additional project notes');
    });

    test('collapses after successful submission', async ({ page }) => {
      const user = await Factories.users.create({
        taxInformationConfirmedAt: new Date(),
        hasPayoutMethodForInvoices: true,
        address: { street_address: '123 Main St' }
      });

      await auth.loginAs(page, user);
      await page.goto('/invoices');

      // Expand form and fill
      await page.getByRole('button', { name: 'Add more info' }).click();
      await page.getByLabel('Description').fill('Test work');

      // Submit form
      await page.getByRole('button', { name: 'Send for approval' }).click();

      // Should collapse after submission
      await expect(page.getByRole('button', { name: 'Add more info' })).toBeVisible();
      await expect(page.getByLabel('Description')).not.toBeVisible();
    });
  });

  test.describe('Edit Invoice Locked Status', () => {
    test('shows edit button for editable invoice', async ({ page }) => {
      const user = await Factories.users.create();
      const invoice = await Factories.invoices.create({
        userId: user.id,
        status: 'received' // editable status
      });

      await auth.loginAs(page, user);
      await page.goto(`/invoices/${invoice.id}`);

      const editButton = page.getByRole('button', { name: 'Edit invoice' }).first();
      await expect(editButton).toBeVisible();
      await expect(editButton).not.toHaveClass(/opacity-50/);

      await editButton.click();
      await expect(page).toHaveURL(`/invoices/${invoice.id}/edit`);
    });

    test('shows tooltip and duplicate for locked invoice', async ({ page }) => {
      const user = await Factories.users.create();
      const invoice = await Factories.invoices.create({
        userId: user.id,
        status: 'paid' // non-editable status
      });

      await auth.loginAs(page, user);
      await page.goto(`/invoices/${invoice.id}`);

      // Should show disabled edit button with tooltip
      const editButton = page.getByRole('button', { name: 'Edit invoice' }).first();
      await expect(editButton).toBeVisible();
      await expect(editButton).toHaveClass(/opacity-50/);

      // Hover to show tooltip
      await editButton.hover();
      await expect(page.getByText('This invoice cannot be edited because it\\'s paid')).toBeVisible();

      // Should show duplicate button
      const duplicateButton = page.getByRole('button', { name: 'Duplicate' });
      await expect(duplicateButton).toBeVisible();

      await duplicateButton.click();

      // Should navigate to new invoice with pre-filled data
      await expect(page).toHaveURL(/\/invoices\/new/);
      await expect(page.getByText('New invoice')).toBeVisible();
    });

    test('handles mobile dropdown for locked invoice', async ({ page }) => {
      page.setViewportSize({ width: 375, height: 667 }); // mobile size

      const user = await Factories.users.create();
      const invoice = await Factories.invoices.create({
        userId: user.id,
        status: 'processing' // non-editable status
      });

      await auth.loginAs(page, user);
      await page.goto(`/invoices/${invoice.id}`);

      // Open mobile dropdown
      await page.getByRole('button', { name: 'More options' }).click();

      // Should show locked edit option and duplicate option
      await expect(page.getByText('Edit invoice (locked)')).toBeVisible();
      await expect(page.getByText('Duplicate invoice')).toBeVisible();

      // Click duplicate
      await page.getByText('Duplicate invoice').click();
      await expect(page).toHaveURL(/\/invoices\/new/);
    });

    test('pre-fills duplicate form with original invoice data', async ({ page }) => {
      const user = await Factories.users.create();
      const invoice = await Factories.invoices.create({
        userId: user.id,
        status: 'paid',
        lineItems: [{
          description: 'Original work description',
          quantity: '80',
          hourly: true,
          payRateInSubunits: 5000 // $50
        }]
      });

      await auth.loginAs(page, user);
      await page.goto(`/invoices/${invoice.id}`);

      await page.getByRole('button', { name: 'Duplicate' }).click();

      // Check that form is pre-filled with original data
      await expect(page.getByLabel('Rate')).toHaveValue('50');
      await expect(page.getByLabel('Description')).toHaveValue('Original work description');
    });
  });

  test.describe('Telemetry Events', () => {
    test('tracks new invoice click events', async ({ page }) => {
      // Mock console.log to capture telemetry
      const telemetryEvents: string[] = [];
      page.on('console', (msg) => {
        if (msg.text().includes('[Telemetry]')) {
          telemetryEvents.push(msg.text());
        }
      });

      const user = await Factories.users.create({
        taxInformationConfirmedAt: new Date(),
        hasPayoutMethodForInvoices: true,
        address: { street_address: '123 Main St' }
      });

      await auth.loginAs(page, user);
      await page.goto('/invoices');

      await page.getByRole('button', { name: 'New invoice' }).click();

      // Should track the click event
      expect(telemetryEvents.some(event =>
        event.includes('ui_click_new_invoice')
      )).toBeTruthy();
    });

    test('tracks blocked invoice events', async ({ page }) => {
      const telemetryEvents: string[] = [];
      page.on('console', (msg) => {
        if (msg.text().includes('[Telemetry]')) {
          telemetryEvents.push(msg.text());
        }
      });

      const user = await Factories.users.create({
        taxInformationConfirmedAt: null,
        address: { street_address: null }
      });

      await auth.loginAs(page, user);
      await page.goto('/invoices');

      await page.getByRole('button', { name: 'New invoice' }).click();

      // Should track the blocked event
      expect(telemetryEvents.some(event =>
        event.includes('ui_blocked_new_invoice_tax')
      )).toBeTruthy();
    });

    test('tracks toggle expand/collapse events', async ({ page }) => {
      const telemetryEvents: string[] = [];
      page.on('console', (msg) => {
        if (msg.text().includes('[Telemetry]')) {
          telemetryEvents.push(msg.text());
        }
      });

      const user = await Factories.users.create({
        taxInformationConfirmedAt: new Date(),
        hasPayoutMethodForInvoices: true,
        address: { street_address: '123 Main St' }
      });

      await auth.loginAs(page, user);
      await page.goto('/invoices');

      // Expand
      await page.getByRole('button', { name: 'Add more info' }).click();
      expect(telemetryEvents.some(event =>
        event.includes('ui_expand_more_info')
      )).toBeTruthy();

      // Collapse
      await page.getByRole('button', { name: 'Show less' }).click();
      expect(telemetryEvents.some(event =>
        event.includes('ui_collapse_more_info')
      )).toBeTruthy();
    });
  });
});


