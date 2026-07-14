# syntax=docker/dockerfile:1.7
# Build stage
FROM node:22-slim AS builder

WORKDIR /app

# Install system dependencies:
# - openssl: required by Prisma query engine
# - python3 + make + g++: required to compile bcrypt native module
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    apt-get update -y && \
    apt-get install -y --no-install-recommends openssl python3 make g++

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies WITHOUT running postinstall scripts.
# pnpm 11 blocks build scripts by default; we run them manually below.
# Cache mount keeps the pnpm store across builds so unchanged deps aren't re-fetched.
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    corepack enable pnpm && pnpm install --frozen-lockfile --ignore-scripts

# Copy only necessary files for build (explicit, not recursive)
COPY src/ ./src/
COPY prisma/ ./prisma/
COPY scripts/seed.ts ./scripts/seed.ts
COPY nest-cli.json tsconfig.json tsconfig.build.json tsconfig.scripts.json ./

# Generate Prisma client with the correct binary target (debian-openssl-3.0.x)
RUN pnpm prisma generate

# Compile bcrypt native module (skipped by --ignore-scripts above)
RUN pnpm rebuild bcrypt

# Build the application
RUN pnpm build

# Compile standalone scripts (e.g. seed) to plain JS for the prod image,
# since ts-node is a devDependency and isn't shipped there
RUN pnpm exec tsc -p tsconfig.scripts.json

# Remove devDependencies (build tooling like Nest/Angular CLI) so they never
# ship in the production image
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm prune --prod --ignore-scripts

# Production stage
FROM node:22-slim AS production

WORKDIR /app

# Install runtime dependencies only (openssl for Prisma engine)
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    apt-get update -y && \
    apt-get install -y --no-install-recommends openssl

# Create non-root user (Debian syntax, not Alpine)
RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 --gid nodejs nodejs

# Copy only built artifacts and runtime dependencies, owned by nodejs directly
# (avoids a slow recursive `chown -R` pass over node_modules)
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules/
COPY --from=builder --chown=nodejs:nodejs /app/prisma ./prisma/
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist/
COPY --from=builder --chown=nodejs:nodejs /app/dist-scripts ./dist-scripts/

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Start the application
CMD ["node", "dist/main.js"]
