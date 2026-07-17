using OpenRestoApi.Core.Application.Exceptions;

namespace OpenRestoApi.Tests.Core;

public class OpenRestoExceptionsTests
{
    private static readonly Exception Inner = new InvalidOperationException("inner failure");

    [Fact]
    public void NotFoundException_ParameterlessConstructor_CreatesInstance()
    {
        var ex = new NotFoundException();

        Assert.IsAssignableFrom<OpenRestoException>(ex);
    }

    [Fact]
    public void NotFoundException_MessageAndInnerConstructor_SetsBoth()
    {
        var ex = new NotFoundException("not found", Inner);

        Assert.Equal("not found", ex.Message);
        Assert.Same(Inner, ex.InnerException);
    }

    [Fact]
    public void ValidationException_ParameterlessConstructor_CreatesInstance()
    {
        var ex = new ValidationException();

        Assert.IsAssignableFrom<OpenRestoException>(ex);
    }

    [Fact]
    public void ValidationException_MessageAndInnerConstructor_SetsBoth()
    {
        var ex = new ValidationException("invalid", Inner);

        Assert.Equal("invalid", ex.Message);
        Assert.Same(Inner, ex.InnerException);
    }

    [Fact]
    public void ConflictException_ParameterlessConstructor_CreatesInstance()
    {
        var ex = new ConflictException();

        Assert.IsAssignableFrom<OpenRestoException>(ex);
    }

    [Fact]
    public void ConflictException_MessageAndInnerConstructor_SetsBoth()
    {
        var ex = new ConflictException("conflict", Inner);

        Assert.Equal("conflict", ex.Message);
        Assert.Same(Inner, ex.InnerException);
    }

    [Fact]
    public void BusinessRuleException_ParameterlessConstructor_CreatesInstance()
    {
        var ex = new BusinessRuleException();

        Assert.IsAssignableFrom<OpenRestoException>(ex);
    }

    [Fact]
    public void BusinessRuleException_MessageAndInnerConstructor_SetsBoth()
    {
        var ex = new BusinessRuleException("business rule violated", Inner);

        Assert.Equal("business rule violated", ex.Message);
        Assert.Same(Inner, ex.InnerException);
    }

    [Fact]
    public void InfrastructureException_ParameterlessConstructor_CreatesInstance()
    {
        var ex = new InfrastructureException();

        Assert.IsAssignableFrom<OpenRestoException>(ex);
    }

    [Fact]
    public void InfrastructureException_MessageAndInnerConstructor_SetsBoth()
    {
        var ex = new InfrastructureException("infra failure", Inner);

        Assert.Equal("infra failure", ex.Message);
        Assert.Same(Inner, ex.InnerException);
    }
}
