# Waterfall / Exit-Scenario Modeling Epic Plan

This plan outlines the tasks required to implement liquidation waterfall analysis in Flexile. It reflects the current repository structure and code patterns (Rails 8 backend and Next.js front end).

## Milestone Breakdown

### Milestone 1 – Data Layer
1. Add migrations for `liquidation_scenarios` and `liquidation_payouts` tables.
   - Columns follow the schema proposed in the feature discussion.
   - Include `ExternalId` behaviour like other models.
2. Add deal‑term columns to `share_classes` and `convertible_securities`.
3. Implement model validations and normalizers matching existing conventions.
4. Create minimal RSpec tests ensuring migrations and validations work.

### Milestone 2 – Calculation Service
1. Create `LiquidationScenarioCalculation` service in `app/services`.
2. Implement share‑class ranking logic and preference rules.
3. Handle convertible security conversions based on valuation caps and discounts.
4. Persist payouts to `liquidation_payouts` once calculated.
5. Unit tests cover simple multi‑class scenarios.

### Milestone 3 – API Layer
1. Extend Drizzle schema under `frontend/db/schema.ts` with the new tables.
2. Add tRPC router `liquidationScenarios` with `run` mutation and `show` query.
3. Expose the router from `frontend/trpc/server.ts`.
4. Unit tests verify auth and response shapes.

### Milestone 4 – Front End UI
1. Add “Waterfall” entry to navigation in `frontend/app/equity/index.ts`.
2. New page at `frontend/app/equity/waterfall/page.tsx` using `EquityLayout`.
3. Form to create a scenario and table to display payouts.
4. CSV download option using existing hooks.

### Milestone 5 – QA & Documentation
1. Playwright test covering scenario creation and CSV download.
2. Add documentation page `docs/waterfall.md` summarising how to run the feature.
3. Update decision log with outstanding questions.

## Done‑Means‑Done Checklist
- Migrations reversible and passing on CI.
- RSpec and Playwright suites remain green.
- API routes authenticated and return expected data.
- UI responsive and accessible on mobile.
- Documentation updated.
