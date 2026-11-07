import assert from "node:assert/strict"
import test from "node:test"

import { getCorsHeaders, parseAllowedOrigins } from "./cors.js"

test("parses and normalizes allowed web origins", () => {
  assert.deepEqual(
    [...parseAllowedOrigins(" https://loto.vercel.app/, http://localhost:5173 ")],
    ["https://loto.vercel.app", "http://localhost:5173"],
  )
})

test("allows the production Vercel origin by default", () => {
  assert.deepEqual(
    [...parseAllowedOrigins()],
    ["https://loto-nails.vercel.app"],
  )
})

test("ignores invalid entries in the allowed-origin configuration", () => {
  assert.deepEqual(
    [...parseAllowedOrigins("https://loto.vercel.app/path, not-a-url")],
    [],
  )
})

test("allows the same origin without adding CORS headers", () => {
  assert.deepEqual(
    getCorsHeaders(
      "https://loto.onrender.com",
      "https://loto.onrender.com",
      new Set(),
    ),
    {},
  )
})

test("returns CORS headers only for an explicitly allowed origin", () => {
  const allowedOrigins = parseAllowedOrigins("https://loto.vercel.app")

  assert.deepEqual(
    getCorsHeaders("https://loto.vercel.app", "https://loto.onrender.com", allowedOrigins),
    {
      "Access-Control-Allow-Origin": "https://loto.vercel.app",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
      "Access-Control-Max-Age": "600",
      Vary: "Origin",
    },
  )
  assert.equal(
    getCorsHeaders("https://other.example", "https://loto.onrender.com", allowedOrigins),
    null,
  )
})
