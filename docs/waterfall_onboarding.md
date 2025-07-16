## Onboarding Pack – **Waterfall / Exit-Scenario Modeling Epic**

### 1. What You’re Building
When a startup is sold or goes public, money flows to shareholders in a strict order called a **liquidation waterfall**. Your mission is to give Flexile users a screen where they can enter a hypothetical sale price and instantly see **who gets how much** based on the existing cap-table data. This requires storing scenario inputs, crunching the waterfall math, and showing the payouts.

### 2. Domain Nutshell
| Concept | Super-simple definition | Data we must store |
|---------|------------------------|--------------------|
| **Share class** | Bucket of identical shares (e.g. “Series A Preferred”). Some buckets come with promises. | New fields on `share_classes`: `liquidation_preference_multiple` (default 1.0), `participating` (boolean), `participation_cap_multiple` (optional), `seniority_rank` (smallint). |
| **Convertible security** | An investor’s coupon that can convert to shares at a bargain price or be paid back. | New term fields on `convertible_securities`: `valuation_cap_cents`, `discount_rate_percent`, `interest_rate_percent`, `maturity_date`, `seniority_rank`. |
| **Waterfall scenario** | One “what‑if” exit (e.g. sell for $50 M). Saves inputs plus computed payouts. | Tables `liquidation_scenarios` and `liquidation_payouts` with foreign keys to existing models. |

### 3. Where to Look in the Codebase
| Folder/file | Why you care |
|-------------|--------------|
| `backend/app/models/share_class.rb` | Will receive the new deal-term columns. |
| `backend/app/models/convertible_security.rb` | Add term columns here. |
| `backend/app/services/dividend_computation_generation.rb` | Pattern for a calculation service. |
| `frontend/app/equity` | Existing Equity UI – the Waterfall page belongs here. |
| `frontend/trpc` | Existing routers to copy for the API layer. |

### 4. Epic Breakdown (5 Milestones)
| Milestone | Done means |
|-----------|-----------|
| **M1 – Data layer** | Migrations for `liquidation_scenarios` and `liquidation_payouts`; new deal-term columns; RSpec validations green. |
| **M2 – Calculation service** | `LiquidationScenarioCalculation` writes payout rows just like `DividendComputationGeneration` writes its outputs. Unit tests with a sample multi-class fixture. |
| **M3 – API** | tRPC mutation `liquidationScenarios.run` and query `liquidationScenarios.show`. |
| **M4 – UI** | New Waterfall tab, scenario form, results table, CSV export. |
| **M5 – QA & Docs** | Playwright test for a full scenario; add `docs/waterfall.md`. |

### 5. Your First Task
Create Milestone 1:
1. Generate the migrations.
2. Update models with validations.
3. Add minimal RSpec tests.
4. Run `bin/rspec` – ensure all tests pass.
5. Open PR titled `waterfall: add scenario and payout models`.

### 6. How to Fill Gaps / Ask Questions
1. Search the repo first – `rg DividendComputation` is a helpful example.
2. Record open questions in `docs/decision-log.md` (create it if missing).
3. Use Slack `#flexile-dev` for quick help.
4. If blocked for more than an hour, comment on your PR with **HELP NEEDED**.

### 7. Success Criteria for the Epic
* A founder can create multiple exit scenarios and download accurate CSVs.
* Payout math matches a verified spreadsheet within ±1 cent.
* UI uses existing design tokens, works on mobile, and shows helpful states.
* No regression to dividends or other equity features – the test suite stays green.

Welcome aboard! Start with Milestone 1 and continue through the milestones or grab tasks from the Waterfall epic column on the board.
