# Build stage
FROM node:20-slim AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends openssl && \
    rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN corepack enable pnpm && corepack prepare pnpm@9 --activate && pnpm install --frozen-lockfile

# Copy only necessary files for build (explicit, not recursive)
COPY src/ ./src/
COPY prisma/ ./prisma/
COPY scripts/seed.ts ./scripts/seed.ts
COPY nest-cli.json tsconfig.json tsconfig.build.json tsconfig.scripts.json ./

# Generate Prisma client
RUN pnpm prisma generate

# Build the application
RUN pnpm build

# Compile standalone scripts (e.g. seed) to plain JS for the prod image,
# since ts-node is a devDependency and isn't shipped there
RUN pnpm exec tsc -p tsconfig.scripts.json

# Remove devDependencies (build tooling like Nest/Angular CLI) so they never
# ship in the production image
RUN pnpm prune --prod

# Production stage
FROM node:20-slim AS production

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends openssl && \
    rm -rf /var/lib/apt/lists/*

# Copy only built artifacts and runtime dependencies
COPY --from=builder /app/node_modules ./node_modules/
COPY --from=builder /app/prisma ./prisma/
COPY --from=builder /app/dist ./dist/
COPY --from=builder /app/dist-scripts ./dist-scripts/

# Create non-root user and change ownership
RUN groupadd --gid 1001 nodejs && \
    useradd --uid 1001 --gid nodejs --shell /usr/sbin/nologin --create-home nodejs && \
    chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Start the application
CMD ["node", "dist/main.js"]
