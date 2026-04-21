# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

# Install all deps (including devDeps needed for build)
RUN npm install

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

# Install production deps only
RUN npm install --omit=dev

# Generate Prisma client in production image
RUN npx prisma generate

# Copy compiled output
COPY --from=builder /app/dist ./dist

EXPOSE 8080

# Prisma 6: migrate deploy reads DATABASE_URL directly from environment
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
