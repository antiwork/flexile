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
COPY patches ./patches/
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
RUN DOMAIN=localhost \
    PROTOCOL=https \
    ACTIVE_RECORD_ENCRYPTION_PRIMARY_KEY=dummy_key_for_build \
    ACTIVE_RECORD_ENCRYPTION_DETERMINISTIC_KEY=dummy_key_for_build \
    ACTIVE_RECORD_ENCRYPTION_KEY_DERIVATION_SALT=dummy_salt_for_build \
    RESEND_API_KEY=dummy_resend_key \
    AWS_ACCESS_KEY_ID=dummy_aws_key \
    AWS_SECRET_ACCESS_KEY=dummy_aws_secret \
    AWS_REGION=us-east-1 \
    S3_PRIVATE_BUCKET=dummy-private \
    S3_PUBLIC_BUCKET=dummy-public \
    STRIPE_ENDPOINT_SECRET=dummy_stripe_secret \
    STRIPE_SECRET_KEY=dummy_stripe_key \
    SLACK_WEBHOOK_URL=https://hooks.slack.com/dummy \
    SLACK_WEBHOOK_CHANNEL=dummy \
    SLACK_TOKEN=dummy_token \
    SLACK_CHANNEL_ID=dummy_channel \
    WISE_PROFILE_ID=12345 \
    WISE_API_KEY=dummy_wise_key \
    HELPER_HMAC_SECRET=dummy_helper_secret \
    API_SECRET_TOKEN=dummy_api_token \
    NEXTAUTH_SECRET=dummy_nextauth_secret \
    GOOGLE_CLIENT_ID=dummy_google_id \
    GOOGLE_CLIENT_SECRET=dummy_google_secret \
    RAILS_MASTER_KEY=dummy_master_key_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx \
    bundle exec rails js:routes:typescript

# Build Next.js frontend
WORKDIR /app
RUN SKIP_TYPE_CHECK=true \
    DATABASE_URL=postgresql://dummy:dummy@localhost:5432/dummy \
    RESEND_API_KEY=dummy_resend_key \
    AWS_ACCESS_KEY_ID=dummy_aws_key \
    AWS_SECRET_ACCESS_KEY=dummy_aws_secret \
    AWS_REGION=us-east-1 \
    S3_PRIVATE_BUCKET=dummy-private \
    S3_PUBLIC_BUCKET=dummy-public \
    STRIPE_ENDPOINT_SECRET=dummy_stripe_secret \
    STRIPE_SECRET_KEY=dummy_stripe_key \
    ACTIVE_RECORD_ENCRYPTION_DETERMINISTIC_KEY=dummy_key_for_build \
    ACTIVE_RECORD_ENCRYPTION_PRIMARY_KEY=dummy_key_for_build \
    ACTIVE_RECORD_ENCRYPTION_KEY_DERIVATION_SALT=dummy_salt_for_build \
    DOMAIN=localhost \
    PROTOCOL=https \
    SLACK_WEBHOOK_URL=https://hooks.slack.com/dummy \
    SLACK_WEBHOOK_CHANNEL=dummy \
    SLACK_TOKEN=dummy_token \
    SLACK_CHANNEL_ID=dummy_channel \
    WISE_PROFILE_ID=12345 \
    WISE_API_KEY=dummy_wise_key \
    HELPER_HMAC_SECRET=dummy_helper_secret \
    API_SECRET_TOKEN=dummy_api_token \
    NEXTAUTH_SECRET=dummy_nextauth_secret \
    GOOGLE_CLIENT_ID=dummy_google_id \
    GOOGLE_CLIENT_SECRET=dummy_google_secret \
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_dummy \
    NEXT_PUBLIC_API_URL=http://localhost:3001 \
    pnpm run build-next

# Precompile Rails assets
WORKDIR /app/backend
RUN DOMAIN=localhost \
    PROTOCOL=https \
    SECRET_KEY_BASE=dummy_secret_for_build \
    ACTIVE_RECORD_ENCRYPTION_PRIMARY_KEY=dummy_key_for_build \
    ACTIVE_RECORD_ENCRYPTION_DETERMINISTIC_KEY=dummy_key_for_build \
    ACTIVE_RECORD_ENCRYPTION_KEY_DERIVATION_SALT=dummy_salt_for_build \
    RESEND_API_KEY=dummy_resend_key \
    AWS_ACCESS_KEY_ID=dummy_aws_key \
    AWS_SECRET_ACCESS_KEY=dummy_aws_secret \
    AWS_REGION=us-east-1 \
    S3_PRIVATE_BUCKET=dummy-private \
    S3_PUBLIC_BUCKET=dummy-public \
    STRIPE_ENDPOINT_SECRET=dummy_stripe_secret \
    STRIPE_SECRET_KEY=dummy_stripe_key \
    SLACK_WEBHOOK_URL=https://hooks.slack.com/dummy \
    SLACK_WEBHOOK_CHANNEL=dummy \
    SLACK_TOKEN=dummy_token \
    SLACK_CHANNEL_ID=dummy_channel \
    WISE_PROFILE_ID=12345 \
    WISE_API_KEY=dummy_wise_key \
    HELPER_HMAC_SECRET=dummy_helper_secret \
    API_SECRET_TOKEN=dummy_api_token \
    NEXTAUTH_SECRET=dummy_nextauth_secret \
    GOOGLE_CLIENT_ID=dummy_google_id \
    GOOGLE_CLIENT_SECRET=dummy_google_secret \
    RAILS_MASTER_KEY=dummy_master_key_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx \
    bundle exec rails assets:precompile

# Set environment variables
ENV RAILS_ENV=production \
    NODE_ENV=production \
    RAILS_SERVE_STATIC_FILES=true \
    RAILS_LOG_TO_STDOUT=true

# Expose port
EXPOSE 3000

# Set runtime working directory to backend
WORKDIR /app/backend

# Start server (run migrations first)
CMD ["sh", "-c", "bundle exec rails db:migrate && bundle exec rails server -b 0.0.0.0 -p ${PORT:-3000}"]
