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
            // SQLite refuses `ALTER TABLE ADD COLUMN` with a non-constant default
            // (CURRENT_TIMESTAMP counts as non-constant) the moment the table already has rows —
            // "Cannot add a column with non-constant default". A brand-new install's
            // AdminCredentials is empty at this point, so that path is silent; every real
            // instance already has the bootstrap Owner row, so it isn't. Add the column nullable
            // (a constant NULL default, always legal) and backfill instead of setting the default
            // inline, then rebuild the table below to lock in NOT NULL DEFAULT CURRENT_TIMESTAMP —
            // SQLite has no ALTER COLUMN, so that's the only way to reach the same end state the
            // model snapshot expects.
            migrationBuilder.AddColumn<DateTime>(
                name: "CreatedAt",
                table: "AdminCredentials",
                type: "TEXT",
                nullable: true);

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

            migrationBuilder.Sql(
                "UPDATE AdminCredentials SET CreatedAt = CURRENT_TIMESTAMP WHERE CreatedAt IS NULL;"
            );

            // The rebuild runs on both paths, which is what keeps them converging: a fresh
            // install and an upgrade end on the same table definition, column order included.
            migrationBuilder.Sql(
                """
                CREATE TABLE "AdminCredentials_temp" (
                    "Id" INTEGER NOT NULL CONSTRAINT "PK_AdminCredentials" PRIMARY KEY AUTOINCREMENT,
                    "Email" TEXT NOT NULL,
                    "PasswordHash" TEXT NOT NULL,
                    "PasswordSalt" TEXT NOT NULL,
                    "PvqQuestion" TEXT NULL,
                    "PvqAnswerHash" TEXT NULL,
                    "PvqAnswerSalt" TEXT NULL,
                    "ResetToken" TEXT NULL,
                    "ResetTokenExpiry" TEXT NULL,
                    "CreatedAt" TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
                    "DisplayName" TEXT NULL,
                    "IsActive" INTEGER NOT NULL DEFAULT 1,
                    "Role" TEXT NOT NULL DEFAULT 'Owner'
                );

                INSERT INTO "AdminCredentials_temp" ("Id", "Email", "PasswordHash", "PasswordSalt", "PvqQuestion", "PvqAnswerHash", "PvqAnswerSalt", "ResetToken", "ResetTokenExpiry", "CreatedAt", "DisplayName", "IsActive", "Role")
                SELECT "Id", "Email", "PasswordHash", "PasswordSalt", "PvqQuestion", "PvqAnswerHash", "PvqAnswerSalt", "ResetToken", "ResetTokenExpiry", "CreatedAt", "DisplayName", "IsActive", "Role"
                FROM "AdminCredentials";

                DROP TABLE "AdminCredentials";

                ALTER TABLE "AdminCredentials_temp" RENAME TO "AdminCredentials";
                """
            );

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
