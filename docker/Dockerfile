FROM php:8.2-fpm-alpine

# Install nginx
RUN apk add --no-cache nginx

# Create nginx directories
RUN mkdir -p /var/lib/nginx/tmp /var/log/nginx /run/nginx

# Copy nginx configuration
COPY docker/nginx.conf /etc/nginx/nginx.conf

# Create web directory (files will be mounted via volume)
RUN mkdir -p /var/www/html

# Set permissions for volume mount
RUN chown -R nginx:nginx /var/www/html && \
    chmod -R 755 /var/www/html

# Create startup script
RUN echo '#!/bin/sh' > /start.sh && \
    echo 'php-fpm -D' >> /start.sh && \
    echo 'nginx -g "daemon off;"' >> /start.sh && \
    chmod +x /start.sh

EXPOSE 80

CMD ["/start.sh"]