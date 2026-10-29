import type { Enums } from './database.types'

export type AppRole = Enums<'app_role'>

export const ALL_ROLES: AppRole[] = ['admin', 'underwriter', 'finance', 'claims', 'management']

/** Who can do what in the UI. The database (RLS + functions) enforces the same rules. */
export const can = {
  viewDashboard: (r: AppRole | null) => r === 'admin' || r === 'management',
  editSubmissions: (r: AppRole | null) => r === 'admin' || r === 'underwriter',
  manageAdmin: (r: AppRole | null) => r === 'admin',
  /** Receipts, allocations, write-offs, settling return premium. */
  manageFinance: (r: AppRole | null) => r === 'admin' || r === 'finance',
}
