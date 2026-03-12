FROM node:20-slim AS build

WORKDIR /app

# Copy workspace root files
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json

# Install all dependencies (including dev for build)
RUN npm ci

# Copy API source
COPY apps/api/ apps/api/

# Generate Prisma client and build
RUN npm -w apps/api run build

# --- Production stage ---
FROM node:20-slim

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json

# Install production dependencies only
RUN npm ci --omit=dev

# Copy built output and Prisma files
COPY --from=build /app/apps/api/dist apps/api/dist
COPY --from=build /app/apps/api/prisma apps/api/prisma
COPY --from=build /app/apps/api/prisma.config.ts apps/api/prisma.config.ts
COPY --from=build /app/apps/api/scripts apps/api/scripts

# Re-generate Prisma client in production node_modules
RUN npm -w apps/api run prisma:generate

EXPOSE 8080
ENV PORT=8080
ENV NODE_ENV=production

CMD ["node", "apps/api/dist/index.js"]
