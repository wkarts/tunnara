FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG VITE_TUNNARA_API_URL=/control
ENV VITE_TUNNARA_API_URL=$VITE_TUNNARA_API_URL
RUN npm run build:web
FROM nginx:1.27-alpine
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
