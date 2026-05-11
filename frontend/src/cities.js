const POPULAR_CITY_NAMES = [
  "Pune",
  "Solapur",
  "Mumbai",
  "New York",
  "Tokyo",
  "Dubai",
  "London",
  "Paris",
  "Sydney",
  "Delhi",
  "Singapore",
  "Toronto",
  "Berlin",
  "Madrid",
  "Rome",
  "Seoul",
  "Bangkok",
  "Los Angeles",
];

let allCityOptions = null;
let popularCityOptions = null;

const normalize = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

async function ensureCitiesLoaded() {
  if (allCityOptions && popularCityOptions) return;

  const { City, Country, State } = await import("country-state-city");
  const countries = new Map(Country.getAllCountries().map((country) => [country.isoCode, country.name]));
  const states = new Map(
    State.getAllStates().map((state) => [`${state.countryCode}:${state.isoCode}`, state.name])
  );

  allCityOptions = City.getAllCities()
    .map((city) => {
      const country = countries.get(city.countryCode) || city.countryCode;
      const state = states.get(`${city.countryCode}:${city.stateCode}`) || "";
      const label = [city.name, state, country].filter(Boolean).join(", ");

      return {
        value: city.name,
        label,
        city: city.name,
        state,
        country,
        searchText: normalize(`${city.name} ${state} ${country}`),
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label));

  popularCityOptions = POPULAR_CITY_NAMES.map((name) => {
    const normalizedName = normalize(name);
    return allCityOptions.find(
      (option) =>
        normalize(option.city) === normalizedName &&
        (!["Paris", "London", "Sydney"].includes(name) || option.country !== "United States")
    );
  }).filter(Boolean);
}

export async function getPopularCityOptions() {
  await ensureCitiesLoaded();
  return popularCityOptions;
}

export async function searchCityOptions(inputValue, limit = 80) {
  await ensureCitiesLoaded();

  const query = normalize(inputValue);
  if (query.length < 2) return popularCityOptions;

  const results = [];

  for (const option of allCityOptions) {
    if (normalize(option.city).startsWith(query)) results.push(option);
    if (results.length >= limit) return results;
  }

  for (const option of allCityOptions) {
    if (!normalize(option.city).startsWith(query) && option.searchText.includes(query)) {
      results.push(option);
    }
    if (results.length >= limit) return results;
  }

  return results;
}
