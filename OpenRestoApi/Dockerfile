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
ENTRYPOINT ["dotnet", "OpenRestoApi.dll"]
