# Multi-stage image (ARQ-01-API §7): the final image has only the compiled code and the production
# dependencies. Base image with a fixed tag, no secrets inside (SEC-WEB-04); configuration arrives through
# environment variables.

# ---- build: all dependencies, Prisma Client and the compiled code ----------------------------------
FROM node:26.13.1-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY prisma ./prisma
COPY prisma.config.ts tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src
RUN npx prisma generate && npm run build

# ---- production dependencies only (the Prisma CLI is one: `migrate deploy` runs at startup) --------
FROM node:26.13.1-alpine AS dependencies
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ---- runtime ---------------------------------------------------------------------------------------
FROM node:26.13.1-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json prisma.config.ts ./
COPY prisma ./prisma

# The process does not run as root.
USER node
EXPOSE 3000

# Apply the migrations, then start the API. `exec` makes Node PID 1 so it receives SIGTERM (shutdown hooks).
CMD ["sh", "-c", "npx --no-install prisma migrate deploy && exec node dist/main.js"]
