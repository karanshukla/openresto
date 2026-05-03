using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Moq;
using OpenRestoApi.Controllers;
using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Domain;
using OpenRestoApi.Infrastructure.Persistence;

namespace OpenRestoApi.Tests.Controllers
{
    public class AdminControllerRestoreTests : IDisposable
    {
        private readonly ServiceProvider _serviceProvider;
        private readonly AppDbContext _dbContext;
        private readonly AdminController _adminController;

        public AdminControllerRestoreTests()
        {
            var services = new ServiceCollection();
            services.AddDbContext<AppDbContext>(options =>
                options.UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString()));

            _serviceProvider = services.BuildServiceProvider();
            _dbContext = _serviceProvider.GetRequiredService<AppDbContext>();

            // Seed test data
            SeedTestData();

            var holdService = new Mock<IHoldService>().Object;
            var adminService = new OpenRestoApi.Core.Application.Services.AdminService(_dbContext, holdService);
            var emailService = new MockEmailService();
            _adminController = new AdminController(adminService, emailService);
        }

        private void SeedTestData()
        {
            var restaurant = new Restaurant { Name = "Test Restaurant", Address = "123 Test St" };
            _dbContext.Restaurants.Add(restaurant);

            var section = new Section { Name = "Main Section", RestaurantId = restaurant.Id };
            _dbContext.Sections.Add(section);

            var table = new Table { Name = "Table 1", Seats = 4, SectionId = section.Id };
            _dbContext.Tables.Add(table);

            // Active booking
            var activeBooking = new Booking
            {
                RestaurantId = restaurant.Id,
                SectionId = section.Id,
                TableId = table.Id,
                Date = DateTime.UtcNow.AddHours(2),
                CustomerEmail = "active@test.com",
                Seats = 2,
                IsCancelled = false,
                BookingRef = "ACTIVE001"
            };
            _dbContext.Bookings.Add(activeBooking);

            // Cancelled booking
            var cancelledBooking = new Booking
            {
                RestaurantId = restaurant.Id,
                SectionId = section.Id,
                TableId = table.Id,
                Date = DateTime.UtcNow.AddHours(4),
                CustomerEmail = "cancelled@test.com",
                Seats = 3,
                IsCancelled = true,
                CancelledAt = DateTime.UtcNow.AddHours(-1),
                BookingRef = "CANCELLED001"
            };
            _dbContext.Bookings.Add(cancelledBooking);

            _dbContext.SaveChanges();
        }

        [Fact]
        public async Task RestoreBooking_WithValidCancelledBooking_ReturnsSuccess()
        {
            // Arrange
            Booking cancelledBooking = await _dbContext.Bookings
                .FirstAsync(b => b.BookingRef == "CANCELLED001");

            // Act
            IActionResult result = await _adminController.RestoreBooking(cancelledBooking.Id);

            // Assert
            OkObjectResult okResult = Assert.IsType<OkObjectResult>(result);
            Assert.NotNull(okResult.Value);

            // Verify booking is restored in database
            Booking? restoredBooking = await _dbContext.Bookings.FindAsync(cancelledBooking.Id);
            Assert.NotNull(restoredBooking);
            Assert.False(restoredBooking.IsCancelled);
            Assert.Null(restoredBooking.CancelledAt);
        }

        [Fact]
        public async Task RestoreBooking_WithNonExistentBooking_ReturnsNotFound()
        {
            // Act
            IActionResult result = await _adminController.RestoreBooking(99999);

            // Assert
            Assert.IsType<NotFoundResult>(result);
        }

        [Fact]
        public async Task RestoreBooking_WithActiveBooking_ReturnsBadRequest()
        {
            // Arrange
            Booking activeBooking = await _dbContext.Bookings
                .FirstAsync(b => b.BookingRef == "ACTIVE001");

            // Act
            IActionResult result = await _adminController.RestoreBooking(activeBooking.Id);

            // Assert
            BadRequestObjectResult badRequestResult = Assert.IsType<BadRequestObjectResult>(result);
            MessageResponse response = Assert.IsType<MessageResponse>(badRequestResult.Value);
            Assert.Equal("Booking is already active.", response.Message);
        }

        [Fact]
        public async Task RestoreBooking_MultipleRestores_OnlyWorksOnce()
        {
            // Arrange
            Booking cancelledBooking = await _dbContext.Bookings
                .FirstAsync(b => b.BookingRef == "CANCELLED001");

            // Act - First restore
            IActionResult firstResult = await _adminController.RestoreBooking(cancelledBooking.Id);

            // Act - Second restore attempt
            IActionResult secondResult = await _adminController.RestoreBooking(cancelledBooking.Id);

            // Assert
            Assert.IsType<OkObjectResult>(firstResult);
            BadRequestObjectResult badRequestResult = Assert.IsType<BadRequestObjectResult>(secondResult);
            MessageResponse response = Assert.IsType<MessageResponse>(badRequestResult.Value);
            Assert.Equal("Booking is already active.", response.Message);

            // Verify booking is still active
            Booking? booking = await _dbContext.Bookings.FindAsync(cancelledBooking.Id);
            Assert.NotNull(booking);
            Assert.False(booking.IsCancelled);
            Assert.Null(booking.CancelledAt);
        }

        [Fact]
        public async Task RestoreBooking_VerifyResponseMessage()
        {
            // Arrange
            Booking cancelledBooking = await _dbContext.Bookings
                .FirstAsync(b => b.BookingRef == "CANCELLED001");

            // Act
            IActionResult result = await _adminController.RestoreBooking(cancelledBooking.Id);

            // Assert
            OkObjectResult okResult = Assert.IsType<OkObjectResult>(result);
            MessageResponse response = Assert.IsType<MessageResponse>(okResult.Value);
            Assert.Equal("Booking restored successfully.", response.Message);
        }

        public void Dispose()
        {
            _dbContext.Dispose();
            _serviceProvider.Dispose();
            GC.SuppressFinalize(this);
        }
    }
}
