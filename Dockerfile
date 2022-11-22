ARG WP_VERSION
FROM wordpress:${WP_VERSION}
COPY ./local/uploads.ini /usr/local/etc/php/conf.d
RUN curl -O https://raw.githubusercontent.com/wp-cli/builds/gh-pages/phar/wp-cli.phar
RUN php wp-cli.phar --info
RUN chmod +x wp-cli.phar
RUN mv wp-cli.phar /usr/local/bin/wp