#!/usr/bin/env bash
# A throwaway Postgres for local development, running in Docker.
#
# Nothing is installed system-wide and nothing is left behind: the container
# and its volume are the whole story, and `destroy` removes both.
#
#   ./scripts/local-db.sh start
#   ./scripts/local-db.sh stop
#   ./scripts/local-db.sh destroy
#   ./scripts/local-db.sh psql
set -euo pipefail

NAME="garba-pg"
VOLUME="garba-pg-data"
PORT="${GARBA_DB_PORT:-5433}"
USER_NAME="garba"
DB_NAME="garba_circle"
URL="postgresql://$USER_NAME:garba@127.0.0.1:$PORT/$DB_NAME"

if ! docker info >/dev/null 2>&1; then
  echo "Docker isn't running. Start Docker Desktop, then try again." >&2
  exit 1
fi

case "${1:-start}" in
  start)
    if docker ps --format '{{.Names}}' | grep -qx "$NAME"; then
      echo "Already running."
    elif docker ps -a --format '{{.Names}}' | grep -qx "$NAME"; then
      docker start "$NAME" >/dev/null
      echo "Restarted existing container."
    else
      docker run -d --name "$NAME" \
        -p "$PORT:5432" \
        -e POSTGRES_USER="$USER_NAME" \
        -e POSTGRES_PASSWORD=garba \
        -e POSTGRES_DB="$DB_NAME" \
        -v "$VOLUME:/var/lib/postgresql/data" \
        postgres:17-alpine >/dev/null
      echo "Created container."
    fi

    printf 'Waiting for Postgres'
    for _ in $(seq 1 30); do
      if docker exec "$NAME" pg_isready -U "$USER_NAME" -d "$DB_NAME" >/dev/null 2>&1; then
        echo " ready."
        echo
        echo "DATABASE_URL=\"$URL\""
        exit 0
      fi
      printf '.'
      sleep 1
    done
    echo
    echo "Postgres did not become ready. Check: docker logs $NAME" >&2
    exit 1
    ;;
  stop)
    docker stop "$NAME" >/dev/null 2>&1 && echo "Stopped." || echo "Not running."
    ;;
  destroy)
    docker rm -f "$NAME" >/dev/null 2>&1 || true
    docker volume rm "$VOLUME" >/dev/null 2>&1 || true
    echo "Container and volume removed."
    ;;
  psql)
    docker exec -it "$NAME" psql -U "$USER_NAME" -d "$DB_NAME"
    ;;
  *)
    echo "usage: $0 {start|stop|destroy|psql}" >&2
    exit 1
    ;;
esac
