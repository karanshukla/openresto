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
    public class AdminControllerUpdateTests : IDisposable
    {
        private readonly ServiceProvider _serviceProvider;
        private readonly AppDbContext _dbContext;
        private readonly AdminController _adminController;

        public AdminControllerUpdateTests()
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
            var restaurant1 = new Restaurant { Name = "Test Restaurant 1", Address = "123 Test St" };
            var restaurant2 = new Restaurant { Name = "Test Restaurant 2", Address = "456 Test Ave" };
            _dbContext.Restaurants.AddRange(restaurant1, restaurant2);
            _dbContext.SaveChanges();

            var section1 = new Section { Name = "Section 1", RestaurantId = restaurant1.Id };
            var section2 = new Section { Name = "Section 2", RestaurantId = restaurant2.Id };
            _dbContext.Sections.AddRange(section1, section2);
            _dbContext.SaveChanges();

            var table1 = new Table { Name = "Table 1", Seats = 4, SectionId = section1.Id };
            var table2 = new Table { Name = "Table 2", Seats = 2, SectionId = section1.Id };
            var table3 = new Table { Name = "Table 3", Seats = 6, SectionId = section2.Id };
            _dbContext.Tables.AddRange(table1, table2, table3);
            _dbContext.SaveChanges();

            var booking = new Booking
            {
                RestaurantId = restaurant1.Id,
                SectionId = section1.Id,
                TableId = table1.Id,
                Date = DateTime.UtcNow.AddDays(1),
                CustomerEmail = "original@test.com",
                Seats = 2,
                BookingRef = "UPDATE001",
                SpecialRequests = "None"
            };
            _dbContext.Bookings.Add(booking);
            _dbContext.SaveChanges();
        }

        [Fact]
        public async Task AdminUpdateBooking_WithValidData_UpdatesBooking()
        {
            // Arrange
            Booking booking = await _dbContext.Bookings.FirstAsync(b => b.BookingRef == "UPDATE001");
            Table table2 = await _dbContext.Tables.FirstAsync(t => t.Name == "Table 2");
            DateTime newDate = DateTime.UtcNow.AddDays(2);
            var req = new AdminUpdateBookingRequest
            {
                TableId = table2.Id,
                Date = newDate,
                Seats = 2,
                CustomerEmail = "updated@test.com",
                SpecialRequests = "Lots of requests"
            };

            // Act
            IActionResult result = await _adminController.AdminUpdateBooking(booking.Id, req);

            // Assert
            OkObjectResult okResult = Assert.IsType<OkObjectResult>(result);
            BookingDetailDto updatedDto = Assert.IsType<BookingDetailDto>(okResult.Value);

            Assert.Equal(table2.Id, updatedDto.TableId);
            Assert.Equal(newDate, updatedDto.Date);
            Assert.Equal(2, updatedDto.Seats);
            Assert.Equal("updated@test.com", updatedDto.CustomerEmail);
            Assert.Equal("Lots of requests", updatedDto.SpecialRequests);

            // Verify database
            Booking? dbBooking = await _dbContext.Bookings.FindAsync(booking.Id);
            Assert.NotNull(dbBooking);
            Assert.Equal(table2.Id, dbBooking.TableId);
            Assert.Equal(newDate, dbBooking.Date);
            Assert.Equal(2, dbBooking.Seats);
            Assert.Equal("updated@test.com", dbBooking.CustomerEmail);
            Assert.Equal("Lots of requests", dbBooking.SpecialRequests);
        }

        [Fact]
        public async Task AdminUpdateBooking_ChangeRestaurantAndSection_UpdatesBooking()
        {
            // Arrange
            Booking booking = await _dbContext.Bookings.FirstAsync(b => b.BookingRef == "UPDATE001");
            Restaurant restaurant2 = await _dbContext.Restaurants.FirstAsync(r => r.Name == "Test Restaurant 2");
            Section section2 = await _dbContext.Sections.FirstAsync(s => s.Name == "Section 2");
            Table table3 = await _dbContext.Tables.FirstAsync(t => t.Name == "Table 3");

            var req = new AdminUpdateBookingRequest
            {
                RestaurantId = restaurant2.Id,
                SectionId = section2.Id,
                TableId = table3.Id
            };

            // Act
            IActionResult result = await _adminController.AdminUpdateBooking(booking.Id, req);

            // Assert
            OkObjectResult okResult = Assert.IsType<OkObjectResult>(result);
            BookingDetailDto updatedDto = Assert.IsType<BookingDetailDto>(okResult.Value);

            Assert.Equal(restaurant2.Id, updatedDto.RestaurantId);
            Assert.Equal(section2.Id, updatedDto.SectionId);
            Assert.Equal(table3.Id, updatedDto.TableId);

            // Verify database
            Booking? dbBooking = await _dbContext.Bookings.FindAsync(booking.Id);
            Assert.NotNull(dbBooking);
            Assert.Equal(restaurant2.Id, dbBooking.RestaurantId);
            Assert.Equal(section2.Id, dbBooking.SectionId);
            Assert.Equal(table3.Id, dbBooking.TableId);
        }

        [Fact]
        public async Task AdminUpdateBooking_WithInvalidTable_ReturnsBadRequest()
        {
            // Arrange
            Booking booking = await _dbContext.Bookings.FirstAsync(b => b.BookingRef == "UPDATE001");
            Table tableInOtherRestaurant = await _dbContext.Tables.FirstAsync(t => t.Name == "Table 3");
            var req = new AdminUpdateBookingRequest
            {
                TableId = tableInOtherRestaurant.Id
            };

            // Act
            IActionResult result = await _adminController.AdminUpdateBooking(booking.Id, req);

            // Assert
            Assert.IsType<BadRequestObjectResult>(result);
        }

        [Fact]
        public async Task AdminUpdateBooking_NonExistentBooking_ReturnsNotFound()
        {
            // Arrange
            var req = new AdminUpdateBookingRequest { Seats = 5 };

            // Act
            IActionResult result = await _adminController.AdminUpdateBooking(99999, req);

            // Assert
            Assert.IsType<NotFoundResult>(result);
        }

        [Fact]
        public async Task AdminUpdateBooking_ReturnsBadRequest_WhenSeatsExceedTableCapacity()
        {
            // Arrange
            var restaurant = new Restaurant { Name = "Test Restaurant", Address = "123 Test St" };
            _dbContext.Restaurants.Add(restaurant);
            _dbContext.SaveChanges();

            var section = new Section { Name = "Main", RestaurantId = restaurant.Id };
            _dbContext.Sections.Add(section);
            _dbContext.SaveChanges();

            var table = new Table { Name = "Table 1", Seats = 2, SectionId = section.Id };
            _dbContext.Tables.Add(table);
            _dbContext.SaveChanges();

            var booking = new Booking
            {
                RestaurantId = restaurant.Id,
                SectionId = section.Id,
                TableId = table.Id,
                Date = DateTime.UtcNow.AddDays(1),
                CustomerEmail = "guest@test.com",
                Seats = 1,
                BookingRef = "TEST001"
            };
            _dbContext.Bookings.Add(booking);
            _dbContext.SaveChanges();

            var req = new AdminUpdateBookingRequest { Seats = 5 };

            // Act
            IActionResult result = await _adminController.AdminUpdateBooking(booking.Id, req);

            // Assert
            BadRequestObjectResult badRequest = Assert.IsType<BadRequestObjectResult>(result);
            var json = System.Text.Json.JsonSerializer.Serialize(badRequest.Value);
            Assert.Contains("only has 2 seats", json);
        }

        [Fact]
        public async Task AdminUpdateBooking_Succeeds_WhenSeatsEqualTableCapacity()
        {
            // Arrange
            var restaurant = new Restaurant { Name = "Test Restaurant", Address = "123 Test St" };
            _dbContext.Restaurants.Add(restaurant);
            _dbContext.SaveChanges();

            var section = new Section { Name = "Main", RestaurantId = restaurant.Id };
            _dbContext.Sections.Add(section);
            _dbContext.SaveChanges();

            var table = new Table { Name = "Table 1", Seats = 4, SectionId = section.Id };
            _dbContext.Tables.Add(table);
            _dbContext.SaveChanges();

            var booking = new Booking
            {
                RestaurantId = restaurant.Id,
                SectionId = section.Id,
                TableId = table.Id,
                Date = DateTime.UtcNow.AddDays(1),
                CustomerEmail = "guest@test.com",
                Seats = 2,
                BookingRef = "TEST002"
            };
            _dbContext.Bookings.Add(booking);
            _dbContext.SaveChanges();

            var req = new AdminUpdateBookingRequest { Seats = 4 };

            // Act
            IActionResult result = await _adminController.AdminUpdateBooking(booking.Id, req);

            // Assert
            Assert.IsType<OkObjectResult>(result);
            var okResult = (OkObjectResult)result;
            BookingDetailDto returnedDto = Assert.IsType<BookingDetailDto>(okResult.Value);
            Assert.Equal(4, returnedDto.Seats);
        }

        public void Dispose()
        {
            _dbContext.Dispose();
            _serviceProvider.Dispose();
            GC.SuppressFinalize(this);
        }
    }
}
