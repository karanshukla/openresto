namespace OpenRestoApi.Core.Domain;

public static class BookingRefGenerator
{
    private static readonly string[] _adjectives =
    [
        "crispy", "golden", "smoky", "rustic", "zesty", "tender", "glazed",
        "roasted", "grilled", "braised", "fresh", "savory", "spiced", "toasted",
        "charred", "caramelized", "marinated", "flambéed", "infused", "smoked"
    ];

    private static readonly string[] _foods =
    [
        "basil", "saffron", "truffle", "thyme", "olive", "pepper", "mango",
        "lemon", "ginger", "garlic", "mint", "parsley", "rosemary", "vanilla",
        "paprika", "cumin", "fennel", "tarragon", "cardamom", "coriander",
        "turmeric", "clove", "nutmeg", "anise", "dill", "chive", "sage",
        "oregano", "mustard", "cinnamon"
    ];

    private static readonly Random _rng = Random.Shared;

    public static string Generate()
    {
        string adj = _adjectives[_rng.Next(_adjectives.Length)];
        string food1 = _foods[_rng.Next(_foods.Length)];
        string food2;
        do { food2 = _foods[_rng.Next(_foods.Length)]; }
        while (food2 == food1);

        return $"{adj}-{food1}-{food2}";
    }
}
