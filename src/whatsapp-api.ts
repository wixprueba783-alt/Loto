const configuredBaseUrl =
  import.meta.env.VITE_WHATSAPP_API_URL?.trim() ||
  (import.meta.env.PROD
    ? "https://loto-whatsapp.onrender.com"
    : "http://localhost:10000")
const whatsappApiBaseUrl = configuredBaseUrl.replace(/\/+$/, "")

export function whatsappApiUrl(endpoint: "status" | "history" | "reminder") {
  return `${whatsappApiBaseUrl}/api/whatsapp/${endpoint}`
}
