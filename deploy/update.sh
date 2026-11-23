#!/usr/bin/env bash
# Copy thành <repo>/deploy/update.sh; trên server đặt cạnh docker-compose.yml và .env. Chuẩn: ~/.claude/CLAUDE.md.
# Chạy TRÊN SERVER:
#   ./update.sh              kéo image theo IMAGE_TAG trong .env (mặc định latest) rồi khởi động lại
#   ./update.sh sha-abc1234  triển khai / rollback đúng một bản build (chỉ lần chạy này; muốn giữ lâu thì sửa IMAGE_TAG trong .env)
# Dự án nhiều image dùng <SERVICE>_IMAGE_TAG: đặt biến tương ứng trong .env, hoặc chạy `FRONTEND_IMAGE_TAG=sha-abc1234 ./update.sh`.
set -euo pipefail
cd "$(dirname "$0")"

[ -f .env ] || { echo "Chưa có .env (copy từ .env.example rồi điền)." >&2; exit 1; }
[ -z "${1:-}" ] || export IMAGE_TAG="$1"

echo "• kéo image (${IMAGE_TAG:-theo .env, mặc định latest})"
docker compose pull

echo "• khởi động lại và đợi healthy (service chạy một lần như seed/migrate phải thoát mã 0)"
if ! docker compose up -d --remove-orphans --wait --wait-timeout "${WAIT_TIMEOUT:-180}"; then
  echo "Có service không healthy. Log gần nhất:" >&2
  docker compose logs --tail 30 >&2
  echo "Rollback: ./update.sh <tag-cũ>   (xem tag ở GitHub -> Packages)" >&2
  exit 1
fi

docker image prune -f >/dev/null   # xoá layer đã bị thay thế
docker compose ps
echo "Đã triển khai:"
docker compose ps --format '  {{.Service}}  {{.Image}}'
