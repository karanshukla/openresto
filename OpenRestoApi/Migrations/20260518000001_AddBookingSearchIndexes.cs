using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace OpenRestoApi.Migrations
{
    /// <inheritdoc />
    public partial class AddBookingSearchIndexes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "IX_Bookings_CustomerEmail",
                table: "Bookings",
                column: "CustomerEmail");

            migrationBuilder.CreateIndex(
                name: "IX_Bookings_BookingRef",
                table: "Bookings",
                column: "BookingRef");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Bookings_CustomerEmail",
                table: "Bookings");

            migrationBuilder.DropIndex(
                name: "IX_Bookings_BookingRef",
                table: "Bookings");
        }
    }
}
