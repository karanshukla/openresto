namespace OpenRestoApi.Core.Application.Settings;

/// <summary>
/// Bound from the <c>Audit</c> configuration section. Self-hosters keep this table in the same
/// SQLite file as everything else, so it has to have an end — without a retention pass the log
/// grows forever on an instance nobody ever looks at, and the GDPR position gets worse over time
/// rather than better.
/// </summary>
public class AuditSettings
{
    public const int DefaultRetentionDays = 365;

    /// <summary>
    /// How long an entry is kept. Zero or negative disables the pass entirely — for an operator
    /// who ships entries elsewhere and wants the local table left alone.
    /// </summary>
    public int RetentionDays { get; set; } = DefaultRetentionDays;

    public bool IsRetentionEnabled => RetentionDays > 0;
}
