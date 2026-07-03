using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;
using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Infrastructure.Persistence;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Restaurant> Restaurants { get; set; } = null!;
    public DbSet<Section> Sections { get; set; } = null!;
    public DbSet<Table> Tables { get; set; } = null!;
    public DbSet<Booking> Bookings { get; set; } = null!;
    public DbSet<AdminCredential> AdminCredentials { get; set; } = null!;
    public DbSet<EmailSettings> EmailSettings { get; set; } = null!;
    public DbSet<BrandSettings> BrandSettings { get; set; } = null!;
    public DbSet<RestaurantHighlight> Highlights { get; set; } = null!;
    public DbSet<SocialLink> SocialLinks { get; set; } = null!;
    public DbSet<EmailFailure> EmailFailures { get; set; } = null!;
    public DbSet<AdminNotification> AdminNotifications { get; set; } = null!;
    public DbSet<AdminPushSubscription> AdminPushSubscriptions { get; set; } = null!;

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
        });

        modelBuilder.Entity<AdminCredential>(a =>
        {
            a.HasKey(x => x.Id);
        });

        modelBuilder.Entity<AdminNotification>(n =>
        {
            n.HasKey(x => x.Id);
            n.HasOne(x => x.Restaurant).WithMany().HasForeignKey(x => x.RestaurantId).OnDelete(DeleteBehavior.Cascade);
            n.HasOne(x => x.Booking).WithMany().HasForeignKey(x => x.BookingId).OnDelete(DeleteBehavior.SetNull);
            n.HasIndex(x => new { x.RestaurantId, x.CreatedAt });
            n.HasIndex(x => new { x.RestaurantId, x.IsRead });
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
