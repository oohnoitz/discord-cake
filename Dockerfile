FROM node:alpine

RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

ADD https://github.com/ufoscout/docker-compose-wait/releases/download/2.5.0/wait /wait
RUN chmod +x /wait

ADD . /usr/src/app
RUN npm install

CMD /wait && node bot.js
