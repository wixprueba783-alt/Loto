export function isBrowserConnected(browser) {
  if (!browser) return false

  if (typeof browser.isConnected === "function") {
    try {
      return browser.isConnected()
    } catch {
      return false
    }
  }

  if (typeof browser.connected === "boolean") return browser.connected

  return true
}
