"""Static country reference data (ISO code, name, primary currency)."""

COUNTRY_REFERENCE: list[dict[str, str]] = [
    {"iso_code": "IND", "name": "India", "currency_code": "INR"},
    {"iso_code": "USA", "name": "United States", "currency_code": "USD"},
    {"iso_code": "GBR", "name": "United Kingdom", "currency_code": "GBP"},
    {"iso_code": "DEU", "name": "Germany", "currency_code": "EUR"},
    {"iso_code": "FRA", "name": "France", "currency_code": "EUR"},
    {"iso_code": "AUS", "name": "Australia", "currency_code": "AUD"},
    {"iso_code": "CAN", "name": "Canada", "currency_code": "CAD"},
    {"iso_code": "SGP", "name": "Singapore", "currency_code": "SGD"},
    {"iso_code": "JPN", "name": "Japan", "currency_code": "JPY"},
    {"iso_code": "CHN", "name": "China", "currency_code": "CNY"},
    {"iso_code": "KOR", "name": "South Korea", "currency_code": "KRW"},
    {"iso_code": "BRA", "name": "Brazil", "currency_code": "BRL"},
    {"iso_code": "MEX", "name": "Mexico", "currency_code": "MXN"},
    {"iso_code": "ZAF", "name": "South Africa", "currency_code": "ZAR"},
    {"iso_code": "ARE", "name": "United Arab Emirates", "currency_code": "AED"},
    {"iso_code": "SAU", "name": "Saudi Arabia", "currency_code": "SAR"},
    {"iso_code": "NLD", "name": "Netherlands", "currency_code": "EUR"},
    {"iso_code": "CHE", "name": "Switzerland", "currency_code": "CHF"},
    {"iso_code": "SWE", "name": "Sweden", "currency_code": "SEK"},
    {"iso_code": "NOR", "name": "Norway", "currency_code": "NOK"},
    {"iso_code": "DNK", "name": "Denmark", "currency_code": "DKK"},
    {"iso_code": "POL", "name": "Poland", "currency_code": "PLN"},
    {"iso_code": "ITA", "name": "Italy", "currency_code": "EUR"},
    {"iso_code": "ESP", "name": "Spain", "currency_code": "EUR"},
    {"iso_code": "IRL", "name": "Ireland", "currency_code": "EUR"},
    {"iso_code": "NZL", "name": "New Zealand", "currency_code": "NZD"},
    {"iso_code": "HKG", "name": "Hong Kong", "currency_code": "HKD"},
    {"iso_code": "MYS", "name": "Malaysia", "currency_code": "MYR"},
    {"iso_code": "THA", "name": "Thailand", "currency_code": "THB"},
    {"iso_code": "IDN", "name": "Indonesia", "currency_code": "IDR"},
    {"iso_code": "PHL", "name": "Philippines", "currency_code": "PHP"},
    {"iso_code": "VNM", "name": "Vietnam", "currency_code": "VND"},
    {"iso_code": "PAK", "name": "Pakistan", "currency_code": "PKR"},
    {"iso_code": "BGD", "name": "Bangladesh", "currency_code": "BDT"},
    {"iso_code": "EGY", "name": "Egypt", "currency_code": "EGP"},
    {"iso_code": "NGA", "name": "Nigeria", "currency_code": "NGN"},
    {"iso_code": "KEN", "name": "Kenya", "currency_code": "KES"},
    {"iso_code": "TUR", "name": "Turkey", "currency_code": "TRY"},
    {"iso_code": "RUS", "name": "Russia", "currency_code": "RUB"},
    {"iso_code": "UKR", "name": "Ukraine", "currency_code": "UAH"},
    {"iso_code": "ISR", "name": "Israel", "currency_code": "ILS"},
    {"iso_code": "ARG", "name": "Argentina", "currency_code": "ARS"},
    {"iso_code": "CHL", "name": "Chile", "currency_code": "CLP"},
    {"iso_code": "COL", "name": "Colombia", "currency_code": "COP"},
    {"iso_code": "PER", "name": "Peru", "currency_code": "PEN"},
    {"iso_code": "CZE", "name": "Czech Republic", "currency_code": "CZK"},
    {"iso_code": "HUN", "name": "Hungary", "currency_code": "HUF"},
    {"iso_code": "ROU", "name": "Romania", "currency_code": "RON"},
    {"iso_code": "PRT", "name": "Portugal", "currency_code": "EUR"},
    {"iso_code": "BEL", "name": "Belgium", "currency_code": "EUR"},
    {"iso_code": "AUT", "name": "Austria", "currency_code": "EUR"},
    {"iso_code": "FIN", "name": "Finland", "currency_code": "EUR"},
    {"iso_code": "GRC", "name": "Greece", "currency_code": "EUR"},
]

ZERO_DECIMAL_CURRENCIES = frozenset(
    {"BIF", "CLP", "DJF", "GNF", "ISK", "JPY", "KMF", "KRW", "PYG", "RWF", "UGX", "VND", "VUV", "XAF", "XOF", "XPF"}
)
THREE_DECIMAL_CURRENCIES = frozenset({"BHD", "IQD", "JOD", "KWD", "LYD", "OMR", "TND"})


def infer_decimal_places(code: str) -> int:
    code = code.upper()
    if code in ZERO_DECIMAL_CURRENCIES:
        return 0
    if code in THREE_DECIMAL_CURRENCIES:
        return 3
    return 2


def get_country_reference(iso_code: str) -> dict[str, str] | None:
    iso_code = iso_code.upper()
    return next((c for c in COUNTRY_REFERENCE if c["iso_code"] == iso_code), None)
