#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../../dev/runtime"
if [ ! -x usr/bin/redis-server ]; then
  for archive in ./*.deb; do
    dpkg-deb -x "$archive" .
  done
fi
export LD_LIBRARY_PATH="$PWD/usr/lib/x86_64-linux-gnu${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
exec ./usr/bin/redis-server --bind 127.0.0.1 --port 16379 --save '' --appendonly no --protected-mode yes
