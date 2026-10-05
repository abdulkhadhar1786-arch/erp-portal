FROM node:22-alpine AS frontend-build

WORKDIR /app/frontend

COPY package.json package-lock.json ./
RUN npm ci

COPY angular.json .postcssrc.json tsconfig.app.json tsconfig.json tsconfig.spec.json ./
COPY public ./public
COPY src ./src
RUN npm run build

FROM node:22-alpine AS backend-build

WORKDIR /app/backend

COPY backend/package.json backend/package-lock.json ./
RUN npm ci

COPY backend/tsconfig.json ./
COPY backend/src ./src
RUN npm run build

FROM node:22-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=backend-build /app/backend/dist ./dist
COPY --from=frontend-build /app/frontend/dist/customer-service-portal/browser ./public

EXPOSE 8080

CMD ["npm", "start"]
