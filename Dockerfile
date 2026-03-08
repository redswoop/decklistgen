FROM oven/bun:1-debian AS builder

WORKDIR /app

# Install Node.js for Vite build
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates \
    && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

# Install JS dependencies
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Copy source for client build
COPY tsconfig.json ./
COPY src/ src/

# Build client (Vite)
RUN npx vite build src/client

# --- Production stage ---
FROM oven/bun:1-debian

WORKDIR /app

# Python + system libs + fonts for pokeproxy (Pillow, freetype-py)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip python3-venv \
    libfreetype6 libfreetype6-dev \
    libjpeg62-turbo libpng16-16 zlib1g \
    fonts-liberation fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

# Install JS deps (production only)
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

# Python venv for pokeproxy
COPY pokeproxy/requirements.txt pokeproxy/requirements.txt
RUN python3 -m venv pokeproxy/.venv \
    && pokeproxy/.venv/bin/pip install --no-cache-dir -r pokeproxy/requirements.txt

# Copy pokeproxy source + fonts
COPY pokeproxy/ pokeproxy/

# Copy built client from builder
COPY --from=builder /app/dist/client dist/client

# Copy server source (runs directly via Bun, not bundled)
COPY tsconfig.json ./
COPY src/ src/

# Copy data files (prompts.json etc.)
COPY data/ data/

# Persistent volumes
VOLUME ["/app/cache", "/app/data"]

ENV PORT=3001
ENV COMFYUI_URL=
EXPOSE 3001

CMD ["bun", "run", "src/server/index.ts"]
