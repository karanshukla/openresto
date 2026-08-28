using System.Runtime.CompilerServices;

[assembly: InternalsVisibleTo("OpenRestoApi.Tests")]
// Lets the OpenAPI export tool (issue #319 Part 1, tools/OpenApiExport) boot the API in-process
// via WebApplicationFactory<Program>, the same technique OpenRestoApi.Tests already uses — see
// tools/OpenApiExport/Program.cs for why this replaced build-time MSBuild document generation.
[assembly: InternalsVisibleTo("OpenRestoApi.OpenApiExport")]
