set shell := ["sh", "-c"]

# Build everything
all: compile-lib compile-api compile-cli

# Zig Core Lib
compile-lib:
    cd lib && zig build -Doptimize=ReleaseSafe

# .NET API (Native AOT)
compile-api: compile-lib
    cd api && dotnet publish -c Release -r linux-x64

# Go CLI
compile-cli:
    cd cli && go build -o ../bin/vault-cli main.go

# Bun / Elysia Proxy
run-proxy:
    cd proxy && bun run dev

# SolidJS Dashboard
run-dashboard:
    cd dashboard && bun run dev

# Docker Ops
up:
    docker-compose up --build

# Clean
clean:
    rm -rf lib/zig-out lib/zig-cache api/bin api/obj

# Generate code for all languages from shared protos
generate-proto:
    # C# Api
    protoc --csharp_out=api/Generated shared/*.proto
    # Go Cli
    protoc --go_out=cli/generated shared/*.proto
    # Ts Proxy
    protoc --es_out=proxy/src/generated shared/*.proto