const INITIAL_RETRY_DELAY_MS = 1_000

const MAX_RETRY_DELAY_MS = 60_000

const STABLE_CONNECTION_MS = 60_000

export function listenWithRecovery(label, subscribe, onSnapshot) {
  let stopped = false

  let generation = 0

  let retryCount = 0

  let unsubscribe = () => {}

  let retryTimer

  let stableTimer

  function connect() {
    if (stopped) return

    retryTimer = undefined

    const currentGeneration = ++generation

    let failed = false

    try {
      const stop = subscribe(
        (snapshot) => {
          if (stopped || currentGeneration !== generation) return

          if (!stableTimer) {
            stableTimer = setTimeout(() => {
              stableTimer = undefined

              retryCount = 0
            }, STABLE_CONNECTION_MS)
          }

          onSnapshot(snapshot)
        },

        (error) => {
          failed = true

          if (stopped || currentGeneration !== generation) return

          if (retryTimer) return

          console.error(`Se perdió la escucha de Firestore (${label}):`, error)

          if (stableTimer) clearTimeout(stableTimer)

          stableTimer = undefined

          const delay = Math.min(
            INITIAL_RETRY_DELAY_MS * 2 ** retryCount,

            MAX_RETRY_DELAY_MS,
          )

          retryCount += 1

          console.error(
            `Se reintentará la escucha de Firestore (${label}) en ${delay / 1000} s.`,
          )

          unsubscribe()

          unsubscribe = () => {}

          retryTimer = setTimeout(connect, delay)
        },
      )

      if (failed || stopped || currentGeneration !== generation) {
        stop()
      } else {
        unsubscribe = stop
      }
    } catch (error) {
      failed = true

      if (stopped || currentGeneration !== generation) return

      if (retryTimer) return

      console.error(
        `No se pudo crear la escucha de Firestore (${label}):`,
        error,
      )

      const delay = Math.min(
        INITIAL_RETRY_DELAY_MS * 2 ** retryCount,

        MAX_RETRY_DELAY_MS,
      )

      retryCount += 1

      console.error(
        `Se reintentará la escucha de Firestore (${label}) en ${delay / 1000} s.`,
      )

      retryTimer = setTimeout(connect, delay)
    }
  }

  connect()

  return () => {
    stopped = true

    generation += 1

    if (retryTimer) clearTimeout(retryTimer)

    if (stableTimer) clearTimeout(stableTimer)

    unsubscribe()

    unsubscribe = () => {}
  }
}
