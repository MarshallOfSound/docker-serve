#!/bin/bash
source /env.sh

set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

if [ -e /config/synctorrent.lock ]
then
  echo "Sync is running already."
  exit 1
else
  touch /config/synctorrent.lock

  trap "rm -f /config/synctorrent.lock" EXIT

  echo "Triggering Filebot: $(date)"

  curl $FILEBOT_URL -u $SERVE_USER:$SERVE_PASSWORD

  echo "Sync Starting: $(date)"

  node $DIR/fetch.js

  echo "Sync Done: $(date)"

  rm -f /config/synctorrent.lock
  exit 0
fi