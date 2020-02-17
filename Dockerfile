FROM node:10

WORKDIR /usr/src/app

COPY package.json ./
COPY yarn.lock ./

RUN yarn --frozen-lockfile

COPY . .

EXPOSE 8085
CMD [ "node", "index.js" ]