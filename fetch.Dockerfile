FROM ubuntu:18.04

RUN apt update && apt install -y \
    lftp \
    cron \
    vim \
    curl \
 && apt upgrade -y && (curl -sL https://deb.nodesource.com/setup_11.x  | bash -) && apt install -y nodejs && rm -rf /var/lib/apt/lists/*

ADD crontab /etc/cron.d/hello-cron
ADD scripts /var/scripts
ADD fetch.js /var/scripts/fetch.js
ADD package.json /var/scripts/package.json
ADD yarn.lock /var/scripts/yarn.lock

WORKDIR /var/scripts

RUN npx yarn --frozen-lockfile

RUN chmod 0644 /etc/cron.d/hello-cron

RUN touch /var/log/cron.log
RUN touch /var/log/lftp.log

RUN mkdir -p /media

CMD printenv | sed 's/^\(.*\)$/export \1/g' | sed 's/=\(.*\)/="\1"/' > /env.sh && cron && rm -f /config/synctorrent.lock && tail -f /var/log/cron.log
