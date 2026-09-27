using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace OpenRestoApi.Migrations
{
    /// <inheritdoc />
    public partial class AddBrandFooterSettings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "CopyrightText",
                table: "BrandSettings",
                type: "TEXT",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "FacebookUrl",
                table: "BrandSettings",
                type: "TEXT",
                maxLength: 255,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "InstagramUrl",
                table: "BrandSettings",
                type: "TEXT",
                maxLength: 255,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TiktokUrl",
                table: "BrandSettings",
                type: "TEXT",
                maxLength: 255,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TwitterUrl",
                table: "BrandSettings",
                type: "TEXT",
                maxLength: 255,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "YoutubeUrl",
                table: "BrandSettings",
                type: "TEXT",
                maxLength: 255,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CopyrightText",
                table: "BrandSettings");

            migrationBuilder.DropColumn(
                name: "FacebookUrl",
                table: "BrandSettings");

            migrationBuilder.DropColumn(
                name: "InstagramUrl",
                table: "BrandSettings");

            migrationBuilder.DropColumn(
                name: "TiktokUrl",
                table: "BrandSettings");

            migrationBuilder.DropColumn(
                name: "TwitterUrl",
                table: "BrandSettings");

            migrationBuilder.DropColumn(
                name: "YoutubeUrl",
                table: "BrandSettings");
        }
    }
}
