# Contributing to Kairos

We welcome contributions to the Kairos project. Please follow these guidelines to ensure a smooth collaboration process.

## Prerequisites

Ensure you have the following installed before building the project:
- Java 21
- Go 1.22
- Python 3.11
- Node.js 20
- Docker and Docker Compose

## Building Components

### Orchestrator (Java)
```sh
cd orchestrator
./gradlew build
```

### Capture Agent (Go)
```sh
cd capture-agent
go build -o agent main.go
```

### Anomaly Detector & LLM Analyzer (Python)
```sh
cd python-services
pip install -r requirements.txt
```

### Dashboard (Node.js)
```sh
cd dashboard
npm install
npm run build
```

## Running Tests

- **Java**: `./gradlew test`
- **Go**: `go test ./...`
- **Python**: `pytest`
- **Node.js**: `npm test`

## Code Style Guidelines

- **Java**: Follow Google Java Style Guide.
- **Go**: Use `gofmt` and `golint`.
- **Python**: Use `black` for formatting and `flake8` for linting.
- **Node.js**: Use `prettier` and `eslint`.

## Pull Request Process

1. Fork the repository and create a new branch for your feature or bug fix.
2. Write tests for your changes.
3. Ensure all tests pass.
4. Submit a Pull Request with a clear description of the changes and the problem they solve.
5. Wait for at least one review before merging.
