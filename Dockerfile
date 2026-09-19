# SPIN ETHIOPIA PRODUCTION DOCKERFILE
# Multi-stage optimized build for 24/7 Hosting (Render, Railway, Cloud Run, VPS)

FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json ./

# Install dependencies
RUN npm install

# Copy application source
COPY . .

# Build frontend and production bundled backend
RUN npm run build

# Production runtime
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Copy package files and install only production dependencies
COPY package.json ./
RUN npm install --omit=dev

# Copy compiled artifacts and initial database
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/data ./data
COPY --from=builder /app/public ./public

# Ensure database directory exists and is writable
RUN mkdir -p /app/data && chmod -R 777 /app/data

EXPOSE 3000

# Start production server
CMD ["node", "dist/server.cjs"]
