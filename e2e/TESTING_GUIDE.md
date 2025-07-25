# Testing Guide - Making Tests Easier While Staying Compliant

## Test Commands

### Playwright E2E Tests

```bash
# Run all Playwright tests
pnpm playwright test

# Run specific test file
pnpm playwright test e2e/tests/company/dashboard.spec.ts

# Run tests in headed mode (see browser)
pnpm playwright test --headed

# Run tests with debug mode
pnpm playwright test --debug

# Run tests and generate HTML report
pnpm playwright test --reporter=html

# Run tests in watch mode (rerun on file changes)
pnpm playwright test --watch
```

### Rails Tests

```bash
# Run all Rails specs
bundle exec rspec

# Run specific spec file
bundle exec rspec spec/system/roles/show_spec.rb:7

# Run with specific formatter
bundle exec rspec --format RSpec::Github::Formatter
```

## Making Tests Easier

### 1. Use Existing Helpers

#### Authentication Helper

Instead of manual login:

```typescript
// ❌ Manual login (verbose)
const { email } = await setClerkUser(contractorUser.id);
await page.goto("/login");
await page.getByLabel("Email").fill(email);
await page.getByRole("button", { name: "Continue", exact: true }).click();
await page.getByLabel("Password", { exact: true }).fill("password");
await page.getByRole("button", { name: "Continue", exact: true }).click();
await page.waitForURL(/^(?!.*\/login$).*/u);

// ✅ Use login helper (simple)
await login(page, contractorUser);
```

#### Setup Helpers

```typescript
// ❌ Manual setup (verbose)
const { company } = await companiesFactory.createCompletedOnboarding();
const { user: contractorUser } = await usersFactory.create();
const { companyContractor } = await companyContractorsFactory.create({
  companyId: company.id,
  userId: contractorUser.id,
  payRateInSubunits: 5000,
});
await companyStripeAccountsFactory.create({
  companyId: company.id,
  status: "ready",
  bankAccountLastFour: "4321",
});
await login(page, contractorUser);

// ✅ Use setup helper (simple)
const { company, contractorUser, companyContractor } = await setupContractorWithCompany(page, {
  payRateInSubunits: 5000,
});
```

### 2. Use Assertion Helpers

#### Dashboard Assertions

```typescript
// ❌ Manual assertions (verbose)
await expect(page.getByRole("heading", { name: "Earnings" })).toBeVisible();
await expect(page.getByRole("heading", { name: "Equity" })).toBeVisible();
await expect(page.getByRole("heading", { name: "Activity" })).toBeVisible();
await expect(page.getByText("$500.00")).toBeVisible();
await expect(page.getByText("25%")).toBeVisible();
await expect(page.getByText("$2,500.00")).toBeVisible();

// ✅ Use assertion helpers (simple)
await assertDashboardCardsVisible(page);
await assertEarningsData(page, "$500.00");
await assertEquityData(page, "25%", "$2,500.00");
```

### 3. Navigation Helpers

```typescript
// ❌ Manual navigation (verbose)
await page.goto("/dashboard");
await page.waitForLoadState("domcontentloaded");

// ✅ Use navigation helper (simple)
await navigateToDashboard(page);
```

## Best Practices for Easier Testing

### 1. Create Focused Test Files

- Group related tests in the same file
- Use descriptive test names
- Keep tests independent

### 2. Use Factory Patterns

```typescript
// Create realistic test data
await invoicesFactory.create({
  companyContractorId: companyContractor.id,
  totalAmountInUsdCents: 50000n, // $500
  status: "paid",
  invoiceDate: format(new Date("2024-01-15"), "yyyy-MM-dd"),
});
```

### 3. Test Different Scenarios

- Happy path (expected behavior)
- Edge cases (new users, zero data)
- Error handling (API failures)

### 4. Use Descriptive Assertions

```typescript
// Test both presence and absence
await assertDashboardWelcomeVisible(page);
await assertOnboardingComplete(page); // Ensures "Getting started" is NOT visible
```

## Compliance Requirements

### 1. Test Coverage

- Happy path scenarios
- Edge cases and error handling
- Any regressions that might be introduced

### 2. Test Organization

- Use Playwright tests in `e2e/**/*.spec.ts`
- Follow existing test patterns in similar files
- Use factories for test data

### 3. Test Quality

- Write descriptive test names
- Keep tests independent and isolated
- Use accessibility-aware selectors (`getByRole`, `getByLabel`)

### 4. Running Tests

- Run tests with `pnpm playwright test <path_to_spec>` to verify
- Include screenshots of passing tests in PRs
- Ensure all tests pass before submitting

## Example: Simplified Dashboard Test

See `e2e/tests/company/dashboard-simple.spec.ts` for a simplified example using all the helpers.

## Available Helpers

### Setup Helpers (`e2e/helpers/setup.ts`)

- `setupContractorWithCompany(page, options)` - Creates contractor with company and logs in
- `setupAdminWithCompany(page)` - Creates admin with company and logs in
- `navigateToDashboard(page)` - Navigates to dashboard with proper waiting

### Assertion Helpers (`e2e/helpers/assertions.ts`)

- `assertDashboardCardsVisible(page)` - Checks all dashboard cards are visible
- `assertDashboardWelcomeVisible(page)` - Checks welcome message is visible
- `assertOnboardingComplete(page)` - Ensures onboarding checklist is not visible
- `assertDashboardQuickActions(page)` - Checks quick action buttons are visible
- `assertEarningsData(page, amount)` - Checks earnings amount is visible
- `assertEquityData(page, percentage, amount)` - Checks equity data is visible

### Authentication Helpers (`e2e/helpers/auth.ts`)

- `login(page, user)` - Logs in a user with proper authentication flow
- `setClerkUser(id)` - Sets up Clerk user for testing
- `clearClerkUser()` - Cleans up Clerk user after tests

### Utility Helpers (`e2e/helpers/index.ts`)

- `selectComboboxOption(page, name, option)` - Selects option from combobox
- `fillDatePicker(page, name, value)` - Fills date picker with value

## Tips for Faster Development

1. **Use `--headed` flag** to see the browser while developing tests
2. **Use `--debug` flag** to pause execution and inspect the page
3. **Use `--watch` flag** to automatically rerun tests on file changes
4. **Use Playwright Inspector** for recording tests and picking locators
5. **Create focused test files** to run only relevant tests during development
