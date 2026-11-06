using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace OpenRestoApi.Migrations
{
    /// <inheritdoc />
    public partial class AddDateExceptionsAndBookingLimits : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "DateExceptionsJson",
                table: "Restaurants",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "MaxBookingDaysAhead",
                table: "Restaurants",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "MaxOnlinePartySize",
                table: "Restaurants",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "MinBookingNoticeMinutes",
                table: "Restaurants",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "MinOnlinePartySize",
                table: "Restaurants",
                type: "INTEGER",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "DateExceptionsJson",
                table: "Restaurants");

            migrationBuilder.DropColumn(
                name: "MaxBookingDaysAhead",
                table: "Restaurants");

            migrationBuilder.DropColumn(
                name: "MaxOnlinePartySize",
                table: "Restaurants");

            migrationBuilder.DropColumn(
                name: "MinBookingNoticeMinutes",
                table: "Restaurants");

            migrationBuilder.DropColumn(
                name: "MinOnlinePartySize",
                table: "Restaurants");
        }
    }
}
