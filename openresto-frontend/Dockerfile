# Build stage — always runs on the native host platform so Metro bundling
# doesn't run under QEMU emulation (which hangs on arm64 cross-builds).
# The expo export output is pure HTML/JS/CSS and is platform-independent.
FROM --platform=$BUILDPLATFORM node:24-alpine AS build
WORKDIR /app

# Accept build arguments
ARG EXPO_PUBLIC_API_URL
ENV EXPO_PUBLIC_API_URL=$EXPO_PUBLIC_API_URL

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci --legacy-peer-deps

# Copy source and build the web export
COPY . .
RUN npx expo export --platform web

# Production stage — serve static files
FROM node:24-alpine
RUN apk add --no-cache curl && npm install -g serve
WORKDIR /app
COPY --from=build /app/dist ./dist
RUN chown -R node:node /app

USER node
CMD ["sh", "-c", "serve -s dist -l tcp://0.0.0.0:${PORT:-8081}"]
