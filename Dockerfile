
FROM php:8.2-apache

# Install dependencies for MIDI and Node.js
RUN apt-get update && apt-get install -y \
    libasound2-dev \
    build-essential \
    python3 \
    nodejs \
    npm \
    && rm -rf /var/lib/apt/lists/*

# Set up Apache
RUN a2enmod rewrite headers
# Change document root to /var/www/html/public
ENV APACHE_DOCUMENT_ROOT /var/www/html/public
RUN sed -ri -e 's!/var/www/html!${APACHE_DOCUMENT_ROOT}!g' /etc/apache2/sites-available/*.conf
RUN sed -ri -e 's!/var/www/!${APACHE_DOCUMENT_ROOT}!g' /etc/apache2/apache2.conf /etc/apache2/conf-available/*.conf

WORKDIR /var/www/html

# Copy package files and install
COPY package*.json ./
RUN npm install

# Copy the rest
COPY . .

# Expose port
EXPOSE 80

# Start Apache
CMD ["apache2-foreground"]
