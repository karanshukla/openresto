using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace OpenRestoApi.Migrations
{
    /// <inheritdoc />
    public partial class AddBrandFaviconIcon : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "FaviconIcon",
                table: "BrandSettings",
                type: "TEXT",
                maxLength: 32,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "FaviconIcon",
                table: "BrandSettings");
        }
    }
}
