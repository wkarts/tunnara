FROM composer:2 AS vendor
WORKDIR /app
COPY composer.json ./
RUN composer install \
    --no-dev \
    --prefer-dist \
    --no-interaction \
    --no-progress \
    --no-scripts
COPY . .
RUN composer dump-autoload --optimize --no-dev

FROM php:8.4-fpm-alpine
RUN apk add --no-cache \
        $PHPIZE_DEPS \
        icu-dev \
        libpq-dev \
        libxml2-dev \
        sqlite-dev \
        nginx \
        oniguruma-dev \
        supervisor \
    && docker-php-ext-install -j"$(nproc)" \
        intl \
        mbstring \
        opcache \
        pcntl \
        pdo_mysql \
        pdo_pgsql \
        pdo_sqlite \
        xml \
    && pecl install redis \
    && docker-php-ext-enable redis \
    && apk del $PHPIZE_DEPS \
    && rm -rf /tmp/* /var/cache/apk/*

WORKDIR /app
COPY --from=vendor /app /app
COPY deploy/nginx.conf /etc/nginx/http.d/default.conf
COPY deploy/supervisord.conf /etc/supervisord.conf
COPY deploy/entrypoint.sh /usr/local/bin/tunnara-entrypoint

EXPOSE 8080
ENTRYPOINT ["/usr/local/bin/tunnara-entrypoint"]
