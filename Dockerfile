ARG WP_VERSION
FROM wordpress:${WP_VERSION}

# Install PHP extensions.
COPY ./local/uploads.ini /usr/local/etc/php/conf.d

# Install WP-CLI.
RUN curl -O https://raw.githubusercontent.com/wp-cli/builds/gh-pages/phar/wp-cli.phar
RUN php wp-cli.phar --info
RUN chmod +x wp-cli.phar
RUN mv wp-cli.phar /usr/local/bin/wp

# Update Repositories. 
RUN apt update

# Install MariaDB client.
RUN apt -y install mariadb-client

# Install Git.
RUN apt -y install git

# Install Xdebug.
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

# Add your custom Xdebug configuration.
COPY local/xdebug.ini /usr/local/etc/php/conf.d/docker-php-ext-xdebug.ini

# Enable Xdebug.
RUN docker-php-ext-enable xdebug

RUN service apache2 restart

# Install Composer.
RUN curl -sS https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer

# Install PHPUnit globally using Composer.
RUN composer global require "phpunit/phpunit=9.*"
# Add Composer's global bin directory to the system PATH.
ENV PATH /root/.composer/vendor/bin:$PATH

# Install Node.js.
RUN curl -sL https://deb.nodesource.com/setup_18.x | bash -
RUN apt -y install nodejs

# Install libraries for Puppeteer.
RUN apt -y install libx11-xcb1 libxcomposite1 libxcursor1 libxdamage1 libxi6 libxtst6 libnss3 libcups2 libxss1 libxrandr2 libasound2 libatk1.0-0 libgtk-3-0 libgbm1 libdrm2

# Check if Chrome is already installed.
RUN if ! command -v google-chrome; then npx puppeteer browsers install chrome; fi

# Install nano.
RUN apt -y install nano

# Install zip.
RUN apt -y install zip

# Install unzip.
RUN apt -y install unzip

# Install wget.
RUN apt -y install wget

#Install dotenv
RUN composer global require vlucas/phpdotenv --dev
