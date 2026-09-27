using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Infrastructure.Notifications;

public abstract record NotificationWorkItem;

public sealed record BookingCreatedWork(Booking Booking, string RestaurantName) : NotificationWorkItem;
public sealed record BookingCancelledWork(Booking Booking, string RestaurantName) : NotificationWorkItem;
public sealed record CapacityCheckWork(int RestaurantId, string RestaurantName, DateTime BookingDate) : NotificationWorkItem;
