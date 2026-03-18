# Vault

Vault is a custom secret management system inspired by HashiCorp Vault. This project serves as a technical challenge to build a secure, high-performance infrastructure tool using a specialized multi-language architecture.

## Architecture

The system is split into specialized components that communicate via Protobuf and JSON:

`lib/`: Written in Zig. A low-level cryptographic library focused on safe encryption/decryption (using AES-GCM or ChaCha20-Poly1305) designed to be resistant to in-memory attacks.

`api/`: A .NET 8/9 Web API compiled with Native AOT. It handles infrastructure management, identity, and policy enforcement while talking directly to the Zig core.

`proxy/`: Powered by Bun and ElysiaJS. A blazingly fast, lightweight sidecar designed to sit next to applications and serve secrets on demand.

`dashboard/`: A modern management interface built with SolidJS and TanStack for a reactive, high-performance admin experience.

`cli/`: A Go-based command-line interface for developers to interact with the Vault from any terminal.

## Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Core Lib | Zig | Manual memory management and security for cryptographic operations |
| Management API | .NET (AOT) | High-level productivity with instant startup performance |
| Sidecar Proxy | Bun / Elysia | Minimal footprint and ultra-low latency for secret retrieval |
| Dashboard | Solid / TanStack | Granular reactivity and efficient state management |
| CLI | Go | Static binaries and excellent terminal user experience |
| Transport | Protobuf | Rigid typing shared across all services |