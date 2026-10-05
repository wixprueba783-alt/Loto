import { createServer } from "node:http"
import { readFile, stat } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { createWhatsAppService } from "./index.js"

const directory = path.dirname(fileURLToPath(import.meta.url))
const distDirectory = path.resolve(directory, "../dist")
const whatsapp = createWhatsAppService()
const port = Number(process.env.PORT || 10000)

const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".txt", "text/plain; charset=utf-8"],
  [".webp", "image/webp"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
])

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, {
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
  })
  response.end(JSON.stringify(body))
}

async function sendFile(response, filePath) {
  let file = await readFile(filePath)

  if (filePath === path.join(distDirectory, "index.html")) {
    const firebaseConfig = {
      apiKey: process.env.VITE_FIREBASE_API_KEY ?? "",
      authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN ?? "",
      projectId: process.env.VITE_FIREBASE_PROJECT_ID ?? "",
      storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET ?? "",
      messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? "",
      appId: process.env.VITE_FIREBASE_APP_ID ?? "",
    }
    const configJson = JSON.stringify(firebaseConfig).replace(/</g, "\\u003c")
    const html = file
      .toString("utf8")
      .replace(
        "</head>",
        `<script>window.__LOTO_FIREBASE_CONFIG__=${configJson}</script></head>`,
      )
    file = Buffer.from(html)
  }

  response.writeHead(200, {
    "Cache-Control": filePath.includes(`${path.sep}assets${path.sep}`)
      ? "public, max-age=31536000, immutable"
      : "no-cache",
    "Content-Length": file.length,
    "Content-Type":
      contentTypes.get(path.extname(filePath).toLowerCase()) ??
      "application/octet-stream",
    "X-Content-Type-Options": "nosniff",
  })
  response.end(file)
}

const server = createServer(async (request, response) => {
  let pathname

  try {
    pathname = decodeURIComponent(
      new URL(request.url ?? "/", "http://localhost").pathname,
    )
  } catch {
    sendJson(response, 400, { message: "La ruta solicitada no es válida." })
    return
  }

  if (pathname === "/healthz") {
    sendJson(response, 200, { ok: true })
    return
  }

  if (pathname === "/api/whatsapp/status") {
    if (request.method !== "GET") {
      response.writeHead(405, { Allow: "GET" })
      response.end()
      return
    }

    const authorization = request.headers.authorization
    const token =
      typeof authorization === "string" && authorization.startsWith("Bearer ")
        ? authorization.slice(7)
        : ""

    try {
      await whatsapp.authorizeAdmin(token)
      sendJson(response, 200, whatsapp.getStatus())
    } catch (error) {
      const statusCode =
        typeof error === "object" && error !== null && "statusCode" in error
          ? Number(error.statusCode)
          : 500
      sendJson(response, statusCode, {
        message:
          error instanceof Error
            ? error.message
            : "No se pudo consultar WhatsApp.",
      })
    }
    return
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD" })
    response.end()
    return
  }

  const normalizedPath = pathname.replace(/[\\/]+/g, path.sep).replace(/^\\/, "")
  const requestedFile = path.resolve(distDirectory, `.${path.sep}${normalizedPath}`)
  const distPrefix = `${distDirectory}${path.sep}`

  if (requestedFile !== distDirectory && !requestedFile.startsWith(distPrefix)) {
    sendJson(response, 403, { message: "Ruta no permitida." })
    return
  }

  try {
    const filePath =
      pathname === "/" || path.extname(requestedFile) === ""
        ? path.join(distDirectory, "index.html")
        : requestedFile
    const fileInfo = await stat(filePath)

    if (!fileInfo.isFile()) {
      sendJson(response, 404, { message: "No se encontró el recurso." })
      return
    }

    if (request.method === "HEAD") {
      response.writeHead(200, {
        "Content-Length": fileInfo.size,
        "Content-Type":
          contentTypes.get(path.extname(filePath).toLowerCase()) ??
          "application/octet-stream",
      })
      response.end()
      return
    }

    await sendFile(response, filePath)
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      sendJson(response, 404, { message: "No se encontró el recurso." })
      return
    }

    console.error("No se pudo servir la página solicitada:", error)
    sendJson(response, 500, { message: "No se pudo servir la página." })
  }
})

server.listen(port, "0.0.0.0", () => {
  console.log(`Servidor Loto disponible en el puerto ${port}.`)
  void whatsapp.start()
})

async function shutdown() {
  server.close()
  await whatsapp.stop()
  process.exit(0)
}

process.once("SIGINT", () => void shutdown())
process.once("SIGTERM", () => void shutdown())
