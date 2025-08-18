# Flexile Development with Mise

This document explains how to use [mise](https://mise.jdx.dev) to manage the Flexile development environment. Mise replaces all scattered scripts (`bin/dev`, `bin/setup`, `bin/lint`, etc.) with a unified task runner.

## Quick Start

```bash
# 1. Install dependencies and setup environment
mise run setup

# 2. Start development server
mise run dev

# 3. Run tests
mise run test

# 4. Lint code
mise run lint
```

## Installation

Mise should already be installed. Verify with:

```bash
mise --version
```

If not installed, follow the [mise installation guide](https://mise.jdx.dev/getting-started.html).

## Configuration Files

- **`/mise.toml`** - Root configuration with project-wide tasks
- **`/backend/mise.toml`** - Backend-specific Rails tasks

## Available Tasks

### Main Development Tasks

| Task | Alias | Description | Replaces |
|------|-------|-------------|----------|
| `mise run setup` | `install` | Complete project setup | `bin/setup` |
| `mise run dev` | `start` | Start development server | `bin/dev` |
| `mise run dev:test` | `test-server` | Start test server | `bin/test_server` |
| `mise run lint` | `l` | Run all linting | `bin/lint` |
| `mise run test` | `t` | Run all tests | Manual commands |
| `mise run clean` | `c` | Clean temporary files | Manual cleanup |
| `mise run doctor` | `check` | Health check environment | Manual checks |

### Docker Services

| Task | Alias | Description |
|------|-------|-------------|
| `mise run docker:up` | `services` | Start Docker services (PostgreSQL, Redis, Nginx, MinIO) |
| `mise run docker:down` | | Stop Docker services |
| `mise run docker:logs` | | Show service logs |
| `mise run docker:reset` | | Reset services & volumes |

### MinIO S3 Storage

| Task | Description |
|------|-------------|
| `mise run minio:setup` | Setup MinIO and create required buckets |
| `mise run minio:buckets` | List all MinIO buckets |
| `mise run minio:console` | Open MinIO web console |
| `mise run minio:status` | Check MinIO service status |
| `mise run minio:clean` | Clean all MinIO data and buckets |
| `mise run s3:test` | Test S3 compatibility with sample file |

### Database Tasks

| Task | Description |
|------|-------------|
| `mise run db:setup` | Setup and prepare database |
| `mise run db:reset` | Reset with fresh seed data |
| `mise run db:migrate` | Run migrations |
| `mise run db:rollback` | Rollback last migration |
| `mise run db:seed` | Seed with sample data |
| `mise run db:console` | Open database console |

### Testing Tasks

| Task | Alias | Description |
|------|-------|-------------|
| `mise run test` | `t` | Run all tests |
| `mise run test:rails` | `tr` | Rails specs only |
| `mise run test:e2e` | `te` | Playwright e2e only |
| `mise run test:watch` | | Run tests in watch mode |
| `mise run test:coverage` | | Generate coverage report |

### Linting & Formatting

| Task | Description |
|------|-------------|
| `mise run lint` | Run all linting |
| `mise run lint:frontend` | Frontend only |
| `mise run lint:backend` | Backend only |
| `mise run format` | Format all code |

### Dependency Management

| Task | Description |
|------|-------------|
| `mise run deps:install` | Install all dependencies |
| `mise run deps:update` | Update all dependencies |
| `mise run deps:audit` | Security audit |

### CI/CD Tasks

| Task | Description |
|------|-------------|
| `mise run ci:test` | Run CI test suite |
| `mise run release:prepare` | Prepare database for release |
| `mise run release:deploy` | Deploy to production |

### Utilities

| Task | Alias | Description |
|------|-------|-------------|
| `mise run console` | `c` | Open Rails console |
| `mise run routes` | | Show Rails routes |
| `mise run logs` | | Show application logs |
| `mise run credentials:edit` | | Edit Rails credentials |

## Backend-Specific Tasks

When in the `backend/` directory, additional Rails-specific tasks are available:

### Rails Commands

| Task | Alias | Description |
|------|-------|-------------|
| `mise run rails:server` | `s` | Start Rails server only |
| `mise run rails:console` | `c` | Rails console |
| `mise run rails:generate` | `g` | Generate components |
| `mise run rails:destroy` | `d` | Destroy components |
| `mise run rails:routes` | `r` | Show routes |

### Database Tasks (Backend)

| Task | Description |
|------|-------------|
| `mise run db:create` | Create database |
| `mise run db:drop` | Drop database |
| `mise run db:schema:load` | Load schema |
| `mise run db:schema:dump` | Dump schema |
| `mise run db:version` | Show DB version |

### Asset Tasks

| Task | Description |
|------|-------------|
| `mise run assets:precompile` | Precompile assets |
| `mise run assets:clean` | Clean assets |
| `mise run cache:clear` | Clear Rails cache |

### Testing (Backend)

| Task | Description |
|------|-------------|
| `mise run test:models` | Model tests |
| `mise run test:controllers` | Controller tests |
| `mise run test:requests` | Request tests |
| `mise run test:jobs` | Job tests |

### Security & Maintenance

| Task | Description |
|------|-------------|
| `mise run brakeman` | Security analysis |
| `mise run bundle:audit` | Gem security audit |
| `mise run annotate` | Annotate models |
| `mise run rubocop:auto` | Auto-fix RuboCop |

## Environment Variables

Mise manages environment variables in `mise.toml`:

```toml
[env]
RAILS_ENV = "development"
NODE_ENV = "development"
ENABLE_DEFAULT_OTP = "true"
AWS_REGION = "us-east-1"
AWS_ACCESS_KEY_ID = "minioadmin"
AWS_SECRET_ACCESS_KEY = "minioadmin123"
AWS_ENDPOINT_URL = "http://localhost:9000"
S3_PRIVATE_BUCKET = "flexile-development-private"
S3_PUBLIC_BUCKET = "flexile-development-public"
# ... other vars
```

### MinIO S3 Configuration

The development environment uses MinIO as an S3-compatible storage service:

- **MinIO Console**: http://localhost:9001 (minioadmin/minioadmin123)
- **MinIO API**: http://localhost:9000
- **Private Bucket**: `flexile-development-private` (requires authentication)
- **Public Bucket**: `flexile-development-public` (publicly accessible)

## Task Dependencies

Some tasks have dependencies that run automatically:

- `mise run dev` → runs `docker:up` first
- `mise run release:deploy` → runs `ci:test` first

## Interactive Tasks

Some tasks require user interaction:

- `mise run console` - Rails console (use `exit` to quit)
- `mise run db:console` - Database console
- `mise run credentials:edit` - Opens editor

## Confirmation Tasks

Destructive tasks require confirmation:

- `mise run db:drop` - Confirms before dropping database
- `mise run release:deploy` - Confirms before production deploy

## Common Workflows

### New Developer Onboarding

```bash
# 1. Clone repo and enter directory
git clone <repo> && cd flexile

# 2. Install mise (if needed)
curl https://mise.jdx.dev/install.sh | sh

# 3. Install tools and dependencies
mise install

# 4. Setup environment
mise run setup

# 5. Start development
mise run dev
```

### Daily Development

```bash
# Start development server
mise run dev

# Run tests before committing
mise run test

# Lint code
mise run lint

# Check environment health
mise run doctor
```

### Database Management

```bash
# Reset database with fresh data
mise run db:reset

# Run new migrations
mise run db:migrate

# Rollback if needed
mise run db:rollback
```

### Testing Workflows

```bash
# Run all tests
mise run test

# Run only Rails tests
mise run test:rails

# Run only e2e tests
mise run test:e2e

# Start test server for manual testing
mise run dev:test
```

### Production Deployment

```bash
# Run CI checks
mise run ci:test

# Prepare database for release
mise run release:prepare

# Deploy (with confirmation)
mise run release:deploy
```

## Troubleshooting

### Check Environment Health

```bash
mise run doctor
```

This checks:
- Mise installation
- Docker services
- Ruby/Node versions
- Database connectivity
- Environment variables

### Clean Up Issues

```bash
# Clean temporary files
mise run clean

# Reset Docker services
mise run docker:reset

# Check logs
mise run logs
```

### Port Conflicts

If you get port conflicts, the `dev` task automatically cleans up processes on ports 3000, 3001, and 8288.

### Ruby Version Issues

Ensure your system Ruby matches the mise configuration:

```bash
ruby --version  # Should show 3.4.1
mise current    # Shows active tool versions
```

## Migration from Old Scripts

| Old Command | New Command |
|-------------|-------------|
| `./bin/setup` | `mise run setup` |
| `./bin/dev` | `mise run dev` |
| `./bin/lint` | `mise run lint` |
| `./bin/test_server` | `mise run dev:test` |
| `make local` | `mise run docker:up` |
| `cd backend && bin/rails console` | `mise run console` |
| `cd backend && bundle exec rspec` | `mise run test:rails` |

## Advanced Usage

### Running Tasks with Arguments

```bash
# Pass arguments to foreman
mise run dev -- --port=3005

# Run specific test files
mise run test:rails -- spec/models/user_spec.rb
```

### Environment-Specific Tasks

```bash
# Run with test environment
RAILS_ENV=test mise run db:setup

# Run with production environment
RAILS_ENV=production mise run release:prepare
```

### Custom Task Development

Add custom tasks to `mise.toml`:

```toml
[tasks.my-task]
description = "My custom task"
run = "echo 'Hello from my task'"
```

## Benefits of Mise

1. **Unified Interface** - One command format for all tasks
2. **Self-Documenting** - `mise tasks` shows all available tasks
3. **Environment Management** - Automatic tool and env var setup
4. **Task Dependencies** - Automatic prerequisite execution
5. **Cross-Platform** - Works on Linux, macOS, Windows
6. **Fast** - Parallel execution and caching
7. **Extensible** - Easy to add new tasks and workflows

## Getting Help

```bash
# List all available tasks
mise tasks

# Get help for a specific task
mise run --help

# Show mise configuration
mise config

# Show current tool versions
mise current
```

For more information, visit the [mise documentation](https://mise.jdx.dev).
