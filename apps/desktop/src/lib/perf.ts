export interface GarlicPerfState {
  entryBootstrapStartedAt?: number
  reactRootCreatedAt?: number
  reactRenderScheduledAt?: number
  firstShellUsefulAt?: number
}

declare global {
  interface Window {
    __garlicPerf?: GarlicPerfState
  }
}

export const nowPerfMs = (): number =>
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now()

export const getGarlicPerfState = (): GarlicPerfState => {
  if (typeof window === 'undefined') return {}
  if (!window.__garlicPerf) window.__garlicPerf = {}
  return window.__garlicPerf
}
