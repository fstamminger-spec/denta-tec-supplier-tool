# Build Frontend
FROM node:20 AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Build Backend
FROM node:20 AS backend-build
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm install
COPY backend/ ./
RUN npm run build

# Production Image
FROM node:20-slim
WORKDIR /app
COPY --from=backend-build /app/backend/package*.json ./
RUN npm install --omit=dev
COPY --from=backend-build /app/backend/dist ./dist
COPY --from=frontend-build /app/frontend/dist ./public

# Debug: list files to see where server.js ended up
RUN ls -R /app/dist

ENV PORT=8080
ENV NODE_ENV=production

EXPOSE 8080
CMD ["node", "/app/dist/server.js"]
