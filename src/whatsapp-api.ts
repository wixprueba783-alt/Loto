const configuredBaseUrl = import.meta.env.VITE_WHATSAPP_API_URL?.trim() ?? ""
const whatsappApiBaseUrl = configuredBaseUrl.replace(/\/+$/, "")

export function whatsappApiUrl(endpoint: "status" | "history" | "reminder") {
  return `${whatsappApiBaseUrl}/api/whatsapp/${endpoint}`
}
