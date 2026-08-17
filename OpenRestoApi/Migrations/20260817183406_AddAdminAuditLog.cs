using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace OpenRestoApi.Migrations
{
    /// <inheritdoc />
    public partial class AddAdminAuditLog : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "AdminAuditEntries",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    OccurredAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    ActorUserId = table.Column<int>(type: "INTEGER", nullable: true),
                    ActorEmail = table.Column<string>(type: "TEXT", maxLength: 320, nullable: false),
                    ActorDisplayName = table.Column<string>(type: "TEXT", maxLength: 100, nullable: true),
                    ActorRole = table.Column<string>(type: "TEXT", maxLength: 32, nullable: false),
                    Action = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    TargetType = table.Column<string>(type: "TEXT", maxLength: 32, nullable: true),
                    TargetId = table.Column<string>(type: "TEXT", maxLength: 64, nullable: true),
                    TargetLabel = table.Column<string>(type: "TEXT", maxLength: 128, nullable: true),
                    RestaurantId = table.Column<int>(type: "INTEGER", nullable: true),
                    Summary = table.Column<string>(type: "TEXT", maxLength: 256, nullable: true),
                    ChangesJson = table.Column<string>(type: "TEXT", maxLength: 4000, nullable: true),
                    HttpMethod = table.Column<string>(type: "TEXT", maxLength: 10, nullable: false),
                    Path = table.Column<string>(type: "TEXT", maxLength: 512, nullable: false),
                    StatusCode = table.Column<int>(type: "INTEGER", nullable: false),
                    IpAddress = table.Column<string>(type: "TEXT", maxLength: 64, nullable: true),
                    UserAgent = table.Column<string>(type: "TEXT", maxLength: 256, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AdminAuditEntries", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AdminAuditEntries_AdminCredentials_ActorUserId",
                        column: x => x.ActorUserId,
                        principalTable: "AdminCredentials",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AdminAuditEntries_Action",
                table: "AdminAuditEntries",
                column: "Action");

            migrationBuilder.CreateIndex(
                name: "IX_AdminAuditEntries_ActorUserId_OccurredAt",
                table: "AdminAuditEntries",
                columns: new[] { "ActorUserId", "OccurredAt" });

            migrationBuilder.CreateIndex(
                name: "IX_AdminAuditEntries_OccurredAt",
                table: "AdminAuditEntries",
                column: "OccurredAt");

            migrationBuilder.CreateIndex(
                name: "IX_AdminAuditEntries_RestaurantId_OccurredAt",
                table: "AdminAuditEntries",
                columns: new[] { "RestaurantId", "OccurredAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AdminAuditEntries");
        }
    }
}
