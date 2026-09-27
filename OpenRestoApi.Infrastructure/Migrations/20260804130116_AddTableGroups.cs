using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace OpenRestoApi.Migrations
{
    /// <inheritdoc />
    public partial class AddTableGroups : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "TableGroupId",
                table: "Bookings",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "TableGroups",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    Name = table.Column<string>(type: "TEXT", nullable: true),
                    RestaurantId = table.Column<int>(type: "INTEGER", nullable: false),
                    CombinedSeats = table.Column<int>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TableGroups", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TableGroups_Restaurants_RestaurantId",
                        column: x => x.RestaurantId,
                        principalTable: "Restaurants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "TableGroupMemberships",
                columns: table => new
                {
                    TableGroupId = table.Column<int>(type: "INTEGER", nullable: false),
                    TableId = table.Column<int>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TableGroupMemberships", x => new { x.TableGroupId, x.TableId });
                    table.ForeignKey(
                        name: "FK_TableGroupMemberships_TableGroups_TableGroupId",
                        column: x => x.TableGroupId,
                        principalTable: "TableGroups",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_TableGroupMemberships_Tables_TableId",
                        column: x => x.TableId,
                        principalTable: "Tables",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Bookings_TableGroupId",
                table: "Bookings",
                column: "TableGroupId");

            migrationBuilder.CreateIndex(
                name: "IX_TableGroupMemberships_TableId",
                table: "TableGroupMemberships",
                column: "TableId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_TableGroups_RestaurantId",
                table: "TableGroups",
                column: "RestaurantId");

            migrationBuilder.AddForeignKey(
                name: "FK_Bookings_TableGroups_TableGroupId",
                table: "Bookings",
                column: "TableGroupId",
                principalTable: "TableGroups",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Bookings_TableGroups_TableGroupId",
                table: "Bookings");

            migrationBuilder.DropTable(
                name: "TableGroupMemberships");

            migrationBuilder.DropTable(
                name: "TableGroups");

            migrationBuilder.DropIndex(
                name: "IX_Bookings_TableGroupId",
                table: "Bookings");

            migrationBuilder.DropColumn(
                name: "TableGroupId",
                table: "Bookings");
        }
    }
}
