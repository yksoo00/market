FROM eclipse-temurin:21-jdk AS build
WORKDIR /src
COPY gradlew settings.gradle build.gradle ./
COPY gradle ./gradle
RUN ./gradlew --no-daemon dependencies > /dev/null 2>&1 || true   # 의존성 레이어 캐시 (src 바뀌어도 재다운로드 안 함)
COPY src ./src
RUN ./gradlew --no-daemon bootJar -x test

FROM eclipse-temurin:21-jre
# 비루트 실행. wget 은 compose 헬스체크용
RUN useradd -r -u 1001 app \
    && apt-get update && apt-get install -y --no-install-recommends wget \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /data/uploads && chown app:app /data/uploads   # 업로드 volume 마운트 지점. 이미지에 app 소유로 있어야 새 volume 도 app 소유로 초기화됨
WORKDIR /srv
COPY --from=build /src/build/libs/*.jar app.jar
USER app
EXPOSE 8080
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75", "-jar", "app.jar"]
