using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;
using OpenRestoApi.Core.Application.Utilities;
using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Infrastructure.Persistence;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Restaurant> Restaurants { get; set; } = null!;
    public DbSet<Section> Sections { get; set; } = null!;
    public DbSet<Table> Tables { get; set; } = null!;
    public DbSet<TableGroup> TableGroups { get; set; } = null!;
    public DbSet<TableGroupMembership> TableGroupMemberships { get; set; } = null!;
    public DbSet<Booking> Bookings { get; set; } = null!;
    public DbSet<AdminCredential> AdminCredentials { get; set; } = null!;
    public DbSet<EmailSettings> EmailSettings { get; set; } = null!;
    public DbSet<BrandSettings> BrandSettings { get; set; } = null!;
    public DbSet<RestaurantHighlight> Highlights { get; set; } = null!;
    public DbSet<SocialLink> SocialLinks { get; set; } = null!;
    public DbSet<EmailFailure> EmailFailures { get; set; } = null!;
    public DbSet<AdminNotification> AdminNotifications { get; set; } = null!;
    public DbSet<AdminPushSubscription> AdminPushSubscriptions { get; set; } = null!;
    public DbSet<AdminAuditEntry> AdminAuditEntries { get; set; } = null!;

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Force UTC for all DateTime properties
        var dateTimeConverter = new Microsoft.EntityFrameworkCore.Storage.ValueConversion.ValueConverter<DateTime, DateTime>(
            v => v.Kind == DateTimeKind.Utc ? v : v.ToUniversalTime(),
            v => DateTime.SpecifyKind(v, DateTimeKind.Utc));

        var nullableDateTimeConverter = new Microsoft.EntityFrameworkCore.Storage.ValueConversion.ValueConverter<DateTime?, DateTime?>(
            v => !v.HasValue ? v : (v.Value.Kind == DateTimeKind.Utc ? v : v.Value.ToUniversalTime()),
            v => !v.HasValue ? v : DateTime.SpecifyKind(v.Value, DateTimeKind.Utc));

        foreach (IMutableEntityType entityType in modelBuilder.Model.GetEntityTypes())
        {
            foreach (IMutableProperty property in entityType.GetProperties())
            {
                if (property.ClrType == typeof(DateTime))
                {
                    property.SetValueConverter(dateTimeConverter);
                }
                else if (property.ClrType == typeof(DateTime?))
                {
                    property.SetValueConverter(nullableDateTimeConverter);
                }
            }
        }

        modelBuilder.Entity<Restaurant>(rb =>
        {
            rb.HasKey(r => r.Id);
            rb.Property(r => r.Name).IsRequired();
            rb.HasMany(r => r.Sections)
              .WithOne(s => s.Restaurant)
              .HasForeignKey(s => s.RestaurantId)
              .OnDelete(DeleteBehavior.Cascade);
            rb.HasMany(r => r.Groups)
              .WithOne(g => g.Restaurant!)
              .HasForeignKey(g => g.RestaurantId)
              .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Section>(sb =>
        {
            sb.HasKey(s => s.Id);
            sb.Property(s => s.Name).IsRequired();
            sb.HasMany(s => s.Tables)
              .WithOne(t => t.Section)
              .HasForeignKey(t => t.SectionId)
              .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Table>(tb =>
        {
            tb.HasKey(t => t.Id);
            tb.Property(t => t.Seats).IsRequired();
            tb.Property(t => t.Name);
        });

        modelBuilder.Entity<Booking>(bb =>
        {
            bb.HasKey(b => b.Id);
            bb.HasOne(b => b.Table).WithMany().HasForeignKey(b => b.TableId).OnDelete(DeleteBehavior.SetNull);
            bb.HasOne(b => b.Section).WithMany().HasForeignKey(b => b.SectionId).OnDelete(DeleteBehavior.SetNull);
            bb.HasOne(b => b.Restaurant).WithMany().HasForeignKey(b => b.RestaurantId);
            bb.HasOne(b => b.TableGroup).WithMany().HasForeignKey(b => b.TableGroupId).OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<TableGroup>(gb =>
        {
            gb.HasKey(g => g.Id);
            gb.Property(g => g.CombinedSeats).IsRequired();
            gb.HasMany(g => g.Members)
              .WithOne(m => m.Group!)
              .HasForeignKey(m => m.TableGroupId)
              .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<TableGroupMembership>(mb =>
        {
            // Composite PK — a (group, table) pair is unique by definition; the unique index on
            // TableId below enforces "a table belongs to at most one group" at the DB level (also
            // enforced in service code, since the in-memory provider used by tests ignores constraints).
            mb.HasKey(m => new { m.TableGroupId, m.TableId });
            mb.HasOne(m => m.Table).WithMany().HasForeignKey(m => m.TableId).OnDelete(DeleteBehavior.Cascade);
            mb.HasIndex(m => m.TableId).IsUnique();
        });

        modelBuilder.Entity<AdminCredential>(a =>
        {
            a.HasKey(x => x.Id);
            // Emails are lower-cased on every write path (bootstrap, create-user, change-email),
            // so an ordinary unique index is enough to make "one account per address"
            // case-insensitive — no NOCASE collation change, which SQLite can only apply by
            // rebuilding the table.
            a.HasIndex(x => x.Email).IsUnique();
            a.Property(x => x.DisplayName).HasMaxLength(UserFields.MaxDisplayNameLength);
            a.Property(x => x.Role).HasMaxLength(UserFields.MaxRoleLength).HasDefaultValue(UserRoles.Owner);
            a.Property(x => x.IsActive).HasDefaultValue(true);
            a.Property(x => x.CreatedAt).HasDefaultValueSql("CURRENT_TIMESTAMP");
        });

        modelBuilder.Entity<AdminNotification>(n =>
        {
            n.HasKey(x => x.Id);
            n.HasOne(x => x.Restaurant).WithMany().HasForeignKey(x => x.RestaurantId).OnDelete(DeleteBehavior.Cascade);
            n.HasOne(x => x.Booking).WithMany().HasForeignKey(x => x.BookingId).OnDelete(DeleteBehavior.SetNull);
            n.HasIndex(x => new { x.RestaurantId, x.CreatedAt });
            n.HasIndex(x => new { x.RestaurantId, x.IsRead });
        });

        modelBuilder.Entity<AdminAuditEntry>(e =>
        {
            e.HasKey(x => x.Id);
            // SetNull, not Cascade: the denormalized actor email and role are what keep an entry
            // readable, and deleting the account must not delete the record of what it did.
            e.HasOne(x => x.ActorUser).WithMany().HasForeignKey(x => x.ActorUserId).OnDelete(DeleteBehavior.SetNull);
            e.Property(x => x.ActorEmail).IsRequired().HasMaxLength(AuditFields.MaxActorEmailLength);
            e.Property(x => x.ActorDisplayName).HasMaxLength(AuditFields.MaxActorDisplayNameLength);
            e.Property(x => x.ActorRole).IsRequired().HasMaxLength(AuditFields.MaxRoleLength);
            e.Property(x => x.Action).IsRequired().HasMaxLength(AuditFields.MaxActionLength);
            e.Property(x => x.TargetType).HasMaxLength(AuditFields.MaxTargetTypeLength);
            e.Property(x => x.TargetId).HasMaxLength(AuditFields.MaxTargetIdLength);
            e.Property(x => x.TargetLabel).HasMaxLength(AuditFields.MaxTargetLabelLength);
            e.Property(x => x.Summary).HasMaxLength(AuditFields.MaxSummaryLength);
            e.Property(x => x.ChangesJson).HasMaxLength(AuditFields.MaxChangesJsonLength);
            e.Property(x => x.HttpMethod).IsRequired().HasMaxLength(AuditFields.MaxHttpMethodLength);
            e.Property(x => x.Path).IsRequired().HasMaxLength(AuditFields.MaxPathLength);
            e.Property(x => x.IpAddress).HasMaxLength(AuditFields.MaxIpAddressLength);
            e.Property(x => x.UserAgent).HasMaxLength(AuditFields.MaxUserAgentLength);
            // The list is always newest-first; the filters are the other three axes.
            e.HasIndex(x => x.OccurredAt);
            e.HasIndex(x => new { x.ActorUserId, x.OccurredAt });
            e.HasIndex(x => new { x.RestaurantId, x.OccurredAt });
            e.HasIndex(x => x.Action);
        });

        modelBuilder.Entity<AdminPushSubscription>(s =>
        {
            s.HasKey(x => x.Id);
            s.HasOne(x => x.Restaurant).WithMany().HasForeignKey(x => x.RestaurantId).OnDelete(DeleteBehavior.Cascade);
            s.HasIndex(x => new { x.Endpoint, x.RestaurantId }).IsUnique();
            s.HasIndex(x => x.RestaurantId);
        });
    }
}
