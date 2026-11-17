const isLocalHost =
  typeof window !== "undefined" &&
  ["localhost", "127.0.0.1"].includes(window.location.hostname)

const configuredBaseUrl =
  (isLocalHost && window.location.port === "10000"
    ? ""
    : import.meta.env.VITE_WHATSAPP_API_URL?.trim()) ||
  (isLocalHost
    ? "http://localhost:10000"
    : import.meta.env.PROD
      ? "https://loto-whatsapp.onrender.com"
      : "http://localhost:10000")
const whatsappApiBaseUrl = configuredBaseUrl.replace(/\/+$/, "")

export function whatsappApiUrl(endpoint: "status" | "history" | "reminder") {
  return `${whatsappApiBaseUrl}/api/whatsapp/${endpoint}`
}
