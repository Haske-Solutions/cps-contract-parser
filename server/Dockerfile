FROM node:22-bookworm-slim

WORKDIR /app

# Root package provides shared AWS SDK deps used by server imports
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev --ignore-scripts 2>/dev/null || npm install --omit=dev --ignore-scripts

COPY src ./src
COPY server ./server

WORKDIR /app/server
RUN npm install --omit=dev

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["npx", "tsx", "src/index.ts"]
