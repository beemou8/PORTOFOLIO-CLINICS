FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
COPY web/package.json web/package-lock.json ./web/

RUN npm ci

COPY . .

RUN npm run build


FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json ./

RUN npm ci --omit=dev --ignore-scripts

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/web/dist ./web/dist

COPY scripts ./scripts
COPY sql ./sql

RUN mkdir -p /app/uploads

EXPOSE 3000

CMD ["node", "dist/app.js"]