FROM node:20-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY src ./src
COPY public ./public
COPY data ./data
ENV PORT=8090
EXPOSE 8090
CMD ["npm", "start"]
