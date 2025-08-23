# Contributing to Flexile

Please see the main [Antiwork Contributing Guidelines](https://github.com/antiwork/.github/blob/main/CONTRIBUTING.md) for development guidelines.

Generally: include an AI disclosure, self-review (comment) on your code, break up big 1k+ line PRs into smaller PRs (100 loc), and include video of before/after with light/dark mode and mobile/desktop experiences represented. And include e2e tests!

## Flexile-Specific Development Guidelines

### Feature Development

- We are moving from tRPC to Rails, avoid writing new tRPC code
- Write end-to-end tests for all new functionality; edit tests to avoid writing new tests if possible

### Database Schema

- Any changes to the database schema via Rails migrations in `backend/db/migrate/` must be reflected in `frontend/db/schema.ts`
- The frontend schema.ts file should be updated to match the Rails schema.rb structure for type safety
