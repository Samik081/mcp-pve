FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && \
    addgroup -g 1001 -S mcp && adduser -u 1001 -S mcp -G mcp
COPY --from=builder /app/dist ./dist
USER mcp
ENV MCP_PORT=3000
ENV MCP_HOST=0.0.0.0
EXPOSE 3000
ENTRYPOINT ["node", "dist/index.js"]
