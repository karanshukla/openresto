using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace OpenRestoApi.Migrations
{
    /// <inheritdoc />
    public partial class AddSectionSortOrder : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "SortOrder",
                table: "Sections",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0);

            // Backfill: existing sections get a sequential SortOrder per restaurant, ordered
            // by creation order (Id), so upgrades don't scramble the section order admins
            // already rely on. New installs have no pre-existing rows, so this is a no-op there.
            migrationBuilder.Sql(
                @"UPDATE Sections
                  SET SortOrder = (
                      SELECT COUNT(*)
                      FROM Sections AS earlier
                      WHERE earlier.RestaurantId = Sections.RestaurantId
                        AND earlier.Id < Sections.Id
                  );");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "SortOrder",
                table: "Sections");
        }
    }
}
