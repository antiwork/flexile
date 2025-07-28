# Contributing to Flexile

Thanks for your interest in contributing! This document will help you get started.

## Quick Start

1. Set up the repository

```bash
git clone https://github.com/antiwork/flexile.git
```

2. Set up your development environment

For detailed instructions on setting up your local development environment, please refer to our [README](README.md).

## Development

1. Create your feature branch

```bash
git checkout -b feature/your-feature
```

2. Start the development environment

```bash
bin/dev
```

3. Run the test suite

```bash
# Run Rails specs
bundle exec rspec

# Run Playwright end-to-end tests
pnpm playwright test
```

## Testing Guidelines

- Write descriptive test names that explain the behavior being tested
- Keep tests independent and isolated
- For API endpoints, test response status, format, and content
- Use factories for test data instead of creating objects directly
- Test both happy path and edge cases
- Please include specific performance benchmarks for any optimizations

## Pull Request

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

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE.md).
