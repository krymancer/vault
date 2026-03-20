FROM archlinux:latest AS zigbuild

RUN pacman -Syu --noconfirm zig

WORKDIR /lib
COPY lib/ .
RUN zig build -Doptimize=ReleaseFast

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Stub the lib path so restore doesn't fail on the None include
RUN mkdir -p /lib/zig-out/lib && touch /lib/zig-out/lib/libvault.so

COPY api/Api.csproj ./
RUN dotnet restore

COPY api/ .
COPY --from=zigbuild /lib/zig-out/lib/libvault.so /lib/zig-out/lib/libvault.so

RUN dotnet publish -c Release -o /app

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=build /app .
COPY --from=zigbuild /lib/zig-out/lib/libvault.so .

ENV ASPNETCORE_URLS=http://+:5045
EXPOSE 5045

ENTRYPOINT ["dotnet", "Api.dll"]
