FROM golang:1.26-alpine AS build

WORKDIR /src
COPY cli/go.mod cli/go.sum ./
RUN go mod download

COPY cli/ .
RUN CGO_ENABLED=0 go build -o /vault-cli main.go

FROM alpine:latest
COPY --from=build /vault-cli /usr/local/bin/vault-cli

ENTRYPOINT ["vault-cli"]
