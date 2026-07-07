namespace OpenRestoApi.Core.Application.Exceptions;

// Status-oriented exception hierarchy. Each type encodes the HTTP status the
// GlobalExceptionHandler should map it to. The type itself is the discriminator;
// no int StatusCode leaks into the domain layer.
//
// Note on the Conflict vs. BusinessRule split: InvalidOperationException used to
// map to *both* 409 (booking-overlap flows) and 400 (admin-edit / same-email flows)
// depending on the controller. The split here preserves each controller's
// pre-Bundle-6 status exactly — a service throws ConflictException when its caller
// returned 409 today, and BusinessRuleException when its caller returned 400.

[Serializable]
public abstract class OpenRestoException : Exception
{
    protected OpenRestoException() { }
    protected OpenRestoException(string message) : base(message) { }
    protected OpenRestoException(string message, Exception inner) : base(message, inner) { }
}

// 404 — resource does not exist.
[Serializable]
public sealed class NotFoundException : OpenRestoException
{
    public NotFoundException() { }
    public NotFoundException(string message) : base(message) { }
    public NotFoundException(string message, Exception inner) : base(message, inner) { }
}

// 400 — malformed or invalid input (bad shape/value before any state is consulted).
[Serializable]
public sealed class ValidationException : OpenRestoException
{
    public ValidationException() { }
    public ValidationException(string message) : base(message) { }
    public ValidationException(string message, Exception inner) : base(message, inner) { }
}

// 409 — concurrent-state clash: the resource already holds a conflicting booking/hold.
[Serializable]
public sealed class ConflictException : OpenRestoException
{
    public ConflictException() { }
    public ConflictException(string message) : base(message) { }
    public ConflictException(string message, Exception inner) : base(message, inner) { }
}

// 400 — a domain rule blocks the action given the current state (paused, walk-in,
// past, seats-exceeded in admin/edit context, same-email). Resolved by changing the
// request, not by retrying.
[Serializable]
public sealed class BusinessRuleException : OpenRestoException
{
    public BusinessRuleException() { }
    public BusinessRuleException(string message) : base(message) { }
    public BusinessRuleException(string message, Exception inner) : base(message, inner) { }
}

// 500 — infrastructure/config failure (email not configured, admin password missing,
// SMTP). Surfaces to the client as a generic 500 in non-Development environments.
[Serializable]
public sealed class InfrastructureException : OpenRestoException
{
    public InfrastructureException() { }
    public InfrastructureException(string message) : base(message) { }
    public InfrastructureException(string message, Exception inner) : base(message, inner) { }
}
