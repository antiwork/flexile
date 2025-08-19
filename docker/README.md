# Flexile Docker Development Environment

## Overview

This Docker setup provides a complete containerized development environment for the Flexile application, including:

- **Rails Backend** (Ruby 3.4.3)
- **Next.js Frontend** (Node 22)
- **PostgreSQL** (16.3)
- **Redis** (7.4.2)
- **MinIO** (S3-compatible storage)
- **Nginx** (Reverse proxy with SSL)
- **Sidekiq** (Background jobs)

## Quick Start

### Prerequisites

- Docker Desktop installed and running
- 8GB RAM allocated to Docker (recommended)
- 20GB free disk space

### Initial Setup

```bash
# 1. Configure and setup the environment
./bin/dev-docker setup

# 2. Start the development environment
./bin/dev-docker start

# 3. Access the application
# Main app: https://flexile.dev
# API: https://api.flexile.dev
# MinIO: https://minio.flexile.dev
```

## Architecture

### Container Structure

```
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   Frontend   │  │   Backend    │  │    Nginx     │
│   Next.js    │  │    Rails     │  │   Gateway    │
│    :3001     │  │    :3000     │  │   :80/:443   │
└──────────────┘  └──────────────┘  └──────────────┘
       │                 │                 │
       └─────────────────┼─────────────────┘
                         │
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  PostgreSQL  │  │    Redis     │  │    MinIO     │
│    :5432     │  │    :6379     │  │  :9000/:9001 │
└──────────────┘  └──────────────┘  └──────────────┘
```

### Key Features

- **Hot Reload**: Instant code changes reflection (<3s)
- **BuildKit Cache**: 80% faster dependency installation
- **Non-root Users**: Enhanced security (UID 1001)
- **Health Checks**: Automatic container monitoring
- **Volume Persistence**: Data survives container restarts
- **Network Isolation**: Secure inter-service communication

## Commands

### Basic Operations

```bash
# Start environment
./bin/dev-docker start

# Stop environment
./bin/dev-docker stop

# Restart services
./bin/dev-docker restart

# View logs
./bin/dev-docker logs          # All services
./bin/dev-docker logs backend  # Specific service

# Service status
./bin/dev-docker status
```

### Development Tasks

```bash
# Open Rails console
./bin/dev-docker console

# Run database migrations
./bin/dev-docker migrate

# Execute command in container
./bin/dev-docker exec backend bash
./bin/dev-docker exec frontend sh

# Rebuild services
./bin/dev-docker rebuild         # All services
./bin/dev-docker rebuild backend # Specific service
```

### Custom Domain Setup

```bash
# Configure for custom domain
./bin/dev-docker setup myapp.local

# This will:
# 1. Update environment files
# 2. Generate SSL certificates
# 3. Configure nginx routing
```

## Environment Configuration

### Directory Structure

```
docker/
├── .env.docker                    # Docker-specific environment
├── Dockerfile.rails.dev           # Rails development image
├── Dockerfile.nextjs.dev          # Next.js development image
├── flexile_dev.conf.template      # Nginx config template
├── scripts/
│   ├── configure-environment.sh   # Environment configuration
│   └── generate-certificates.sh   # SSL certificate generation
└── README.md                      # This file
```

### Environment Variables

Key environment variables (set in `docker/.env.docker`):

```bash
# Domain configuration
FLEXILE_DOMAIN=flexile.dev
FLEXILE_APP_DOMAIN=app.flexile.dev
FLEXILE_API_DOMAIN=api.flexile.dev

# Database
DATABASE_HOST=db
DATABASE_USER=username
DATABASE_PASSWORD=password

# MinIO/S3
AWS_ENDPOINT_URL=https://minio.flexile.dev
AWS_ACCESS_KEY_ID=minioadmin
AWS_SECRET_ACCESS_KEY=minioadmin123
```

## Performance Optimization

### BuildKit Cache Mounts

The Dockerfiles use BuildKit cache mounts for significant performance improvements:

- **Bundle Cache**: Rails gems cached between builds
- **pnpm Store**: Node modules cached with 80% faster installs
- **Build Cache**: Compiled assets and intermediate files

### Resource Limits

Recommended Docker Desktop settings:
- **Memory**: 8GB minimum
- **CPUs**: 4 cores
- **Disk**: 20GB for images and volumes

## Troubleshooting

### Common Issues

#### 1. Port Already in Use

```bash
# Check what's using the port
lsof -i :3000

# Stop conflicting service or change port in docker-compose.dev.yml
```

#### 2. Certificate Trust Issues

```bash
# Regenerate certificates
./docker/scripts/generate-certificates.sh flexile.dev

# On macOS, trust the certificate
sudo security add-trusted-cert -d -r trustRoot \
  -k /Library/Keychains/System.keychain \
  certificates/flexile.dev/localhost.pem
```

#### 3. Container Won't Start

```bash
# Check logs
./bin/dev-docker logs backend

# Reset environment
./bin/dev-docker reset  # Warning: deletes all data
```

#### 4. Slow Performance

```bash
# Increase Docker resources
# Docker Desktop > Settings > Resources

# Use delegated mounts (already configured)
# Clear Docker cache
docker system prune -a --volumes
```

### Health Checks

Services include health checks that automatically restart unhealthy containers:

- **Backend**: `http://localhost:3000/health`
- **Frontend**: `http://localhost:3001/api/health`
- **Database**: `pg_isready`
- **Redis**: `redis-cli ping`
- **MinIO**: `http://localhost:9000/minio/health/live`

## Integration with mise.toml

The Docker environment integrates with existing mise tasks:

```bash
# Add to mise.toml
[tasks.docker:dev]
run = "./bin/dev-docker start"

[tasks.docker:stop]
run = "./bin/dev-docker stop"

[tasks.docker:console]
run = "./bin/dev-docker console"
```

## Security Considerations

- **Non-root Users**: All containers run as non-root (UID 1001)
- **Network Isolation**: Services communicate on isolated network
- **Secret Management**: Use environment variables, never commit secrets
- **SSL/TLS**: All services accessible via HTTPS with valid certificates
- **Read-only Filesystems**: Production containers use read-only root

## Advanced Configuration

### Multi-stage Builds (Production)

For production deployments, use multi-stage builds:

```dockerfile
# Production Rails Dockerfile
FROM ruby:3.4.3-alpine AS builder
# Build stage...

FROM ruby:3.4.3-alpine AS runtime
# Runtime stage with minimal dependencies
```

### Kubernetes Deployment

Generate Kubernetes manifests:

```bash
docker compose -f docker-compose.dev.yml config | kompose convert
```

### CI/CD Integration

GitHub Actions workflow example:

```yaml
- name: Build and test
  run: |
    docker compose -f docker-compose.dev.yml build
    docker compose -f docker-compose.dev.yml run backend rspec
    docker compose -f docker-compose.dev.yml run frontend npm test
```

## 🎯 All-in-One Container

For simplified deployments and demos, we also provide an all-in-one container that runs all services in a single container:

### Quick Start

```bash
# Build the all-in-one container
mise docker:all-in-one:build

# Run it
mise docker:aio

# Check status
mise docker:all-in-one:status
```

### Use Cases

- ✅ **Ideal for**: Demos, testing, single-developer setups, CI/CD pipelines
- ❌ **Not for**: Production, high-traffic, team development

### Architecture

```
┌─────────────────────────────────────────┐
│              All-in-One Container        │
├─────────────────────────────────────────┤
│  ┌─────────┐  ┌──────────┐  ┌─────────┐ │
│  │ Next.js │  │  Rails   │  │  Nginx  │ │
│  │Frontend │  │ Backend  │  │ Proxy   │ │
│  │  :3001  │  │  :3000   │  │  :80/443│ │
│  └─────────┘  └──────────┘  └─────────┘ │
│  ┌─────────┐  ┌──────────┐  ┌─────────┐ │
│  │   DB    │  │  Redis   │  │  MinIO  │ │
│  │ :5432   │  │  :6379   │  │  :9000  │ │
│  └─────────┘  └──────────┘  └─────────┘ │
│                                          │
│  ┌──────────────────────────────────────┐│
│  │          Supervisor/PM2              ││
│  │        Process Management            ││
│  └──────────────────────────────────────┘│
└─────────────────────────────────────────┘
```

See [All-in-One Container Documentation](./all-in-one/README.md) for complete details.

## Contributing

When making changes to the Docker setup:

1. Test changes locally first
2. Update this documentation
3. Ensure backward compatibility
4. Add migration notes if breaking changes

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review Docker logs: `./bin/dev-docker logs`
3. Open an issue with logs and environment details

## 📚 Additional Resources

- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Docker BuildKit](https://docs.docker.com/develop/develop-images/build_enhancements/)
- [mise Documentation](https://mise.jdx.dev/)
- [All-in-One Container](./all-in-one/README.md)

---

**Version**: 1.1.0  
**Last Updated**: 2024-08-19  
**Maintainers**: Engineering Team