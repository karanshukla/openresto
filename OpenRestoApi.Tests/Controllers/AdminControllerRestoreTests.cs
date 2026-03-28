using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using OpenRestoApi.Controllers;
using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Domain;
using OpenRestoApi.Infrastructure.Persistence;
using System;
using System.Text.Json;
using System.Threading.Tasks;
using Xunit;

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

            var adminService = new OpenRestoApi.Core.Application.Services.AdminService(_dbContext);
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
            var cancelledBooking = await _dbContext.Bookings
                .FirstAsync(b => b.BookingRef == "CANCELLED001");

            // Act
            var result = await _adminController.RestoreBooking(cancelledBooking.Id);

            // Assert
            var okResult = Assert.IsType<OkObjectResult>(result);
            Assert.NotNull(okResult.Value);

            // Verify booking is restored in database
            var restoredBooking = await _dbContext.Bookings.FindAsync(cancelledBooking.Id);
            Assert.False(restoredBooking.IsCancelled);
            Assert.Null(restoredBooking.CancelledAt);
        }

        [Fact]
        public async Task RestoreBooking_WithNonExistentBooking_ReturnsNotFound()
        {
            // Act
            var result = await _adminController.RestoreBooking(99999);

            // Assert
            Assert.IsType<NotFoundResult>(result);
        }

        [Fact]
        public async Task RestoreBooking_WithActiveBooking_ReturnsBadRequest()
        {
            // Arrange
            var activeBooking = await _dbContext.Bookings
                .FirstAsync(b => b.BookingRef == "ACTIVE001");

            // Act
            var result = await _adminController.RestoreBooking(activeBooking.Id);

            // Assert
            var badRequestResult = Assert.IsType<BadRequestObjectResult>(result);
            var response = Assert.IsType<MessageResponse>(badRequestResult.Value);
            Assert.Equal("Booking is already active.", response.Message);
        }

        [Fact]
        public async Task RestoreBooking_MultipleRestores_OnlyWorksOnce()
        {
            // Arrange
            var cancelledBooking = await _dbContext.Bookings
                .FirstAsync(b => b.BookingRef == "CANCELLED001");

            // Act - First restore
            var firstResult = await _adminController.RestoreBooking(cancelledBooking.Id);
            
            // Act - Second restore attempt
            var secondResult = await _adminController.RestoreBooking(cancelledBooking.Id);

            // Assert
            Assert.IsType<OkObjectResult>(firstResult);
            var badRequestResult = Assert.IsType<BadRequestObjectResult>(secondResult);
            var response = Assert.IsType<MessageResponse>(badRequestResult.Value);
            Assert.Equal("Booking is already active.", response.Message);

            // Verify booking is still active
            var booking = await _dbContext.Bookings.FindAsync(cancelledBooking.Id);
            Assert.NotNull(booking);
            Assert.False(booking.IsCancelled);
            Assert.Null(booking.CancelledAt);
        }

        [Fact]
        public async Task RestoreBooking_VerifyResponseMessage()
        {
            // Arrange
            var cancelledBooking = await _dbContext.Bookings
                .FirstAsync(b => b.BookingRef == "CANCELLED001");

            // Act
            var result = await _adminController.RestoreBooking(cancelledBooking.Id);

            // Assert
            var okResult = Assert.IsType<OkObjectResult>(result);
            var response = Assert.IsType<MessageResponse>(okResult.Value);
            Assert.Equal("Booking restored successfully.", response.Message);
        }

        public void Dispose()
        {
            _dbContext.Dispose();
            _serviceProvider.Dispose();
        }
    }
}
