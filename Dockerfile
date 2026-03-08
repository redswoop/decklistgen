# ── Stage 1: Clone + Build ───────────────────────────────────
FROM oven/bun:1-debian AS builder

# Install git + Node.js (needed for Vite build)
RUN apt-get update && apt-get install -y --no-install-recommends \
    git ca-certificates curl \
    && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ARG CACHEBUST=0
ARG GIT_REF=main
# Reference CACHEBUST so BuildKit actually invalidates the cache
RUN echo "bust=${CACHEBUST}" \
    && git clone --depth 1 --branch ${GIT_REF} --single-branch \
       https://github.com/redswoop/decklistgen.git . \
    && bun install --frozen-lockfile \
    && npx vite build src/client

# ── Stage 2: Production ─────────────────────────────────────
FROM oven/bun:1-debian

WORKDIR /app

# Install fonts for SVG text measurement (opentype.js needs a system font)
RUN apt-get update && apt-get install -y --no-install-recommends \
    fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

# Install JS deps (production only)
COPY --from=builder /app/package.json /app/bun.lock ./
RUN bun install --frozen-lockfile --production

# Copy built client from builder
COPY --from=builder /app/dist/client dist/client

# Copy server source (runs directly via Bun, not bundled)
COPY --from=builder /app/tsconfig.json ./
COPY --from=builder /app/src/ src/

# Copy data files (prompts.json etc.)
COPY --from=builder /app/data/ data/

# Persistent volumes
VOLUME ["/app/cache", "/app/data"]

ENV PORT=3001
ENV COMFYUI_URL=
EXPOSE 3001

CMD ["bun", "run", "src/server/index.ts"]
