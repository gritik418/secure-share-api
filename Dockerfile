FROM node:22-alpine

WORKDIR /app

COPY package*.json ./

RUN npm i

COPY . .

RUN npm run build

EXPOSE 8000

CMD ["sh", "-c", "npx prisma db push && node dist/index.js"]