using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Core.Application.Interfaces;

public interface INotificationQueue
{
    void EnqueueBookingCreated(Booking booking, string restaurantName);
    void EnqueueBookingCancelled(Booking booking, string restaurantName);
    void EnqueueCapacityCheck(int restaurantId, string restaurantName, DateTime bookingDate);
}
