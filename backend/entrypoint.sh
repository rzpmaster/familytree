#!/bin/sh
set -e

DATA_DIR="/app/app/data"
SEED_DIR="/app/app/data.seed"

# 如果挂载目录为空（或不存在），复制 seed 内容进去
if [ -d "$DATA_DIR" ] && [ -z "$(ls -A "$DATA_DIR" 2>/dev/null)" ]; then
  echo "[init] $DATA_DIR is empty, seeding from $SEED_DIR ..."
  cp -a "$SEED_DIR"/. "$DATA_DIR"/
fi

exec "$@"