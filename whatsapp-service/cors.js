function normalizeOrigin(value) {
  try {
    const url = new URL(value)
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    ) {
      return null
    }
    return url.origin
  } catch {
    return null
  }
}

export function parseAllowedOrigins(value = "https://loto-nails.vercel.app") {
  return new Set(
    value
      .split(",")
      .map((origin) => normalizeOrigin(origin.trim()))
      .filter((origin) => origin !== null),
  )
}

export function getCorsHeaders(origin, requestOrigin, allowedOrigins) {
  if (!origin) return {}

  const normalizedOrigin = normalizeOrigin(origin)
  if (
    !normalizedOrigin ||
    (normalizedOrigin !== requestOrigin &&
      !allowedOrigins.has(normalizedOrigin))
  ) {
    return null
  }

  if (normalizedOrigin === requestOrigin) return {}

  return {
    "Access-Control-Allow-Origin": normalizedOrigin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  }
}
