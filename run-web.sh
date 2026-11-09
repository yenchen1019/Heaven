#!/bin/sh
# 編譯並啟動網頁版，然後打開 http://localhost:8080
cd "$(dirname "$0")"
javac -encoding UTF-8 -d out src/*.java && java -cp out WebServer "$@"
