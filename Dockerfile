FROM node:20-slim

RUN apt-get update && apt-get install -y \
    python3 make g++ libopus-dev libsodium-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY tsconfig.json ./
COPY src/ ./src/
RUN npx tsc
RUN npm prune --production

CMD ["node", "dist/index.js"]
