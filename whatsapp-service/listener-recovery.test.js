import assert from "node:assert/strict"

import test from "node:test"

import { listenWithRecovery } from "./listener-recovery.js"

test("recreates a Firestore listener after an error and stops cleanly", async () => {
  const subscriptions = []

  const receivedSnapshots = []

  let unsubscribeCount = 0

  const stop = listenWithRecovery(
    "appointments",

    (onSnapshot, onError) => {
      subscriptions.push({ onSnapshot, onError })

      return () => {
        unsubscribeCount += 1
      }
    },

    (snapshot) => receivedSnapshots.push(snapshot),
  )

  subscriptions[0].onSnapshot("initial")

  subscriptions[0].onError(new Error("temporary Firestore failure"))

  await new Promise((resolve) => setTimeout(resolve, 1_100))

  assert.equal(subscriptions.length, 2)

  assert.equal(unsubscribeCount, 1)

  subscriptions[1].onSnapshot("recovered")

  stop()
  subscriptions[1].onSnapshot("after stop")
  await new Promise((resolve) => setTimeout(resolve, 1_100))

  assert.deepEqual(receivedSnapshots, ["initial", "recovered"])
  assert.equal(unsubscribeCount, 2)
  assert.equal(subscriptions.length, 2)
})
