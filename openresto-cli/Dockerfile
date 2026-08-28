# openresto-cli ships only as a Docker image (no npm publish) — see CLAUDE.md's
# "The CLI and its OpenAPI contract". Multi-stage so the published image carries
# only the compiled dist/ and production dependencies (just `commander`), not
# TypeScript/openapi-typescript or the generated OpenAPI contract's build tooling.

FROM node:24-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
RUN chown -R node:node /app

USER node
ENTRYPOINT ["node", "dist/index.js"]
