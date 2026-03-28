using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using OpenRestoApi.Controllers;
using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Domain;
using OpenRestoApi.Infrastructure.Persistence;
using System;
using System.Threading.Tasks;
using Xunit;

namespace OpenRestoApi.Tests.Controllers
{
    public class AdminControllerEmailTests : IDisposable
    {
        private readonly ServiceProvider _serviceProvider;
        private readonly AppDbContext _dbContext;
        private readonly AdminController _adminController;

        public AdminControllerEmailTests()
        {
            var services = new ServiceCollection();
            services.AddDbContext<AppDbContext>(options =>
                options.UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString()));

            _serviceProvider = services.BuildServiceProvider();
            _dbContext = _serviceProvider.GetRequiredService<AppDbContext>();

            SeedTestData();

            var adminService = new OpenRestoApi.Core.Application.Services.AdminService(_dbContext);
            var emailService = new MockEmailService();
            _adminController = new AdminController(adminService, emailService);
        }

        private void SeedTestData()
        {
            var restaurant = new Restaurant { Name = "Email Test Restaurant", Address = "123 Test St" };
            _dbContext.Restaurants.Add(restaurant);
            _dbContext.SaveChanges();

            var section = new Section { Name = "Main", RestaurantId = restaurant.Id };
            _dbContext.Sections.Add(section);
            _dbContext.SaveChanges();

            var table = new Table { Name = "T1", Seats = 4, SectionId = section.Id };
            _dbContext.Tables.Add(table);
            _dbContext.SaveChanges();

            var booking = new Booking
            {
                Id = 1,
                RestaurantId = restaurant.Id,
                SectionId = section.Id,
                TableId = table.Id,
                Date = DateTime.UtcNow.AddDays(1),
                CustomerEmail = "guest@test.com",
                Seats = 2,
                BookingRef = "EMAIL001"
            };
            _dbContext.Bookings.Add(booking);
            _dbContext.SaveChanges();
        }

        [Fact]
        public async Task SendEmail_WithValidData_ReturnsOk()
        {
            // Arrange
            var req = new SendBookingEmailRequest
            {
                Subject = "Test Subject",
                Body = "Test Body"
            };

            // Act
            var result = await _adminController.SendEmail(1, req);

            // Assert
            var okResult = Assert.IsType<OkObjectResult>(result);
            var response = Assert.IsType<MessageResponse>(okResult.Value);
            Assert.Contains("Email sent to guest@test.com", response.Message);
        }

        [Fact]
        public async Task SendEmail_NonExistentBooking_ReturnsNotFound()
        {
            // Arrange
            var req = new SendBookingEmailRequest { Subject = "S", Body = "B" };

            // Act
            var result = await _adminController.SendEmail(999, req);

            // Assert
            Assert.IsType<NotFoundResult>(result);
        }

        [Fact]
        public async Task SendEmail_MissingSubject_ReturnsBadRequest()
        {
            // Arrange
            var req = new SendBookingEmailRequest { Subject = "", Body = "B" };

            // Act
            var result = await _adminController.SendEmail(1, req);

            // Assert
            var badRequest = Assert.IsType<BadRequestObjectResult>(result);
            var response = Assert.IsType<MessageResponse>(badRequest.Value);
            Assert.Equal("Subject and body are required.", response.Message);
        }

        [Fact]
        public async Task SendEmail_MissingBody_ReturnsBadRequest()
        {
            // Arrange
            var req = new SendBookingEmailRequest { Subject = "S", Body = " " };

            // Act
            var result = await _adminController.SendEmail(1, req);

            // Assert
            var badRequest = Assert.IsType<BadRequestObjectResult>(result);
            var response = Assert.IsType<MessageResponse>(badRequest.Value);
            Assert.Equal("Subject and body are required.", response.Message);
        }

        [Fact]
        public async Task SendEmail_BookingMissingEmail_ReturnsBadRequest()
        {
            // Arrange
            var booking = new Booking
            {
                Id = 2,
                RestaurantId = 1,
                SectionId = 1,
                TableId = 1,
                Date = DateTime.UtcNow.AddDays(1),
                CustomerEmail = null, // Missing email
                Seats = 2,
                BookingRef = "NOEMAIL"
            };
            _dbContext.Bookings.Add(booking);
            _dbContext.SaveChanges();

            var req = new SendBookingEmailRequest { Subject = "S", Body = "B" };

            // Act
            var result = await _adminController.SendEmail(booking.Id, req);

            // Assert
            var badRequest = Assert.IsType<BadRequestObjectResult>(result);
            var response = Assert.IsType<MessageResponse>(badRequest.Value);
            Assert.Equal("Customer email is not available.", response.Message);
        }

        public void Dispose()
        {
            _dbContext.Dispose();
            _serviceProvider.Dispose();
        }
    }

    // Re-use MockEmailService if not globally available, or ideally it should be in a shared file
    public class MockEmailService : OpenRestoApi.Core.Application.Interfaces.IEmailService
    {
        public Task<bool> TestConnectionAsync() => Task.FromResult(true);
        public Task SendEmailAsync(string recipient, string subject, string htmlBody) => Task.CompletedTask;
    }
}
