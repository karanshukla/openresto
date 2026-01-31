using AutoMapper;
using Microsoft.EntityFrameworkCore;
using Moq;
using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Application.Mappings;
using OpenRestoApi.Core.Application.Services;
using OpenRestoApi.Core.Domain;
using OpenRestoApi.Infrastructure.Persistence;
using OpenRestoApi.Infrastructure.Persistence.Repositories;
using Xunit;

namespace OpenRestoApi.Tests.Services
{
    public class BookingServiceTests
    {
        private readonly DbContextOptions<AppDbContext> _dbContextOptions;
        private readonly IMapper _mapper;

        public BookingServiceTests()
        {
            _dbContextOptions = new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase(databaseName: "OpenRestoTestDb")
                .Options;

            var mappingConfig = new MapperConfiguration(mc =>
            {
                mc.AddProfile(new BookingProfile());
            });
            _mapper = mappingConfig.CreateMapper();
        }

        [Fact]
        public async Task CreateBookingAsync_ShouldCreateBooking()
        {
            // Arrange
            using (var context = new AppDbContext(_dbContextOptions))
            {
                context.Restaurants.Add(new Restaurant { Id = 1, Name = "Test Restaurant" });
                context.Sections.Add(new Section { Id = 1, Name = "Test Section", RestaurantId = 1 });
                context.Tables.Add(new Table { Id = 1, Name = "T1", Seats = 4, SectionId = 1 });
                context.SaveChanges();
            }

            using (var context = new AppDbContext(_dbContextOptions))
            {
                var bookingRepository = new BookingRepository(context);
                var tableRepository = new TableRepository(context);
                var sectionRepository = new SectionRepository(context);
                var restaurantRepository = new RestaurantRepository(context);

                var bookingService = new BookingService(
                    bookingRepository,
                    tableRepository,
                    sectionRepository,
                    restaurantRepository,
                    _mapper);

                var bookingDto = new BookingDto
                {
                    RestaurantId = 1,
                    SectionId = 1,
                    TableId = 1,
                    CustomerEmail = "test@example.com",
                    Seats = 2,
                    Date = DateTime.UtcNow
                };

                // Act
                var result = await bookingService.CreateBookingAsync(bookingDto);

                // Assert
                Assert.NotNull(result);
                Assert.Equal(bookingDto.CustomerEmail, result.CustomerEmail);

                var bookingInDb = await context.Bookings.FindAsync(result.Id);
                Assert.NotNull(bookingInDb);
            }
        }
    }
}
