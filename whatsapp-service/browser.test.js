import assert from "node:assert/strict"
import test from "node:test"

import { isBrowserConnected } from "./browser.js"

test("supports Puppeteer browser objects with isConnected()", () => {
  assert.equal(isBrowserConnected({ isConnected: () => true }), true)
})

test("supports browser objects without isConnected()", () => {
  assert.equal(isBrowserConnected({ connected: true }), true)
  assert.equal(isBrowserConnected({ connected: false }), false)
  assert.equal(isBrowserConnected({}), true)
})

test("treats missing or broken connections as disconnected", () => {
  assert.equal(isBrowserConnected(undefined), false)
  assert.equal(
    isBrowserConnected({
      isConnected: () => {
        throw new Error("browser closed")
      },
    }),
    false,
  )
})
