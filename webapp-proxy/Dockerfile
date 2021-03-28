FROM 'nginx:1.17.4'

COPY ./default.conf.template /tmp/default.conf.template

CMD  /bin/bash -c "envsubst < /tmp/default.conf.template > /etc/nginx/conf.d/default.conf && exec nginx -g 'daemon off;'"