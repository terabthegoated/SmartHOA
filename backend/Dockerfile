FROM composer:2 AS dependencies

WORKDIR /app
COPY composer.json composer.lock ./
RUN composer install --no-dev --prefer-dist --no-interaction --optimize-autoloader

FROM php:8.3-apache

# PostgreSQL and Firebase Cloud Messaging require these PHP extensions.
RUN apt-get update \
    && apt-get install -y --no-install-recommends libpq-dev libcurl4-openssl-dev \
    && docker-php-ext-install pdo_pgsql curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /var/www/html
COPY --from=dependencies /app/vendor ./vendor
COPY . ./

RUN mkdir -p uploads/complaints uploads/receipts \
    && chown -R www-data:www-data uploads \
    && chmod +x /var/www/html/docker/start-apache.sh

EXPOSE 10000
CMD ["/var/www/html/docker/start-apache.sh"]
