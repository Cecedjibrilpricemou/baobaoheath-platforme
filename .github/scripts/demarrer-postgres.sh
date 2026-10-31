#!/usr/bin/env bash
# Demarre le Postgres de test de la CI, en tolerant un registre indisponible.
#
# Pourquoi pas un conteneur de service (`services:`) : GitHub ne retente pas
# leur telechargement. Le 2026-10-29 puis le 2026-10-30, « Docker pull failed »
# a l'etape « Initialize containers » a fait echouer des PR dont le code etait
# vert. Ici chaque registre est essaye plusieurs fois, puis le suivant :
#   1. le miroir public d'AWS (sans quota par IP) ;
#   2. le miroir Docker Hub de Google (mirror.gcr.io) ;
#   3. Docker Hub lui-meme (quota anonyme partage par les coureurs).
# Meme image officielle, meme version, dans les trois cas.
#
# Usage : demarrer-postgres.sh <base> <port-hote>
set -euo pipefail

BASE="${1:?nom de la base attendu}"
PORT="${2:?port hote attendu}"
VERSION="16-alpine"
SOURCES=(
  "public.ecr.aws/docker/library/postgres:${VERSION}"
  "mirror.gcr.io/library/postgres:${VERSION}"
  "docker.io/library/postgres:${VERSION}"
)

IMAGE=""
for source in "${SOURCES[@]}"; do
  for essai in 1 2 3; do
    echo "Telechargement de ${source} (essai ${essai}/3)"
    if docker pull --quiet "${source}"; then IMAGE="${source}"; break 2; fi
    sleep $((essai * 5))
  done
done
if [ -z "${IMAGE}" ]; then
  echo "::error::Aucun registre n'a fourni postgres:${VERSION}"
  exit 1
fi

docker run -d --name "pg-${BASE}" \
  -e POSTGRES_USER=baobaoheath \
  -e POSTGRES_PASSWORD=baobaoheath \
  -e POSTGRES_DB="${BASE}" \
  -p "${PORT}:5432" \
  "${IMAGE}" >/dev/null

for _ in $(seq 1 30); do
  if docker exec "pg-${BASE}" pg_isready -U baobaoheath -d "${BASE}" >/dev/null 2>&1; then
    echo "Postgres pret sur le port ${PORT} (${IMAGE})"
    exit 0
  fi
  sleep 2
done
echo "::error::Postgres n'a pas repondu en 60 s"
docker logs "pg-${BASE}" || true
exit 1
