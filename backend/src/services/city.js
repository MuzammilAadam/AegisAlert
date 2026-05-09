export function normalizeCity(value, fallback = "") {
  const city = String(value || "").trim();
  return city || fallback;
}

export function cityFilter(city) {
  return { city: new RegExp(`^${escapeRegex(normalizeCity(city))}$`, "i") };
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
