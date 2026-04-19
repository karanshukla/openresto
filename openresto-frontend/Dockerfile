# Build stage
FROM node:20-alpine AS build
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci --legacy-peer-deps

# Copy source and build the web export
COPY . .
RUN npx expo export --platform web

# Production stage — serve static files
FROM node:20-alpine
RUN npm install -g serve
WORKDIR /app
COPY --from=build /app/dist ./dist
RUN chown -R node:node /app

USER node
CMD ["sh", "-c", "serve -s dist -l tcp://0.0.0.0:${PORT:-8081}"]
