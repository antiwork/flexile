FROM ruby:3.4.3

# Install system dependencies
RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y \
    build-essential \
    libpq-dev \
    postgresql-client \
    nodejs \
    npm \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /workspaces/flexile

# Copy Gemfile and Gemfile.lock
COPY backend/Gemfile backend/Gemfile.lock ./backend/

# Install Ruby gems
RUN cd backend && bundle config set --local path 'vendor/bundle' && bundle install

# Create bundle cache directory
RUN mkdir -p /workspaces/flexile/backend/vendor/bundle

# Set default command
CMD ["sleep", "infinity"]
