FROM gradle:8.7-jdk21-alpine AS builder
WORKDIR /workspace
COPY build.gradle settings.gradle* ./
COPY src src
RUN gradle bootJar --no-daemon -x test

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
RUN apk add --no-cache postgresql-client
COPY --from=builder /workspace/build/libs/*.jar app.jar
EXPOSE 8090
ENTRYPOINT ["java", "-XX:+UseZGC", "-XX:MaxRAMPercentage=75.0", "-jar", "app.jar"]
