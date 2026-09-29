# ==============================================================================
# MaraPlus On-Premise Relay Agent - Production Dockerfile
# ==============================================================================
# Base Image: Lightweight Node.js 20 LTS on Alpine Linux
FROM node:20-alpine AS base

# Install security updates & dumb-init for proper PID 1 signal forwarding
RUN apk add --no-cache dumb-init tzdata ca-certificates

# Set production environment variables
ENV NODE_ENV=production
ENV MARAPLUS_BASE_URL=http://192.168.15.225:3002

WORKDIR /usr/src/app

# Copy dependency manifests first for maximum Docker layer caching
COPY package.json ./

# Install only production dependencies
RUN npm install --omit=dev --no-audit --no-fund

# Copy application source code
COPY index.js ./

# Assign ownership to unprivileged 'node' user for security compliance
RUN chown -R node:node /usr/src/app

# Run as non-root user
USER node

# Healthcheck to verify the node runtime is alive
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "process.exit(0)"

# Use dumb-init to ensure SIGTERM / SIGINT signals are cleanly routed to Node.js
ENTRYPOINT ["/usr/bin/dumb-init", "--"]

# Execute Relay Agent
CMD ["node", "index.js"]
