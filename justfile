#set shell := ["sh", "-c"]

run service +args:
    just {{ service }}-run {{ args }}

build service:
    just {{ service }}-build

clean service:
    just {{ service }}-clean

api-run:
    cd api && \
    dotnet run

cli-run +args:
    cd cli && \
    go run main.go {{ args }}

lib-build:
    cd lib && \
    zig build

lib-clean:
    cd lib && \
    rm -rf zig-out

dashboard-dev:
    cd dashboard && \
    bun run dev
