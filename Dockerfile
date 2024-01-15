ARG WP_VERSION
FROM wordpress:${WP_VERSION}

# Install PHP extensions
COPY ./local/uploads.ini /usr/local/etc/php/conf.d

# Install WP-CLI
RUN curl -O https://raw.githubusercontent.com/wp-cli/builds/gh-pages/phar/wp-cli.phar
RUN php wp-cli.phar --info
RUN chmod +x wp-cli.phar
RUN mv wp-cli.phar /usr/local/bin/wp

# Update Repositories 
RUN apt update

# Install MariaDB client
RUN apt -y install mariadb-client

# Install Git
RUN apt -y install git

# Install Xdebug
RUN cd /tmp && \
    git clone https://github.com/xdebug/xdebug.git && \
    cd xdebug && \
    git checkout xdebug_3_2 && \
    phpize && \
    ./configure --enable-xdebug && \
    make && \
    make install && \
    cp modules/xdebug.so /usr/local/lib/php/extensions/no-debug-non-zts-20210902 && \
    rm -rf /tmp/xdebug

# Add your custom Xdebug configuration
COPY local/xdebug.ini /usr/local/etc/php/conf.d/docker-php-ext-xdebug.ini

# Enable Xdebug
RUN docker-php-ext-enable xdebug

# Restart Apache
RUN service apache2 restart
