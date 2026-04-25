# Use the official .NET SDK image to build the application
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Copy the project file and restore dependencies
COPY ["OpenRestoApi.csproj", "."]
RUN dotnet restore "./OpenRestoApi.csproj"

# Copy the remaining source code
COPY . .
# Remove local db files so they don't get copied into the image
RUN rm -f openresto.db*

WORKDIR "/src/."
RUN dotnet build "OpenRestoApi.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "OpenRestoApi.csproj" -c Release -o /app/publish

# Use the official ASP.NET runtime image for the final application
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app

# Install curl for healthchecks
USER root
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# Copy the published app
COPY --from=publish /app/publish .

# Create data directory and ensure 'app' user owns everything
RUN mkdir -p /data && \
    chown -R app:app /app /data && \
    chmod -R 775 /app /data

# Switch to the non-root 'app' user
USER app

# ASP.NET defaults
ENV ASPNETCORE_URLS=http://+:8080
ENV PORT=8080
EXPOSE 8080

# Standard entry point
ENTRYPOINT ["dotnet", "OpenRestoApi.dll"]
