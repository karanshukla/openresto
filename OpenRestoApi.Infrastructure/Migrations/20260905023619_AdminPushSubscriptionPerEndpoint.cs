using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace OpenRestoApi.Migrations
{
    /// <inheritdoc />
    public partial class AdminPushSubscriptionPerEndpoint : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Existing installs hold one row per (endpoint, restaurant) — the settings card
            // registered the browser against every location — so collapsing the scope leaves
            // duplicate endpoints that the new unique index would reject. Keep the oldest row
            // per endpoint; the surviving keys are identical, every row for an endpoint having
            // been written by the same subscribe call.
            migrationBuilder.Sql(
                """
                DELETE FROM AdminPushSubscriptions
                WHERE Id NOT IN (SELECT MIN(Id) FROM AdminPushSubscriptions GROUP BY Endpoint);
                """);

            migrationBuilder.DropForeignKey(
                name: "FK_AdminPushSubscriptions_Restaurants_RestaurantId",
                table: "AdminPushSubscriptions");

            migrationBuilder.DropIndex(
                name: "IX_AdminPushSubscriptions_Endpoint_RestaurantId",
                table: "AdminPushSubscriptions");

            migrationBuilder.DropIndex(
                name: "IX_AdminPushSubscriptions_RestaurantId",
                table: "AdminPushSubscriptions");

            migrationBuilder.DropColumn(
                name: "RestaurantId",
                table: "AdminPushSubscriptions");

            migrationBuilder.CreateIndex(
                name: "IX_AdminPushSubscriptions_Endpoint",
                table: "AdminPushSubscriptions",
                column: "Endpoint",
                unique: true);
        }

        /// <inheritdoc />
        /// <remarks>
        /// Lossy by nature: there is no restaurant to restore a subscription to, and a row
        /// reinstated at <c>RestaurantId = 0</c> would be an orphan under the FK this puts
        /// back. The table is emptied instead, so a downgraded install asks its admins to
        /// re-subscribe rather than carrying rows the fan-out can never match.
        /// </remarks>
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_AdminPushSubscriptions_Endpoint",
                table: "AdminPushSubscriptions");

            migrationBuilder.Sql("DELETE FROM AdminPushSubscriptions;");

            migrationBuilder.AddColumn<int>(
                name: "RestaurantId",
                table: "AdminPushSubscriptions",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateIndex(
                name: "IX_AdminPushSubscriptions_Endpoint_RestaurantId",
                table: "AdminPushSubscriptions",
                columns: new[] { "Endpoint", "RestaurantId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_AdminPushSubscriptions_RestaurantId",
                table: "AdminPushSubscriptions",
                column: "RestaurantId");

            migrationBuilder.AddForeignKey(
                name: "FK_AdminPushSubscriptions_Restaurants_RestaurantId",
                table: "AdminPushSubscriptions",
                column: "RestaurantId",
                principalTable: "Restaurants",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
