using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Mappings;
using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Tests.Services;

/// <summary>
/// Display-enrichment for combinable-group bookings. The Mapperly-generated <c>ToDto</c> maps
/// TableName/TableSeats from <c>Booking.Table</c>, which is null on a group booking — without the
/// substitution in <c>ToDtoWithGroup</c> the diner confirmation, lookup, admin grid, and calendar
/// would all render a blank table.
/// </summary>
public class BookingMapperGroupTests
{
    private static readonly BookingMapper Mapper = new();

    private static Booking GroupBooking(TableGroup group) => new()
    {
        Id = 1,
        RestaurantId = 1,
        SectionId = 2,
        TableId = null,
        TableGroupId = group.Id,
        TableGroup = group,
        Seats = 6,
        BookingRef = "GRP1",
        Date = DateTime.UtcNow.AddDays(1)
    };

    private static TableGroupMembership Member(int tableId, string? tableName) => new()
    {
        TableGroupId = 1,
        TableId = tableId,
        Table = tableName == null ? null : new Table { Id = tableId, Name = tableName, Seats = 4 }
    };

    [Fact]
    public void GroupLabel_PrefersTheAdminAssignedName()
    {
        var group = new TableGroup { Id = 1, Name = "Window booths", CombinedSeats = 8 };
        group.Members.Add(Member(3, "T3"));
        group.Members.Add(Member(2, "T2"));

        Assert.Equal("Window booths", BookingMapper.GroupLabel(group));
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void GroupLabel_FallsBackToMemberNames_WhenTheNameIsBlank(string name)
    {
        var group = new TableGroup { Id = 1, Name = name, CombinedSeats = 8 };
        group.Members.Add(Member(3, "T3"));
        group.Members.Add(Member(2, "T2"));

        // Members are ordered by table id, not insertion order, so the label is stable.
        Assert.Equal("Tables T2 + T3", BookingMapper.GroupLabel(group));
    }

    [Fact]
    public void GroupLabel_UsesTableIdPlaceholder_WhenAMemberTableIsNotLoaded()
    {
        var group = new TableGroup { Id = 1, CombinedSeats = 8 };
        group.Members.Add(Member(2, "T2"));
        group.Members.Add(Member(9, null));

        Assert.Equal("Tables T2 + Table 9", BookingMapper.GroupLabel(group));
    }

    [Fact]
    public void GroupLabel_FallsBackToAGenericLabel_WhenTheGroupHasNoMembers()
    {
        var group = new TableGroup { Id = 1, CombinedSeats = 8 };

        Assert.Equal("Combined tables", BookingMapper.GroupLabel(group));
    }

    [Fact]
    public void ToDtoWithGroup_FillsGroupIdLabelAndCombinedSeats()
    {
        var group = new TableGroup { Id = 5, Name = "Window booths", CombinedSeats = 8 };
        group.Members.Add(Member(2, "T2"));
        group.Members.Add(Member(3, "T3"));

        BookingDto dto = Mapper.ToDtoWithGroup(GroupBooking(group));

        Assert.Equal(5, dto.TableGroupId);
        Assert.Equal("Window booths", dto.TableName);
        Assert.Equal(8, dto.TableSeats);
    }

    [Fact]
    public void ToDtoWithGroup_KeepsTheRealTableName_WhenTheBookingAlsoHasATable()
    {
        // Defensive: the substitution is null-coalescing, so a row that somehow carries both must
        // keep the concrete table's own name and capacity rather than being relabelled.
        var group = new TableGroup { Id = 5, Name = "Window booths", CombinedSeats = 8 };
        group.Members.Add(Member(2, "T2"));
        group.Members.Add(Member(3, "T3"));

        Booking booking = GroupBooking(group);
        booking.TableId = 2;
        booking.Table = new Table { Id = 2, Name = "T2", Seats = 4 };

        BookingDto dto = Mapper.ToDtoWithGroup(booking);

        Assert.Equal("T2", dto.TableName);
        Assert.Equal(4, dto.TableSeats);
        Assert.Equal(5, dto.TableGroupId);
    }

    [Fact]
    public void ToDtoWithGroup_LeavesASingleTableBookingUntouched()
    {
        var booking = new Booking
        {
            Id = 2,
            RestaurantId = 1,
            SectionId = 1,
            TableId = 7,
            Table = new Table { Id = 7, Name = "T7", Seats = 4 },
            Section = new Section { Id = 1, Name = "Main" },
            Seats = 2,
            BookingRef = "SNG1",
            Date = DateTime.UtcNow.AddDays(1)
        };

        BookingDto dto = Mapper.ToDtoWithGroup(booking);

        Assert.Null(dto.TableGroupId);
        Assert.Equal("T7", dto.TableName);
        Assert.Equal("Main", dto.SectionName);
    }

    [Fact]
    public void ToDtoWithGroupList_EnrichesEveryRow()
    {
        var group = new TableGroup { Id = 5, Name = "Window booths", CombinedSeats = 8 };
        group.Members.Add(Member(2, "T2"));
        group.Members.Add(Member(3, "T3"));

        List<BookingDto> dtos = Mapper.ToDtoWithGroupList([GroupBooking(group), GroupBooking(group)]).ToList();

        Assert.Equal(2, dtos.Count);
        Assert.All(dtos, d =>
        {
            Assert.Equal(5, d.TableGroupId);
            Assert.Equal("Window booths", d.TableName);
            Assert.Equal(8, d.TableSeats);
        });
    }
}
