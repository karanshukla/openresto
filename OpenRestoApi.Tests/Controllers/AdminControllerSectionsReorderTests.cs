using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Moq;
using OpenRestoApi.Controllers;
using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Domain;
using OpenRestoApi.Infrastructure.Persistence;
using OpenRestoApi.Infrastructure.Persistence.Repositories;

namespace OpenRestoApi.Tests.Controllers
{
    public class AdminControllerSectionsReorderTests : IDisposable
    {
        private readonly ServiceProvider _serviceProvider;
        private readonly AppDbContext _dbContext;
        private readonly AdminController _adminController;
        private Restaurant _restaurant = null!;
        private Section _first = null!;
        private Section _second = null!;

        public AdminControllerSectionsReorderTests()
        {
            var services = new ServiceCollection();
            services.AddDbContext<AppDbContext>(options =>
                options.UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString()));

            _serviceProvider = services.BuildServiceProvider();
            _dbContext = _serviceProvider.GetRequiredService<AppDbContext>();

            SeedTestData();

            var holdService = new Mock<IHoldService>().Object;
            var adminService = new OpenRestoApi.Core.Application.Services.AdminService(
                new BookingRepository(_dbContext),
                new BookingFilterRepository(_dbContext),
                new RestaurantRepository(_dbContext),
                new SectionRepository(_dbContext),
                new TableRepository(_dbContext),
                holdService);
            var emailService = new MockEmailService();
            _adminController = new AdminController(adminService, emailService);
        }

        private void SeedTestData()
        {
            _restaurant = new Restaurant { Name = "Test Restaurant" };
            _dbContext.Restaurants.Add(_restaurant);
            _dbContext.SaveChanges();

            _first = new Section { Name = "First", RestaurantId = _restaurant.Id, SortOrder = 0 };
            _second = new Section { Name = "Second", RestaurantId = _restaurant.Id, SortOrder = 1 };
            _dbContext.Sections.AddRange(_first, _second);
            _dbContext.SaveChanges();
        }

        [Fact]
        public async Task ReorderSections_ReturnsNoContent_AndPersistsNewOrder()
        {
            var req = new ReorderSectionsRequest { SectionIds = [_second.Id, _first.Id] };

            IActionResult result = await _adminController.ReorderSections(_restaurant.Id, req);

            Assert.IsType<NoContentResult>(result);
            Section? first = await _dbContext.Sections.FindAsync(_first.Id);
            Section? second = await _dbContext.Sections.FindAsync(_second.Id);
            Assert.Equal(1, first!.SortOrder);
            Assert.Equal(0, second!.SortOrder);
        }

        [Fact]
        public async Task ReorderSections_ReadBack_ReflectsNewOrder()
        {
            var req = new ReorderSectionsRequest { SectionIds = [_second.Id, _first.Id] };
            await _adminController.ReorderSections(_restaurant.Id, req);

            IActionResult sectionsResult = await _adminController.GetSections(_restaurant.Id);

            OkObjectResult ok = Assert.IsType<OkObjectResult>(sectionsResult);
            List<LookupDto> sections = Assert.IsType<List<LookupDto>>(ok.Value);
            Assert.Equal(["Second", "First"], sections.Select(s => s.Name));
        }

        [Fact]
        public async Task ReorderSections_ReturnsNotFound_WhenRestaurantMissing()
        {
            var req = new ReorderSectionsRequest { SectionIds = [_first.Id, _second.Id] };

            IActionResult result = await _adminController.ReorderSections(9999, req);

            Assert.IsType<NotFoundResult>(result);
        }

        [Fact]
        public async Task ReorderSections_ReturnsBadRequest_WhenSectionIdsInvalid()
        {
            var req = new ReorderSectionsRequest { SectionIds = [_first.Id] };

            IActionResult result = await _adminController.ReorderSections(_restaurant.Id, req);

            Assert.IsType<BadRequestObjectResult>(result);
        }

        [Fact]
        public async Task ReorderSections_ReturnsNoContent_WhenRestaurantHasNoSections_AndEmptyListSent()
        {
            var emptyRestaurant = new Restaurant { Name = "No Sections" };
            _dbContext.Restaurants.Add(emptyRestaurant);
            _dbContext.SaveChanges();

            var req = new ReorderSectionsRequest { SectionIds = [] };

            IActionResult result = await _adminController.ReorderSections(emptyRestaurant.Id, req);

            Assert.IsType<NoContentResult>(result);
        }

        public void Dispose()
        {
            _dbContext.Dispose();
            _serviceProvider.Dispose();
            GC.SuppressFinalize(this);
        }
    }
}
