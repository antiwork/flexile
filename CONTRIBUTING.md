# Contributing to Flexile

Please see the main [Antiwork Contributing Guidelines](https://github.com/antiwork/.github/blob/main/CONTRIBUTING.md) for pull request guidelines, issue reporting, and general contribution requirements.

## Flexile-Specific Development Guidelines

### Feature Development

- Add page to `frontend/app/**/page.tsx`
- Add any components to `frontend/components/**/*.tsx`
- Add tRPC API routes to `frontend/trpc/routes/**/index.ts` and then add those to `frontend/trpc/server.ts`
- Create API handlers using tRPC API routes that follow REST principles
- Forms for adding new objects to the database should inherit values from the last object added to the table (e.g., contractor forms should default to the last contractor's values like contractSignedElsewhere, payRateInSubunits, role, etc.)

### Testing Guidelines

- All functional changes require specs for models, controllers, services, and e2e tests

### Frontend Development

- Do not use `React.FC`. Use the following syntax: `const Component = ({ prop1, prop2 }: { prop1: string; prop2: number }) => { ... }`
- When building UI, use existing components from `frontend/components/` when available: `Button`, `Input`, `DataTable`, `Placeholder`, `ComboBox`, `NumberInput`, `MutationButton`, `Dialog`, `Form` components, etc.

### Database Schema

- Any changes to the database schema via Rails migrations in `backend/db/migrate/` must be reflected in `frontend/db/schema.ts`
- The frontend schema file should be updated to match the Rails schema structure for type safety
