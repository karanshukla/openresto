using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace OpenRestoApi.Migrations
{
    /// <inheritdoc />
    public partial class AddNativeAppSettings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "MinimumAppVersion",
                table: "BrandSettings",
                type: "TEXT",
                maxLength: 32,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PrivacyPolicyUrl",
                table: "BrandSettings",
                type: "TEXT",
                maxLength: 2048,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "NativeClientStats",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    Platform = table.Column<string>(type: "TEXT", maxLength: 16, nullable: false),
                    AppVersion = table.Column<string>(type: "TEXT", maxLength: 32, nullable: false),
                    Day = table.Column<DateOnly>(type: "TEXT", nullable: false),
                    RequestCount = table.Column<int>(type: "INTEGER", nullable: false),
                    LastSeenUtc = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_NativeClientStats", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_NativeClientStats_Platform_AppVersion_Day",
                table: "NativeClientStats",
                columns: new[] { "Platform", "AppVersion", "Day" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "NativeClientStats");

            migrationBuilder.DropColumn(
                name: "MinimumAppVersion",
                table: "BrandSettings");

            migrationBuilder.DropColumn(
                name: "PrivacyPolicyUrl",
                table: "BrandSettings");
        }
    }
}
