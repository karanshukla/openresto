# Use the official .NET SDK image to build the application
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Copy the project file and restore dependencies
COPY ["OpenRestoApi.csproj", "."]
RUN dotnet restore "./OpenRestoApi.csproj"

# Copy the remaining source code
COPY . .
WORKDIR "/src/."
RUN dotnet build "OpenRestoApi.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "OpenRestoApi.csproj" -c Release -o /app/publish

# Use the official ASP.NET runtime image for the final application
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
COPY --from=publish /app/publish .

# Ensure the app user owns the files and directory to allow SQLite to create/write the DB
USER root
RUN mkdir -p /data && chown -R app:app /app /data
USER app

ENTRYPOINT ["dotnet", "OpenRestoApi.dll"]
