#!/bin/sh
# 編譯並執行天堂地獄模擬器
cd "$(dirname "$0")"
javac -encoding UTF-8 -d out src/*.java && java -cp out Main
