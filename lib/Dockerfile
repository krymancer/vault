FROM archlinux:latest AS build

RUN pacman -Syu --noconfirm zig

WORKDIR /src
COPY . .
RUN zig build -Doptimize=ReleaseFast

FROM scratch
COPY --from=build /src/zig-out/lib/libvault.so /libvault.so
