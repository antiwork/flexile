# Flexile Dev Container Setup

This dev container provides a complete development environment for Flexile with Rails, Next.js, PostgreSQL, Redis, and Nginx running with TLS support.

## Prerequisites

- [Docker](https://docs.docker.com/engine/install/)
- [VS Code](https://code.visualstudio.com/) with [Dev Containers extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers)

## One-time Host Setup

### 1. Add Local Domain to /etc/hosts

```bash
sudo sh -c 'echo "127.0.0.1 flexile.dev" >> /etc/hosts'
```

### 2. Generate TLS Certificates

#### Option A: Automatic Setup (Recommended)

Run the certificate setup script:

```bash
./.devcontainer/setup-certs.sh
```

#### Option B: Manual Setup

**macOS:**

```bash
brew install mkcert nss
mkdir -p .certs
mkcert -install
mkcert -key-file ./.certs/flexile.dev.key -cert-file ./.certs/flexile.dev.crt flexile.dev
```

**Linux:**

```bash
curl -JLO "https://dl.filippo.io/mkcert/latest?for=linux/amd64"
chmod +x mkcert-v*-linux-amd64
sudo mv mkcert-v*-linux-amd64 /usr/local/bin/mkcert
mkdir -p .certs
mkcert -install
mkcert -key-file ./.certs/flexile.dev.key -cert-file ./.certs/flexile.dev.crt flexile.dev
```

### 3. Create Environment File

Create `.env.development` based on the template:

```bash
# Copy the template and customize as needed
cp .devcontainer/env.development.template .env.development
```

## Starting the Dev Container

### Option A: VS Code (Recommended)

1. Open the project in VS Code
2. Press `Cmd/Ctrl + Shift + P`
3. Type "Dev Containers: Open Folder in Container"
4. Select the current folder

### Option B: Command Line

```bash
# Start all services
docker compose -f docker-compose.dev.yml up -d --build

# Or start individual services
docker compose -f docker-compose.dev.yml up postgres redis -d
docker compose -f docker-compose.dev.yml up rails next nginx
```

## Accessing the Application

Once the dev container is running, you can access:

- **Main Application**: https://flexile.dev
- **Rails API**: http://localhost:3000
- **Next.js Frontend**: http://localhost:3001
- **Inngest Dashboard**: http://localhost:8288
- **PostgreSQL**: localhost:5432
- **Redis**: localhost:6379

## Services Architecture

```
┌─────────────────┐    ┌─────────────────┐
│     Browser     │────│      Nginx      │
│  flexile.dev    │    │   (Port 443)    │
└─────────────────┘    └─────────────────┘
                                │
                       ┌────────┴────────┐
                       │                 │
              ┌─────────▼──┐    ┌────────▼─────┐
              │  Next.js   │    │    Rails     │
              │ (Port 3001)│    │ (Port 3000)  │
              └────────────┘    └──────────────┘
                       │                 │
              ┌────────┴────────┬────────▼─────┐
              │                 │              │
        ┌─────▼──┐    ┌────────▼─┐    ┌──────▼──┐
        │Inngest │    │PostgreSQL│    │  Redis  │
        │ (8288) │    │  (5432)  │    │ (6379)  │
        └────────┘    └──────────┘    └─────────┘
```

## Development Workflow

1. **Backend Development**: Edit files in `backend/` - Rails will auto-reload
2. **Frontend Development**: Edit files in `frontend/` - Next.js will hot-reload
3. **Database Changes**: Run migrations in the Rails container
4. **Background Jobs**: Sidekiq runs automatically for job processing

## Useful Commands

### Inside the Dev Container

```bash
# Rails commands
cd backend
bin/rails console
bin/rails db:migrate
bin/rails db:seed

# Frontend commands
cd frontend
pnpm dev
pnpm build
pnpm typecheck

# Database access
psql -h postgres -U username -d flexile_development

# Redis access
redis-cli -h redis
```

### Docker Compose Commands

```bash
# View logs
docker compose -f docker-compose.dev.yml logs -f [service_name]

# Restart a service
docker compose -f docker-compose.dev.yml restart [service_name]

# Stop all services
docker compose -f docker-compose.dev.yml down

# Rebuild and restart
docker compose -f docker-compose.dev.yml up -d --build
```

## Troubleshooting

### SSL Certificate Issues

If you see SSL/TLS errors:

1. Regenerate certificates: `./.devcontainer/setup-certs.sh`
2. Restart the nginx service: `docker compose -f docker-compose.dev.yml restart nginx`

### Database Connection Issues

1. Ensure PostgreSQL is healthy: `docker compose -f docker-compose.dev.yml ps postgres`
2. Check database URL in `.env.development`
3. Recreate the database: `cd backend && bin/rails db:drop db:create db:migrate`

### Port Conflicts

If ports are already in use:

```bash
# Find processes using ports
lsof -ti:3000,3001,5432,6379,443,80,8288

# Kill processes if needed
kill -9 $(lsof -ti:3000,3001,5432,6379,443,80,8288)
```

### Node Modules Issues

```bash
# Clear and reinstall
docker compose -f docker-compose.dev.yml down
docker volume rm flexile_node_modules flexile_frontend_node_modules
docker compose -f docker-compose.dev.yml up -d --build
```

## Environment Variables

Key environment variables in `.env.development`:

- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis connection string
- `DOMAIN`: Base domain (flexile.dev)
- `NEXT_PUBLIC_API_ORIGIN`: Frontend API origin
- `ENABLE_DEFAULT_OTP`: Use 000000 as OTP for development

## VS Code Extensions

The dev container automatically installs:

- Ruby LSP
- ESLint
- Prettier
- Tailwind CSS IntelliSense
- Docker
- Prisma

## Performance Tips

1. Use named volumes for dependencies to speed up rebuilds
2. Use `cached` mount option for source code volumes
3. Increase Docker memory allocation if needed
4. Use `NODE_OPTIONS=--max-old-space-size=4096` for large builds
