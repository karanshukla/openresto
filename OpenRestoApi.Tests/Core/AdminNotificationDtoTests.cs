using OpenRestoApi.Core.Application.DTOs;

namespace OpenRestoApi.Tests.Core;

public class AdminNotificationDtoTests
{
    private static AdminNotificationDto MakeDto(int id = 1) => new(
        Id: id,
        RestaurantId: 2,
        RestaurantName: "Resto",
        BookingId: 3,
        BookingRef: "REF1",
        Type: "BookingCreated",
        CustomerName: "Alice",
        BookingDate: new DateTime(2026, 1, 1, 10, 0, 0, DateTimeKind.Utc),
        Seats: 2,
        IsRead: false,
        CreatedAt: new DateTime(2026, 1, 1, 9, 0, 0, DateTimeKind.Utc),
        PushSentAt: null,
        PushError: null);

    [Fact]
    public void AdminNotificationDto_PropertyAccess()
    {
        AdminNotificationDto dto = MakeDto();

        Assert.Equal(1, dto.Id);
        Assert.Equal(2, dto.RestaurantId);
        Assert.Equal("Resto", dto.RestaurantName);
        Assert.Equal(3, dto.BookingId);
        Assert.Equal("REF1", dto.BookingRef);
        Assert.Equal("BookingCreated", dto.Type);
        Assert.Equal("Alice", dto.CustomerName);
        Assert.Equal(2, dto.Seats);
        Assert.False(dto.IsRead);
        Assert.Null(dto.PushSentAt);
        Assert.Null(dto.PushError);
    }

    [Fact]
    public void AdminNotificationDto_Equality_And_HashCode_MatchForSameValues()
    {
        AdminNotificationDto a = MakeDto();
        AdminNotificationDto b = MakeDto();

        Assert.Equal(a, b);
        Assert.True(a.Equals(b));
        Assert.Equal(a.GetHashCode(), b.GetHashCode());
        Assert.NotEqual(a, MakeDto(id: 99));
    }

    [Fact]
    public void AdminNotificationDto_ToString_ContainsPropertyNames()
    {
        string text = MakeDto().ToString();

        Assert.Contains("Id", text);
        Assert.Contains("Resto", text);
    }

    [Fact]
    public void AdminNotificationDto_With_CreatesModifiedCopy()
    {
        AdminNotificationDto original = MakeDto();
        AdminNotificationDto copy = original with { IsRead = true };

        Assert.True(copy.IsRead);
        Assert.False(original.IsRead);
        Assert.NotEqual(original, copy);
    }

    [Fact]
    public void PushSubscribeRequest_PropertyAccess()
    {
        var req = new PushSubscribeRequest("https://push.example/sub", "p256dh-key", "auth-secret", "Mozilla/5.0");

        Assert.Equal("https://push.example/sub", req.Endpoint);
        Assert.Equal("p256dh-key", req.P256dh);
        Assert.Equal("auth-secret", req.Auth);
        Assert.Equal("Mozilla/5.0", req.UserAgent);
    }

    [Fact]
    public void PushSubscribeRequest_UserAgent_DefaultsToNull()
    {
        var req = new PushSubscribeRequest("https://push.example/sub", "p256dh-key", "auth-secret");

        Assert.Null(req.UserAgent);
    }

    private static PushPayload MakePayload(int restaurantId = 1) => new(
        Title: "New booking",
        Body: "Alice · 2 guests",
        Type: "BookingCreated",
        BookingId: 5,
        BookingRef: "REF1",
        RestaurantId: restaurantId);

    [Fact]
    public void PushPayload_PropertyAccess()
    {
        PushPayload payload = MakePayload();

        Assert.Equal("New booking", payload.Title);
        Assert.Equal("Alice · 2 guests", payload.Body);
        Assert.Equal("BookingCreated", payload.Type);
        Assert.Equal(5, payload.BookingId);
        Assert.Equal("REF1", payload.BookingRef);
        Assert.Equal(1, payload.RestaurantId);
    }

    [Fact]
    public void PushPayload_Equality_And_HashCode_MatchForSameValues()
    {
        PushPayload a = MakePayload();
        PushPayload b = MakePayload();

        Assert.Equal(a, b);
        Assert.True(a.Equals(b));
        Assert.Equal(a.GetHashCode(), b.GetHashCode());
        Assert.NotEqual(a, MakePayload(restaurantId: 99));
    }

    [Fact]
    public void PushPayload_ToString_ContainsPropertyNames()
    {
        string text = MakePayload().ToString();

        Assert.Contains("Title", text);
        Assert.Contains("New booking", text);
    }

    [Fact]
    public void PushPayload_With_CreatesModifiedCopy()
    {
        PushPayload original = MakePayload();
        PushPayload copy = original with { BookingId = null, BookingRef = null };

        Assert.Null(copy.BookingId);
        Assert.Null(copy.BookingRef);
        Assert.Equal(5, original.BookingId);
    }
}
