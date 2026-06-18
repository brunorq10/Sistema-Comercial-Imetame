export const logger = {
  info(context: string, ...args: unknown[]): void {
    console.log(`[INFO] ${context}`, ...args)
  },
  warn(context: string, ...args: unknown[]): void {
    console.warn(`[WARN] ${context}`, ...args)
  },
  error(context: string, ...args: unknown[]): void {
    console.error(`[ERROR] ${context}`, ...args)
  },
}
