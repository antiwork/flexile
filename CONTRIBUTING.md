# Contributing to Flexile

## Pull Requests

1. Update documentation if you're changing behavior
2. Add or update tests for your changes
3. Include screenshots of your test suite passing locally
4. Use native-sounding English in all communication with no excessive capitalization (e.g HOW IS THIS GOING), multiple question marks (how's this going???), grammatical errors (how's dis going), or typos (thnx fr update).
   - ❌ Before: "is this still open ?? I am happy to work on it ??"
   - ✅ After: "Is this actively being worked on? I've started work on it here…"
5. Make sure all tests pass
6. Request a review from maintainers
7. After reviews begin, avoid force-pushing to your branch
   - Force-pushing rewrites history and makes review threads hard to follow
   - Don't worry about messy commits - we squash everything when merging to main
8. Self-review your PR with explanatory comments for any non-intuitive or non-obvious changes to help reviewers understand your reasoning
9. The PR will be merged once you have the sign-off of at least one other developer

## Style Guide

- Follow the existing code patterns
- Use clear, descriptive variable names
- Write TypeScript for frontend code
- Follow Ruby conventions for backend code

## Development Guidelines

### Code Standards

- Always use the latest version of TypeScript, React, and Next.js
- Sentence case headers and buttons and stuff, not title case
- Always write ALL of the code
- Don't apologize for errors, fix them
- Newlines at end of files, always
- No explanatory comments please

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

### Tech Debt

- Add a `TODO (techdebt)` comment to document refactors that should be made in the future

## Writing Bug Reports

A great bug report includes:

- A quick summary and/or background
- Steps to reproduce
  - Be specific!
  - Give sample code if you can
- What you expected would happen
- What actually happens
- Notes (possibly including why you think this might be happening, or stuff you tried that didn't work)

## Help

- Check existing discussions/issues/PRs before creating new ones
- Start a discussion for questions or ideas
- Open an [issue](https://github.com/antiwork/flexile/issues) for bugs or problems
- We don't assign issues to contributors until they have a history of contributions to the project

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE.md).
