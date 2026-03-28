using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using OpenRestoApi.Controllers;
using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Domain;
using OpenRestoApi.Infrastructure.Persistence;
using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using Xunit;

namespace OpenRestoApi.Tests.Controllers
{
    public class AdminControllerLookupTests : IDisposable
    {
        private readonly ServiceProvider _serviceProvider;
        private readonly AppDbContext _dbContext;
        private readonly AdminController _adminController;

        public AdminControllerLookupTests()
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
            var r1 = new Restaurant { Name = "B Restaurant", Address = "123 St" };
            var r2 = new Restaurant { Name = "A Restaurant", Address = "456 Ave" };
            _dbContext.Restaurants.AddRange(r1, r2);
            _dbContext.SaveChanges();

            var s1 = new Section { Name = "Main Section", RestaurantId = r1.Id };
            var s2 = new Section { Name = "Outdoor", RestaurantId = r1.Id };
            _dbContext.Sections.AddRange(s1, s2);
            _dbContext.SaveChanges();
        }

        [Fact]
        public async Task GetRestaurants_ReturnsSortedRestaurants()
        {
            // Act
            var result = await _adminController.GetRestaurants();

            // Assert
            var okResult = Assert.IsType<OkObjectResult>(result);
            var restaurants = Assert.IsType<List<LookupDto>>(okResult.Value);
            Assert.Equal(2, restaurants.Count);
            
            // Check sorting (A should be first)
            Assert.Equal("A Restaurant", restaurants[0].Name);
            Assert.Equal("B Restaurant", restaurants[1].Name);
        }

        [Fact]
        public async Task GetSections_ReturnsSectionsForRestaurant()
        {
            // Arrange
            var restaurant = await _dbContext.Restaurants.FirstAsync(r => r.Name == "B Restaurant");

            // Act
            var result = await _adminController.GetSections(restaurant.Id);

            // Assert
            var okResult = Assert.IsType<OkObjectResult>(result);
            var sections = Assert.IsType<List<LookupDto>>(okResult.Value);
            Assert.Equal(2, sections.Count);
        }

        [Fact]
        public async Task GetSections_WithInvalidId_ReturnsEmptyList()
        {
            // Act
            var result = await _adminController.GetSections(99999);

            // Assert
            var okResult = Assert.IsType<OkObjectResult>(result);
            var sections = Assert.IsType<List<LookupDto>>(okResult.Value);
            Assert.Empty(sections);
        }

        public void Dispose()
        {
            _dbContext.Dispose();
            _serviceProvider.Dispose();
        }
    }
}
