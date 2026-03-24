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

EXPOSE 8081
CMD ["serve", "-s", "dist", "-l", "8081"]
