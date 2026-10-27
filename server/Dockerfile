# Production Node.js 22 LTS Alpine Container
FROM node:22-alpine

# Install dumb-init for clean process reaping and signal propagation (SIGTERM/SIGINT)
RUN apk add --no-cache dumb-init

WORKDIR /app

ENV NODE_ENV=production

# Install production dependencies first for optimal Docker layer caching
COPY package.json ./
RUN npm install --omit=dev

# Copy application source code
COPY . .

# Ensure non-root node user owns application files
RUN chown -R node:node /app

USER node
EXPOSE 4000

# Container-level health check probe
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:4000/api/health || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "src/index.js"]
