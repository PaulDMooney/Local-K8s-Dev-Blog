FROM node:15.12.0-alpine3.12

COPY node_modules ./node_modules
COPY index.js .

EXPOSE 3000

CMD ["node", "index.js"]