FROM node:22

# Install system dependencies
RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Enable corepack for pnpm
RUN corepack enable

# Set working directory
WORKDIR /workspaces/flexile

# Copy package files
COPY package.json pnpm-lock.yaml ./
COPY frontend/package.json ./frontend/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Set default command
CMD ["sleep", "infinity"]
