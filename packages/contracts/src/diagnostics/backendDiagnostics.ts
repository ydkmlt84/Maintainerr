export type BackendDiagnosticStatus = 'success' | 'warning' | 'error'

export interface BackendDiagnosticCheck {
  id: string
  title: string
  status: BackendDiagnosticStatus
  message: string
}

export interface BackendDiagnostics {
  status: BackendDiagnosticStatus
  checkedAt: string
  checks: BackendDiagnosticCheck[]
}

export interface ImageCacheUsage {
  usedBytes: number
  limitBytes: number
  remainingBytes: number
  percentage: number
}
