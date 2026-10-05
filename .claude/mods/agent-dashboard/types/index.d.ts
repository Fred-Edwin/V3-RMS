export type TaskStatus = 'pending' | 'in_progress' | 'completed'
export type DashTask = { id: string; label: string; status: TaskStatus }
export type DashContext = { percent: number; tokens: number; window: number }
export type DashNow = { file: string; why: string; failed: boolean }

declare module 'claude-code' {
  interface PluginState {
    'agent-dashboard': {
      tasks: DashTask[]
      now: DashNow | null
      context: DashContext | null
    }
  }
}
