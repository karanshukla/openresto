# Build stage
FROM node:20-alpine AS build
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
FROM node:20-alpine
RUN apk add --no-cache curl && npm install -g serve
WORKDIR /app
COPY --from=build /app/dist ./dist
RUN chown -R node:node /app

USER node
CMD ["sh", "-c", "serve -s dist -l tcp://0.0.0.0:${PORT:-8081}"]
