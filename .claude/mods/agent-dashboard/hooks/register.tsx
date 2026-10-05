import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { DashContext, DashNow, DashTask } from '../types'

const tasks = atom({ plugin: 'agent-dashboard', key: 'tasks' } as const, [] as DashTask[])
const now = atom({ plugin: 'agent-dashboard', key: 'now' } as const, null as DashNow | null)
const context = atom({ plugin: 'agent-dashboard', key: 'context' } as const, null as DashContext | null)

const MAX_TASK_ROWS = 6

const MAX_WHY = 160

// The agent is asked (CLAUDE.md) to write a "Why: ..." line before each edit. Only such a
// line counts as a reason, so a stray sentence about something else is never shown as one.
const WHY_LINE = /^\s*Why:\s*(.+)$/gim

const lastWhyLine = (text: string): string => {
  const lines = [...text.matchAll(WHY_LINE)]
  const last = lines[lines.length - 1]
  const why = last?.[1]?.trim() ?? ''
  return why.length > MAX_WHY ? why.slice(0, MAX_WHY - 3) + '...' : why
}

// The last reason shown: a repeat on a later edit is the previous edit's reason, not this one's.
let lastShownWhy = ''

const shortPath = (path: string): string => path.split('/').slice(-2).join('/')

const tokensLabel = (n: number): string => (n >= 1000 ? Math.round(n / 1000) + 'k' : String(n))

const bar = (percent: number): string => {
  const filled = Math.max(0, Math.min(10, Math.round(percent / 10)))
  return '█'.repeat(filled) + '░'.repeat(10 - filled)
}

// Context meter: refreshed whenever something happens that can change it.
async function refreshContext($: EngineInterface): Promise<void> {
  try {
    const usage = await $.session.usage()
    const { tokens, window, percent } = usage.context
    if (tokens === undefined || percent === undefined) return
    await update($, context, () => ({ percent, tokens, window }))
  } catch {
    // The meter is a convenience; never break a turn over it.
  }
}

async function whyNow($: EngineInterface): Promise<string> {
  try {
    const messages = await $.session.messages()
    // Only the newest assistant message: an edit with no "Why:" of its own shows the file alone.
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i]
      if (m.role === 'assistant') return lastWhyLine(m.text)
    }
  } catch {
    // No reason available; the file name alone is still shown.
  }
  return ''
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await refreshContext($)
    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    // A new request: drop a finished checklist, keep one still in progress.
    await update($, tasks, list => (list.every(t => t.status === 'completed') ? [] : list))
    await update($, now, () => null)
    return next(e)
  })

  // ---- Checklist -----------------------------------------------------------

  on('tool.call', { tool: 'TodoWrite' }, async ($, e, next) => {
    const ran = await next(e)
    if (ran.deny === undefined && ran.isError !== true) {
      await update($, tasks, () =>
        e.todos.map((t, i) => ({ id: String(i), label: t.content, status: t.status })),
      )
    }
    return ran
  })

  on('tool.call', { tool: 'TaskCreate' }, async ($, e, next) => {
    const ran = await next(e)
    if (ran.deny === undefined && ran.isError !== true) {
      const id = ran.result?.task?.id ?? String(Date.now())
      await update($, tasks, list => [...list, { id, label: e.subject, status: 'pending' as const }])
    }
    return ran
  })

  on('tool.call', { tool: 'TaskUpdate' }, async ($, e, next) => {
    const ran = await next(e)
    if (ran.deny === undefined && ran.isError !== true) {
      await update($, tasks, list =>
        e.status === 'deleted'
          ? list.filter(t => t.id !== e.taskId)
          : list.map(t =>
              t.id === e.taskId
                ? { ...t, label: e.subject ?? t.label, status: e.status ?? t.status }
                : t,
            ),
      )
    }
    return ran
  })

  // ---- What is being edited, and why --------------------------------------

  for (const tool of ['Edit', 'Write'] as const) {
    on('tool.call', { tool }, async ($, e, next) => {
      const found = await whyNow($)
      const why = found === lastShownWhy ? '' : found
      if (why !== '') lastShownWhy = why
      const file = shortPath(e.file_path)
      await update($, now, () => ({ file, why, failed: false }))
      const ran = await next(e)
      // A refused or failed edit changed nothing: say so instead of leaving it looking in progress.
      if (ran.deny !== undefined || ran.isError === true) {
        await update($, now, () => ({ file, why: '', failed: true }))
      }
      await refreshContext($)
      return ran
    })
  }

  on('turn.complete', async ($, e, next) => {
    await refreshContext($)
    await update($, now, () => null)
    return next(e)
  })

  // ---- The band ------------------------------------------------------------

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const list = await read($, tasks)
    const current = await read($, now)
    const ctx = await read($, context)

    if (e.props.hasSurvey || (list.length === 0 && current === null && ctx === null)) {
      return next(e)
    }

    const { Box, Text } = $.ui.resolve(e)

    const done = list.filter(t => t.status === 'completed').length
    const open = list.filter(t => t.status !== 'completed')
    const recentDone = list.filter(t => t.status === 'completed').slice(-2)
    const shown = [...recentDone, ...open].slice(0, MAX_TASK_ROWS)
    const hidden = list.length - shown.length

    const ctxColor = ctx === null ? undefined : ctx.percent >= 80 ? 'red' : ctx.percent >= 60 ? 'yellow' : 'green'

    return (
      <Box flexDirection="column">
        {list.length > 0 && (
          <Text bold>
            Progress {done}/{list.length}
          </Text>
        )}
        {shown.map(t => (
          <Text
            key={t.id}
            dimColor={t.status !== 'in_progress'}
            bold={t.status === 'in_progress'}
            color={t.status === 'in_progress' ? 'cyan' : undefined}
          >
            {t.status === 'completed' ? '  ✓ ' : t.status === 'in_progress' ? '  ● ' : '  ○ '}
            {t.label}
          </Text>
        ))}
        {hidden > 0 && <Text dimColor>{'  '}+{hidden} more</Text>}
        {current !== null && (
          <Text color={current.failed ? 'red' : undefined}>
            {current.failed ? '✗ ' : '▸ '}
            {current.file}
            {current.failed ? ' — edit failed, the agent will retry' : current.why !== '' ? ' — ' + current.why : ''}
          </Text>
        )}
        {ctx !== null && (
          <Text color={ctxColor}>
            Context {bar(ctx.percent)} {Math.round(ctx.percent)}% ({tokensLabel(ctx.tokens)}/{tokensLabel(ctx.window)})
          </Text>
        )}
      </Box>
    )
  })
}
