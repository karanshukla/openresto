using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace OpenRestoApi.Migrations
{
    /// <inheritdoc />
    public partial class AddHomePageCustomization : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Description",
                table: "Restaurants",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Link",
                table: "Highlights",
                type: "TEXT",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "HeaderImageFit",
                table: "BrandSettings",
                type: "TEXT",
                maxLength: 10,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "HighlightsHeading",
                table: "BrandSettings",
                type: "TEXT",
                maxLength: 60,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "HighlightsSubheading",
                table: "BrandSettings",
                type: "TEXT",
                maxLength: 60,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Subtitle",
                table: "BrandSettings",
                type: "TEXT",
                maxLength: 160,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Description",
                table: "Restaurants");

            migrationBuilder.DropColumn(
                name: "Link",
                table: "Highlights");

            migrationBuilder.DropColumn(
                name: "HeaderImageFit",
                table: "BrandSettings");

            migrationBuilder.DropColumn(
                name: "HighlightsHeading",
                table: "BrandSettings");

            migrationBuilder.DropColumn(
                name: "HighlightsSubheading",
                table: "BrandSettings");

            migrationBuilder.DropColumn(
                name: "Subtitle",
                table: "BrandSettings");
        }
    }
}
