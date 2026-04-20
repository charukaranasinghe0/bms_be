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

EXPOSE 4000

# Prisma 6: migrate deploy reads DATABASE_URL directly from environment
# resolve any previously failed migrations, then deploy and start
CMD ["sh", "-c", "npx prisma migrate resolve --rolled-back 20260407142854_restore_cookcategory_on_product 2>/dev/null || true && npx prisma migrate deploy && node dist/main.js"]
