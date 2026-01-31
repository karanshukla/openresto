using AutoMapper;
using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Core.Application.Mappings;

public class BookingProfile : Profile
{
    public BookingProfile()
    {
        CreateMap<Booking, BookingDto>();
        CreateMap<BookingDto, Booking>()
            .ForMember(dest => dest.Table, opt => opt.Ignore())
            .ForMember(dest => dest.Section, opt => opt.Ignore())
            .ForMember(dest => dest.Restaurant, opt => opt.Ignore());
    }
}
