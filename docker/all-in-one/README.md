# Flexile All-in-One Container

A single Docker container that runs the entire Flexile application stack, perfect for demos, testing, and simplified deployments.

## 📦 What's Included

All services run within a single container managed by Supervisor:

- **PostgreSQL 15** - Database (port 5432)
- **Redis 7** - Cache & queue backend (port 6379)
- **MinIO** - S3-compatible object storage (ports 9000/9001)
- **Rails Backend** - API server (port 3000)
- **Next.js Frontend** - Web application (port 3001)
- **Sidekiq** - Background job processor
- **Nginx** - Reverse proxy (ports 80/443)

## 🚀 Quick Start

### Build the Container

```bash
# Build the all-in-one container
mise docker:all-in-one:build

# Or manually:
docker build -f docker/Dockerfile.all-in-one -t flexile-all-in-one:latest .
```

### Run the Container

```bash
# Start the all-in-one container
mise docker:aio

# Or manually:
docker run -d \
  --name flexile-aio \
  -p 80:80 \
  -p 443:443 \
  -p 3000:3000 \
  -p 3001:3001 \
  -p 5432:5432 \
  -p 6379:6379 \
  -p 9000:9000 \
  -p 9001:9001 \
  -v flexile-aio-postgres:/var/lib/postgresql/data \
  -v flexile-aio-redis:/var/lib/redis \
  -v flexile-aio-minio:/var/lib/minio \
  -v $(pwd):/app:cached \
  --add-host flexile.dev:127.0.0.1 \
  --add-host app.flexile.dev:127.0.0.1 \
  --add-host api.flexile.dev:127.0.0.1 \
  --add-host minio.flexile.dev:127.0.0.1 \
  --add-host minio-console.flexile.dev:127.0.0.1 \
  flexile-all-in-one:latest
```

## 📋 Management Commands

All commands are available through mise:

```bash
# View logs
mise docker:all-in-one:logs

# Check service status
mise docker:all-in-one:status

# Open shell in container
mise docker:all-in-one:shell

# Restart all services
mise docker:all-in-one:restart

# Stop container
mise docker:all-in-one:stop

# Clean up (removes container and volumes)
mise docker:all-in-one:clean
```

## 🌐 Access Points

Once running, access the application at:

- **Application**: https://flexile.dev or https://app.flexile.dev
- **API**: https://api.flexile.dev
- **MinIO Console**: https://minio-console.flexile.dev
  - Username: `minioadmin`
  - Password: `minioadmin123`
- **MinIO API**: https://minio.flexile.dev

## 🏗️ Architecture

### Process Management

Supervisor manages all processes with automatic restart on failure:

```
┌──────────────────────────────────────────┐
│             Supervisor                    │
├──────────────────────────────────────────┤
│  Group: services (Priority: 10)          │
│    ├─ postgresql (database)              │
│    ├─ redis (cache)                      │
│    └─ minio (object storage)             │
│                                          │
│  Group: application (Priority: 50)       │
│    ├─ rails (backend API)                │
│    ├─ sidekiq (background jobs)          │
│    ├─ nextjs (frontend)                  │
│    └─ nginx (reverse proxy)              │
└──────────────────────────────────────────┘
```

### Service Startup Order

1. **Core Services** start first (PostgreSQL, Redis, MinIO)
2. **Wait for Services** script ensures all are ready
3. **Database Migrations** run automatically
4. **MinIO Buckets** are created
5. **Application Services** start (Rails, Sidekiq, Next.js, Nginx)

### Data Persistence

Three Docker volumes persist data between container restarts:

- `flexile-aio-postgres` - Database data
- `flexile-aio-redis` - Cache data
- `flexile-aio-minio` - Object storage data

### Development Mode

The container mounts your local code directory (`-v $(pwd):/app:cached`), allowing live code changes without rebuilding the container.

## 🔧 Configuration

### Environment Variables

Default environment variables are set in the Dockerfile:

```bash
RAILS_ENV=development
NODE_ENV=development
POSTGRES_USER=username
POSTGRES_PASSWORD=password
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=minioadmin123
```

Override them when running the container:

```bash
docker run -e RAILS_ENV=production ...
```

### Custom Domains

Add custom domains to your `/etc/hosts`:

```bash
127.0.0.1 flexile.dev app.flexile.dev api.flexile.dev
127.0.0.1 minio.flexile.dev minio-console.flexile.dev
```

## 🏥 Health Checks

The container includes health checks for all services:

```bash
# Check health from outside
docker exec flexile-aio /usr/local/bin/health-check.sh

# Or use mise
mise docker:all-in-one:status
```

## 🐛 Troubleshooting

### View Supervisor Logs

```bash
docker exec flexile-aio tail -f /var/log/supervisor/supervisord.log
```

### View Service Logs

```bash
# Rails logs
docker exec flexile-aio tail -f /var/log/supervisor/rails.log

# Next.js logs
docker exec flexile-aio tail -f /var/log/supervisor/nextjs.log

# PostgreSQL logs
docker exec flexile-aio tail -f /var/log/supervisor/postgresql.log
```

### Restart Individual Services

```bash
# Restart Rails only
docker exec flexile-aio supervisorctl restart rails

# Restart all application services
docker exec flexile-aio supervisorctl restart application:*
```

### Database Access

```bash
# Connect to PostgreSQL
docker exec -it flexile-aio psql -U username -d flexile_development
```

### Redis Access

```bash
# Connect to Redis
docker exec -it flexile-aio redis-cli
```

## ⚡ Performance Considerations

### Advantages
- **Single container** to manage
- **Reduced overhead** from container orchestration
- **Simplified networking** (all services on localhost)
- **Fast inter-service communication**

### Trade-offs
- **Less production-like** than multi-container setup
- **All services share** CPU and memory resources
- **Harder to scale** individual services
- **Single point of failure**

## 🎯 Use Cases

### ✅ Ideal For
- **Demos and presentations**
- **Testing and QA environments**
- **Single-developer setups**
- **Quick prototyping**
- **CI/CD testing**

### ❌ Not Recommended For
- **Production deployments**
- **High-traffic applications**
- **Teams requiring service isolation**
- **Scenarios requiring horizontal scaling**

## 🔄 Migration Path

To migrate from all-in-one to multi-container:

1. Export data from volumes
2. Use the standard `docker-compose.dev.yml`
3. Import data into new containers
4. Update configuration as needed

## 📚 Additional Resources

- [Supervisor Documentation](http://supervisord.org/)
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [Main Docker Development Setup](../README.md)