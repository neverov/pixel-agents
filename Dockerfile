FROM oven/bun:1
WORKDIR /app

COPY package.json ./
COPY server/package.json server/bun.lock server/
COPY ui/package.json ui/package-lock.json ui/

RUN bun install && cd server && bun install && cd ../ui && bun install

COPY . .
RUN cd ui && bun run build

EXPOSE 3000

CMD ["bun", "server/index.ts"]
