namespace OpenRestoApi.Core.Application.Utilities;

/// <summary>
/// Wording for an online hold or booking that names a table or a combinable group at a location
/// whose guests may only choose a section (<c>Restaurant.GuestsChooseTable</c> off).
/// </summary>
public static class TableChoice
{
    public const string DisabledMessage = "This location picks your table. Choose a section instead.";
}
