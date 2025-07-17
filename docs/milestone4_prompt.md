# Milestone 4: Frontend UI Implementation Prompt

You are tasked with implementing the frontend UI for the liquidation waterfall feature in Flexile. This is Milestone 4 of the waterfall epic.

## Important Context and Limitations

**CRITICAL**: You are operating in a "flying blind" environment where you CANNOT:
- Run any tests or test suites
- Execute the application to verify functionality
- Run build commands or type checking
- See runtime errors or console output

This means you must be extremely careful to write correct code on the first attempt by closely following existing patterns in the codebase.

## Previous Work Completed

- **Milestone 1**: Data layer with migrations and models (completed)
- **Milestone 2**: Calculation service in Rails backend (completed)
- **Milestone 3**: tRPC API layer with router and endpoints (completed)

The tRPC router is already implemented at `frontend/trpc/routes/liquidationScenarios.ts` with:
- `run` mutation: Creates a new scenario and triggers calculation
- `show` query: Retrieves a scenario with all payouts
- `list` query: Lists scenarios with pagination

## Your Task: Implement Milestone 4 - Frontend UI

### Required Deliverables

1. **Navigation Entry**
   - File: `/frontend/app/equity/index.ts`
   - Add "Waterfall" entry to the equity navigation
   - Include proper authorization check: `company.flags.includes("liquidation_scenarios") && (isAdmin || isLawyer)`
   - Route should be `/equity/waterfall`

2. **List View Page**
   - File: `/frontend/app/equity/waterfall/page.tsx`
   - Use `EquityLayout` wrapper like other equity pages
   - Display scenarios in a DataTable with columns: Name, Exit Amount, Exit Date, Status, Created At
   - Include "New Scenario" button for administrators
   - Implement row click navigation to detail view
   - Add CSV download button

3. **Create Scenario Form**
   - File: `/frontend/app/equity/waterfall/new/page.tsx`
   - Use react-hook-form with zod validation
   - Form fields:
     - name (required, string)
     - description (optional, string)
     - exitAmountCents (required, use NumberInput with prefix="$")
     - exitDate (required, use DatePicker)
   - Use MutationStatusButton for form submission
   - Call `trpc.liquidationScenarios.run` mutation
   - Navigate to detail view on success

4. **Detail View Page**
   - File: `/frontend/app/equity/waterfall/[id]/page.tsx`
   - Display scenario details at top
   - Show payouts in DataTable grouped by security type
   - Columns: Investor Name, Share Class, Security Type, Number of Shares, Payout Amount
   - Include additional columns for liquidation preference and participation amounts
   - Add CSV download for scenario payouts

### Implementation Guidelines

1. **Follow Existing Patterns**
   - Study `/frontend/app/equity/cap-table/page.tsx` for DataTable usage
   - Look at `/frontend/app/equity/option-pools/new/page.tsx` for form patterns
   - Reference `/frontend/app/invoices/page.tsx` for CSV download implementation

2. **Component Usage**
   - Import components from `@/components/ui/*`
   - Use `DataTable` with `useTable` hook
   - Use `Form`, `FormField`, `FormControl` for forms
   - Use `NumberInput` for currency inputs (remember to handle BigInt conversion)
   - Use `Alert` for error states
   - Use `Placeholder` for empty states

3. **Data Fetching**
   - Use `useSuspenseQuery` for data fetching
   - Handle loading with `TableSkeleton`
   - Convert BigInt values to strings for display

4. **Type Safety**
   - Import types from the tRPC router
   - Use proper TypeScript types throughout
   - Handle BigInt conversions carefully (backend sends as strings)

5. **Authorization**
   - Check `isAdmin` for create/edit actions
   - Both admin and lawyer roles can view scenarios

## Common Pitfalls to Avoid

1. **BigInt Handling**: The backend sends BigInt values as strings. Always handle conversions properly.
2. **Import Paths**: Use `@/` for absolute imports, not relative paths.
3. **Component Naming**: Follow the existing PascalCase convention for components.
4. **Date Formatting**: Use the existing date formatting utilities found in the codebase.
5. **CSV Downloads**: Don't try to generate CSV client-side - use backend endpoints.

## File Locations Reference

- Navigation: `/frontend/app/equity/index.ts`
- New pages: `/frontend/app/equity/waterfall/*.tsx`
- tRPC router: `/frontend/trpc/routes/liquidationScenarios.ts` (already implemented)
- UI components: `/frontend/components/ui/*`

## Verification Approach

Since you cannot run tests, ensure correctness by:
1. Carefully copying patterns from similar existing pages
2. Double-checking all imports and component usage
3. Ensuring proper TypeScript types throughout
4. Following the exact file structure and naming conventions

Remember: You're implementing a read-only view with a creation form. The calculation happens on the backend, so the frontend just displays results and allows scenario creation.

Good luck!