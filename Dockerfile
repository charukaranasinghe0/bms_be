# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/
COPY prisma.config.ts ./

# Install all deps (including devDeps needed for build)
RUN npm ci

# Generate Prisma client
RUN npx prisma generate

COPY . .

RUN npm run build

# ── Stage 2: Production ────────────────────────────────────────────────────────
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
COPY prisma ./prisma/
COPY prisma.config.ts ./

# Install production deps only
RUN npm ci --omit=dev

# Generate Prisma client in production image
RUN npx prisma generate

# Copy compiled output
COPY --from=builder /app/dist ./dist

EXPOSE 4000

# Run migrations then start the server
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
