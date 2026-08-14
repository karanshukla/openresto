using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace OpenRestoApi.Migrations
{
    /// <inheritdoc />
    public partial class AddMultiUserAccounts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "CreatedAt",
                table: "AdminCredentials",
                type: "TEXT",
                nullable: false,
                defaultValueSql: "CURRENT_TIMESTAMP");

            migrationBuilder.AddColumn<string>(
                name: "DisplayName",
                table: "AdminCredentials",
                type: "TEXT",
                maxLength: 80,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsActive",
                table: "AdminCredentials",
                type: "INTEGER",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<string>(
                name: "Role",
                table: "AdminCredentials",
                type: "TEXT",
                maxLength: 32,
                nullable: false,
                defaultValue: "Owner");

            // Pre-multi-user builds stored the bootstrap email verbatim from config, so an
            // upgraded instance can hold a mixed-case address. Every write path now lower-cases,
            // and the unique index below is what makes that normalisation load-bearing — so fold
            // any existing row down first. A no-op on a fresh database (no rows yet), which is
            // what keeps the fresh-install and upgrade schemas identical.
            migrationBuilder.Sql("UPDATE AdminCredentials SET Email = lower(trim(Email));");

            migrationBuilder.CreateIndex(
                name: "IX_AdminCredentials_Email",
                table: "AdminCredentials",
                column: "Email",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_AdminCredentials_Email",
                table: "AdminCredentials");

            migrationBuilder.DropColumn(
                name: "CreatedAt",
                table: "AdminCredentials");

            migrationBuilder.DropColumn(
                name: "DisplayName",
                table: "AdminCredentials");

            migrationBuilder.DropColumn(
                name: "IsActive",
                table: "AdminCredentials");

            migrationBuilder.DropColumn(
                name: "Role",
                table: "AdminCredentials");
        }
    }
}
