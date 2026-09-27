using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace OpenRestoApi.Migrations
{
    /// <inheritdoc />
    public partial class AddWaitlistPush : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "PushAuth",
                table: "WaitlistEntries",
                type: "TEXT",
                maxLength: 512,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PushChannel",
                table: "WaitlistEntries",
                type: "TEXT",
                maxLength: 16,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PushEndpoint",
                table: "WaitlistEntries",
                type: "TEXT",
                maxLength: 2048,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PushP256dh",
                table: "WaitlistEntries",
                type: "TEXT",
                maxLength: 512,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PushAuth",
                table: "WaitlistEntries");

            migrationBuilder.DropColumn(
                name: "PushChannel",
                table: "WaitlistEntries");

            migrationBuilder.DropColumn(
                name: "PushEndpoint",
                table: "WaitlistEntries");

            migrationBuilder.DropColumn(
                name: "PushP256dh",
                table: "WaitlistEntries");
        }
    }
}
