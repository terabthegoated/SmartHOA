#!/bin/sh
set -eu

# Render supplies PORT. Apache's base image listens on port 80 by default.
PORT_TO_USE="${PORT:-10000}"
sed -ri "s/Listen 80/Listen ${PORT_TO_USE}/" /etc/apache2/ports.conf
sed -ri "s/<VirtualHost \*:80>/<VirtualHost *:${PORT_TO_USE}>/" /etc/apache2/sites-available/000-default.conf

exec apache2-foreground
