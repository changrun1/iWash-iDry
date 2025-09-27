# syntax=docker/dockerfile:1

FROM node:20-alpine AS build
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and build assets
COPY . .
ARG VITE_API_BASE_URL=/api
ARG VITE_LINE_BOT_ID=
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_LINE_BOT_ID=$VITE_LINE_BOT_ID
RUN npm run build

# Production image using Nginx to serve static files
FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

# Provide a health-check endpoint configuration for Docker
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1/health || exit 1

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
