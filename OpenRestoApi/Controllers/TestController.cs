using Microsoft.AspNetCore.Mvc;
using OpenRestoApi.Core.Application.DTOs;

namespace OpenRestoApi.Controllers;

[ApiController]
[Route("api/[controller]")]
public class TestController : ControllerBase
{
    private static readonly string[] Summaries = new[]
    {
        "Freezing", "Bracing", "Chilly", "Cool", "Mild", "Warm", "Balmy", "Hot", "Sweltering", "Scorching"
    };

    [HttpGet("weatherforecast")]
    public IEnumerable<WeatherForecastDto> Get()
    {
        return Enumerable.Range(1, 5).Select(index => new WeatherForecastDto
        (
            DateOnly.FromDateTime(DateTime.Now.AddDays(index)),
            Random.Shared.Next(-20, 55),
            Summaries[Random.Shared.Next(Summaries.Length)]
        ))
        .ToArray();
    }
}
