# The Tavero MCP server on stdio, for MCP directories that run servers in a container (Glama and others).
# Scanning needs a running app and Chromium on the user's machine; in a container the server starts and
# lists its tools, and scans run against an app reachable from the container.
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY tsconfig.json ./
COPY bin ./bin
COPY src ./src
COPY scripts ./scripts
COPY design ./design
RUN npm run build

FROM node:22-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY --from=build /app/bin ./bin
COPY --from=build /app/dist ./dist
ENTRYPOINT ["node", "bin/tavero.js", "mcp"]
