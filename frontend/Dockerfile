# frontend/Dockerfile

# --- Stage 1: Builder (Build with Node) ---
FROM node:22-slim AS builder

WORKDIR /app
RUN corepack enable

# Copy dependency files
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build arguments (Vite needs them HERE to "burn" them into HTML/JS)
ARG VITE_API_BASE_URL
ARG VITE_GOOGLE_CLIENT_ID
ARG VITE_GOOGLE_REDIRECT_URI

# Build the app (generates the /app/dist folder)
RUN pnpm run build

# --- Stage 2: Runner (Lightweight Web Server) ---
FROM caddy:alpine

# Copy internal Caddy configuration
COPY Caddyfile /etc/caddy/Caddyfile

# Copy ONLY the compiled files (HTML/CSS/JS) from stage 1
COPY --from=builder /app/dist /usr/share/caddy

# Expose internal port 80
EXPOSE 80