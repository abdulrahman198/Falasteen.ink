#!/bin/zsh
cd "$(dirname "$0")" || exit 1

PORT=8080
while lsof -nP -iTCP:$PORT -sTCP:LISTEN >/dev/null 2>&1; do
  PORT=$((PORT + 1))
done

URL="http://127.0.0.1:$PORT/Feed.html"
echo "Starting FALASTEEN.INK at $URL"
open "$URL"
python3 -m http.server "$PORT" --bind 127.0.0.1
