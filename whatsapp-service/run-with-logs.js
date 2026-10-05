import { spawn } from "node:child_process"
import { createWriteStream, mkdirSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const serviceDirectory = path.dirname(fileURLToPath(import.meta.url))
const projectDirectory = path.resolve(serviceDirectory, "..")
const logDirectory = path.join(serviceDirectory, "logs")
const logFile = path.join(logDirectory, "service.log")

mkdirSync(logDirectory, { recursive: true })

const log = createWriteStream(logFile, { flags: "a" })
const service = spawn(
  process.execPath,
  [path.join(serviceDirectory, "server.js")],
  {
    cwd: projectDirectory,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  },
)

service.stdout.pipe(log, { end: false })
service.stderr.pipe(log, { end: false })

service.once("error", (error) => {
  log.write(`No se pudo iniciar el servicio de WhatsApp: ${error.stack ?? error}\n`)
  log.end(() => {
    process.exitCode = 1
  })
})

service.once("exit", (code, signal) => {
  log.write(`El servicio finalizó (código ${code ?? "n/a"}, señal ${signal ?? "n/a"}).\n`)
  log.end(() => {
    process.exitCode = code ?? 1
  })
})

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => {
    if (!service.killed) service.kill(signal)
  })
}
