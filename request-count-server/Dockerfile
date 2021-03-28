FROM node:15.12.0-alpine3.12

WORKDIR /app

COPY node_modules /app/node_modules
COPY index.js /app

RUN mkdir /data

ENV COUNT_FILE_PATH "/data/countfile.txt"

EXPOSE 3000

CMD ["node", "index.js"]