using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Moq;
using OpenRestoApi.Controllers;
using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Exceptions;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Application.Utilities;
using OpenRestoApi.Tests.TestInfrastructure;
using OpenRestoApi.Core.Domain;
using OpenRestoApi.Infrastructure.Persistence;
using OpenRestoApi.Infrastructure.Persistence.Repositories;

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

            var holdService = new Mock<IHoldService>().Object;
            var emailService = new MockEmailService();
            var adminService = new OpenRestoApi.Core.Application.Services.AdminService(
                new BookingRepository(_dbContext),
                new BookingFilterRepository(_dbContext),
                new RestaurantRepository(_dbContext),
                new SectionRepository(_dbContext),
                new TableRepository(_dbContext),
                holdService,
                emailService);
            _adminController = new AdminController(adminService);
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
            IActionResult result = await _adminController.SendEmail(1, req);

            // Assert
            OkObjectResult okResult = Assert.IsType<OkObjectResult>(result);
            MessageResponse response = Assert.IsType<MessageResponse>(okResult.Value);
            Assert.Contains("Email sent to guest@test.com", response.Message);
        }

        [Fact]
        public async Task SendEmail_NonExistentBooking_ReturnsNotFound()
        {
            // Arrange
            var req = new SendBookingEmailRequest { Subject = "S", Body = "B" };

            // Act
            IActionResult result = await _adminController.SendEmail(999, req);

            // Assert
            Assert.IsType<NotFoundResult>(result);
        }

        [Fact]
        public async Task SendEmail_MissingSubject_ReturnsBadRequest()
        {
            // Arrange
            var req = new SendBookingEmailRequest { Subject = "", Body = "B" };

            // Act
            IActionResult result = await _adminController.SendEmail(1, req);

            // Assert
            BadRequestObjectResult badRequest = Assert.IsType<BadRequestObjectResult>(result);
            MessageResponse response = Assert.IsType<MessageResponse>(badRequest.Value);
            Assert.Equal("Subject and body are required.", response.Message);
        }

        [Fact]
        public async Task SendEmail_MissingBody_ReturnsBadRequest()
        {
            // Arrange
            var req = new SendBookingEmailRequest { Subject = "S", Body = " " };

            // Act
            IActionResult result = await _adminController.SendEmail(1, req);

            // Assert
            BadRequestObjectResult badRequest = Assert.IsType<BadRequestObjectResult>(result);
            MessageResponse response = Assert.IsType<MessageResponse>(badRequest.Value);
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
            IActionResult result = await _adminController.SendEmail(booking.Id, req);

            // Assert
            BadRequestObjectResult badRequest = Assert.IsType<BadRequestObjectResult>(result);
            MessageResponse response = Assert.IsType<MessageResponse>(badRequest.Value);
            Assert.Equal("Customer email is not available.", response.Message);
        }

        /// <summary>
        /// The pair that pins issue #407: a server with no SMTP settings and a server whose
        /// send throws are both failures on the same endpoint, and a caller has to be able to
        /// tell "fix your configuration" from "retry later" apart from the code alone.
        /// </summary>
        [Fact]
        public async Task SendEmail_WhenEmailIsNotConfigured_ReturnsTheNotConfiguredCode()
        {
            AdminController controller = ControllerWith(new ThrowingEmailService(
                new InfrastructureException("Email is not configured.") { Code = ErrorCodes.EmailNotConfigured }));

            IActionResult result = await controller.SendEmail(1, new SendBookingEmailRequest { Subject = "S", Body = "B" });

            BadRequestObjectResult badRequest = Assert.IsType<BadRequestObjectResult>(result);
            MessageResponse response = Assert.IsType<MessageResponse>(badRequest.Value);
            Assert.Equal(ErrorCodes.EmailNotConfigured, response.Code);
            Assert.Equal("Email is not configured.", response.Message);
        }

        [Fact]
        public async Task SendEmail_WhenTheTransportFails_ReturnsTheSendFailedCode()
        {
            AdminController controller = ControllerWith(new ThrowingEmailService(
                new InvalidOperationException("Connection refused.")));

            IActionResult result = await controller.SendEmail(1, new SendBookingEmailRequest { Subject = "S", Body = "B" });

            BadRequestObjectResult badRequest = Assert.IsType<BadRequestObjectResult>(result);
            MessageResponse response = Assert.IsType<MessageResponse>(badRequest.Value);
            Assert.Equal(ErrorCodes.BookingEmailSendFailed, response.Code);
            Assert.Contains("Connection refused.", response.Message);
        }

        /// <summary>
        /// The pair that keeps the guests redaction from becoming a send gate: `guests:read`
        /// decides what a caller may see, not who the server may write to. Without it, a key
        /// holding `bookings:write` was told a booking carrying an address had none, which made
        /// the whole command useless to exactly the keys meant to run it.
        /// </summary>
        [Fact]
        public async Task SendEmail_WithoutGuestScope_StillReachesTheGuest()
        {
            var emailService = new RecordingEmailService();
            AdminController controller = ControllerWith(
                emailService, FakeCurrentUser.ApiKey((ApiKeyScopes.Bookings, ApiKeyScopes.Write)));

            IActionResult result = await controller.SendEmail(1, new SendBookingEmailRequest { Subject = "S", Body = "B" });

            Assert.IsType<OkObjectResult>(result);
            Assert.Equal("guest@test.com", emailService.Recipient);
        }

        [Fact]
        public async Task SendEmail_WithoutGuestScope_DoesNotEchoTheAddressBack()
        {
            AdminController controller = ControllerWith(
                new RecordingEmailService(), FakeCurrentUser.ApiKey((ApiKeyScopes.Bookings, ApiKeyScopes.Write)));

            IActionResult result = await controller.SendEmail(1, new SendBookingEmailRequest { Subject = "S", Body = "B" });

            OkObjectResult ok = Assert.IsType<OkObjectResult>(result);
            MessageResponse response = Assert.IsType<MessageResponse>(ok.Value);
            Assert.DoesNotContain("guest@test.com", response.Message, StringComparison.Ordinal);
        }

        [Fact]
        public async Task SendEmail_WithGuestScope_EchoesTheRecipient()
        {
            AdminController controller = ControllerWith(
                new RecordingEmailService(),
                FakeCurrentUser.ApiKey(
                    (ApiKeyScopes.Bookings, ApiKeyScopes.Write),
                    (ApiKeyScopes.Guests, ApiKeyScopes.Read)));

            IActionResult result = await controller.SendEmail(1, new SendBookingEmailRequest { Subject = "S", Body = "B" });

            OkObjectResult ok = Assert.IsType<OkObjectResult>(result);
            MessageResponse response = Assert.IsType<MessageResponse>(ok.Value);
            Assert.Contains("guest@test.com", response.Message, StringComparison.Ordinal);
        }

        private AdminController ControllerWith(
            IEmailService emailService, ICurrentUserService? currentUser = null)
            => new(new OpenRestoApi.Core.Application.Services.AdminService(
                new BookingRepository(_dbContext),
                new BookingFilterRepository(_dbContext),
                new RestaurantRepository(_dbContext),
                new SectionRepository(_dbContext),
                new TableRepository(_dbContext),
                new Mock<IHoldService>().Object,
                emailService,
                brandService: null,
                notificationQueue: null,
                audit: null,
                currentUser: currentUser));

        public void Dispose()
        {
            _dbContext.Dispose();
            _serviceProvider.Dispose();
            GC.SuppressFinalize(this);
        }
    }

    internal sealed class RecordingEmailService : IEmailService
    {
        public string? Recipient { get; private set; }

        public Task<bool> TestConnectionAsync() => Task.FromResult(true);

        public Task SendEmailAsync(string recipient, string subject, string htmlBody)
        {
            Recipient = recipient;
            return Task.CompletedTask;
        }
    }

    internal sealed class ThrowingEmailService(Exception failure) : IEmailService
    {
        private readonly Exception _failure = failure;

        public Task<bool> TestConnectionAsync() => Task.FromResult(false);
        public Task SendEmailAsync(string recipient, string subject, string htmlBody) => throw _failure;
    }

    // Re-use MockEmailService if not globally available, or ideally it should be in a shared file
    public class MockEmailService : OpenRestoApi.Core.Application.Interfaces.IEmailService
    {
        public Task<bool> TestConnectionAsync() => Task.FromResult(true);
        public Task SendEmailAsync(string recipient, string subject, string htmlBody) => Task.CompletedTask;
    }
}
