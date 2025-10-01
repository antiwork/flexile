# Use official Ruby image with pre-built binaries
FROM ruby:3.4.1-slim

# Install system dependencies
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y \
    build-essential \
    curl \
    git \
    libjemalloc2 \
    libpq-dev \
    libyaml-dev \
    node-gyp \
    pkg-config \
    python-is-python3 \
    chromium \
    chromium-driver && \
    rm -rf /var/lib/apt/lists /var/cache/apt/archives

# Install Node.js 22
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists /var/cache/apt/archives

# Enable corepack for pnpm
RUN corepack enable && corepack prepare pnpm@10.8.0 --activate

# Set working directory
WORKDIR /app

# Copy dependency files
COPY package.json pnpm-lock.yaml ./
COPY backend/Gemfile backend/Gemfile.lock ./backend/

# Install Ruby dependencies
WORKDIR /app/backend
RUN bundle install --jobs 4 --retry 3 --without development test

# Install Node dependencies
WORKDIR /app
RUN pnpm install --frozen-lockfile

# Copy application code
COPY . .

# Generate TypeScript routes
WORKDIR /app/backend
RUN bundle exec rails js:routes:typescript

# Build Next.js frontend
WORKDIR /app
RUN pnpm run build-next

# Precompile Rails assets
WORKDIR /app/backend
RUN SECRET_KEY_BASE=dummy bundle exec rails assets:precompile

# Set environment variables
ENV RAILS_ENV=production \
    NODE_ENV=production \
    RAILS_SERVE_STATIC_FILES=true \
    RAILS_LOG_TO_STDOUT=true

# Expose port
EXPOSE 3000

# Start server
CMD ["bundle", "exec", "rails", "server", "-b", "0.0.0.0", "-p", "$PORT"]

