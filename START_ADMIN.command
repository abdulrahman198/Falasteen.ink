#!/bin/zsh
cd "$(dirname "$0")" || exit 1

PORT=8080
while lsof -nP -iTCP:$PORT -sTCP:LISTEN >/dev/null 2>&1; do
  PORT=$((PORT + 1))
done

URL="http://localhost:$PORT/Admin.html?v=admin"
echo "Starting FALASTEEN admin at $URL"
open "$URL"
python3 -m http.server "$PORT" --bind localhost
