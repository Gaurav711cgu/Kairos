# Multi-stage Go build — final image: ~20MB
FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY *.go ./
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags='-w -s' -o capture-agent .

FROM alpine:3.19
RUN apk add --no-cache ca-certificates tzdata
WORKDIR /app
COPY --from=builder /app/capture-agent .
EXPOSE 8080 2112
ENTRYPOINT ["/app/capture-agent"]
