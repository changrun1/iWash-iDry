# syntax=docker/dockerfile:1

FROM node:20-alpine
WORKDIR /server

ENV NODE_ENV=production

# Install dependencies
COPY package.json package-lock.json ./
RUN apk add --no-cache python3 make g++ \
  && npm ci --omit=dev \
  && apk del make g++

# Copy application source
COPY . .

# Ensure SQLite database directory exists
RUN mkdir -p /server/data

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "app.js"]
