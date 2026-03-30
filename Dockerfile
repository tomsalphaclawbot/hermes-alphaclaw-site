FROM node:20-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY src ./src
COPY public ./public
COPY data ./data
RUN mkdir -p ./open-config
COPY docker-compose.yml ./open-config/docker-compose.yml
COPY cloudflared-config.yml ./open-config/cloudflared-config.yml
COPY Dockerfile ./open-config/Dockerfile
ENV PORT=8090
EXPOSE 8090
CMD ["npm", "start"]
