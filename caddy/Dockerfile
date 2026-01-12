# caddy/Dockerfile

# Etapa 1: Builder
FROM caddy:builder AS builder

RUN xcaddy build \
    --with github.com/mholt/caddy-ratelimit

# Etapa 2: Imagen Final
# Usamos la misma base 'caddy:alpine' para mantener compatibilidad
FROM caddy:alpine

# Copiamos el binario compilado
COPY --from=builder /usr/bin/caddy /usr/bin/caddy

# --- AGREGA ESTO POR SEGURIDAD ---
# Aseguramos que el binario sea ejecutable
# A veces al copiar pierde permisos
RUN chmod +x /usr/bin/caddy