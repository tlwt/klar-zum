FROM php:8.2-apache

# Copy website files
COPY . /var/www/html/

# Enable Apache rewrite module
RUN a2enmod rewrite

# Configure Apache for PUT requests
RUN echo "<Directory /var/www/html>" >> /etc/apache2/apache2.conf && \
    echo "    AllowOverride All" >> /etc/apache2/apache2.conf && \
    echo "    Require all granted" >> /etc/apache2/apache2.conf && \
    echo "</Directory>" >> /etc/apache2/apache2.conf

# Create .htaccess for PUT support
RUN echo "RewriteEngine On" > /var/www/html/.htaccess && \
    echo "RewriteCond %{REQUEST_METHOD} PUT" >> /var/www/html/.htaccess && \
    echo "RewriteRule ^app/formulare/(.+\.yaml)$ /app/save-config.php/$1 [L]" >> /var/www/html/.htaccess

# Set permissions
RUN chown -R www-data:www-data /var/www/html && \
    chmod -R 755 /var/www/html

EXPOSE 80