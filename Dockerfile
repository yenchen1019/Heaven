# 給 Render 等雲端平台用：編譯並啟動網頁版
FROM eclipse-temurin:21-jdk
WORKDIR /app
COPY src ./src
COPY web ./web
COPY data ./data
RUN javac -encoding UTF-8 -d out src/*.java
ENV PORT=8080
EXPOSE 8080
CMD ["java", "-Dfile.encoding=UTF-8", "-cp", "out", "WebServer"]
