const MAX_ATTEMPTS = 5
const LOCK_DURATION_MS = 15 * 60 * 1000

interface AttemptRecord {
  count: number
  lockedUntil: Date | null
}

// In-memory store — resets on cold start (acceptable for MVP; upgrade to Redis for multi-instance)
const store = new Map<string, AttemptRecord>()

function getRecord(email: string): AttemptRecord {
  const record = store.get(email)
  if (!record) return { count: 0, lockedUntil: null }
  // Expira o bloqueio automaticamente
  if (record.lockedUntil && record.lockedUntil <= new Date()) {
    store.delete(email)
    return { count: 0, lockedUntil: null }
  }
  return record
}

export const loginRateLimit = {
  check(email: string): { locked: boolean; attemptsLeft: number; waitMinutes: number } {
    const record = getRecord(email)
    if (record.lockedUntil) {
      const waitMs = record.lockedUntil.getTime() - Date.now()
      return { locked: true, attemptsLeft: 0, waitMinutes: Math.ceil(waitMs / 60000) }
    }
    return { locked: false, attemptsLeft: MAX_ATTEMPTS - record.count, waitMinutes: 0 }
  },

  increment(email: string): { locked: boolean; attemptsLeft: number; waitMinutes: number } {
    const record = getRecord(email)
    record.count += 1
    if (record.count >= MAX_ATTEMPTS) {
      record.lockedUntil = new Date(Date.now() + LOCK_DURATION_MS)
      store.set(email, record)
      return { locked: true, attemptsLeft: 0, waitMinutes: 15 }
    }
    store.set(email, record)
    return { locked: false, attemptsLeft: MAX_ATTEMPTS - record.count, waitMinutes: 0 }
  },

  reset(email: string): void {
    store.delete(email)
  },
}
