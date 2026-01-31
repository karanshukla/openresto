using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Domain;
using OpenRestoApi.Infrastructure.Persistence;

namespace OpenRestoApi.Controllers;

[ApiController]
[Route("api/[controller]")]
public class BookingsController(AppDbContext db) : ControllerBase
{

}
