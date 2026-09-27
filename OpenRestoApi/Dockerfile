# Build stage — always runs on the native host platform so dotnet publish
# doesn't run under QEMU emulation. The output is architecture-independent
# IL; the aspnet runtime JIT-compiles it for the target CPU at startup.
FROM --platform=$BUILDPLATFORM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Copy the project files and restore dependencies
COPY ["OpenRestoApi/OpenRestoApi.csproj", "OpenRestoApi/"]
COPY ["OpenRestoApi.Core/OpenRestoApi.Core.csproj", "OpenRestoApi.Core/"]
COPY ["OpenRestoApi.Infrastructure/OpenRestoApi.Infrastructure.csproj", "OpenRestoApi.Infrastructure/"]
RUN dotnet restore "OpenRestoApi/OpenRestoApi.csproj"

# Copy the remaining source code
COPY . .
# Remove local db files so they don't get copied into the image
RUN rm -f OpenRestoApi/openresto.db*

WORKDIR "/src/OpenRestoApi"
RUN dotnet build "OpenRestoApi.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "OpenRestoApi.csproj" -c Release -o /app/publish

# Use the official ASP.NET runtime image for the final application
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app

# Install curl for healthchecks
USER root
RUN apt-get update && apt-get install -y curl sqlite3 && rm -rf /var/lib/apt/lists/*

# Copy the published app
COPY --from=publish /app/publish .

# Copy and prepare entrypoint (runs as root, fixes volume permissions, drops to app)
COPY OpenRestoApi/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Pre-create volume mount points with correct ownership so fresh volumes
# inherit the right permissions on first initialisation.
RUN mkdir -p /data /app/wwwroot/media && \
    chown -R app:app /app /data && \
    chmod -R 775 /app /data

# ASP.NET defaults
ENV ASPNETCORE_URLS=http://+:8080
ENV PORT=8080
EXPOSE 8080

# Entrypoint runs as root, fixes /data + /app/wwwroot/media ownership, then
# drops to the non-root 'app' user before starting the application.
ENTRYPOINT ["/entrypoint.sh", "dotnet", "OpenRestoApi.dll"]
