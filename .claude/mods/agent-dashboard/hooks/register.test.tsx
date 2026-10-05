import { expect, test } from 'claude-code/testing'

test('a created task shows in the band with its progress count', async ($, on) => {
  // Stand in for the engine: the TaskCreate tool answers with a new task id.
  on('tool.call', { tool: 'TaskCreate' }, () => ({
    result: { task: { id: '7', subject: 'Add validators' } },
  }))

  await $.tool.call({
    tool: 'TaskCreate',
    subject: 'Add validators',
    description: 'Zod schemas for suppliers',
  })

  const ui = await $.ui.mount({
    plugin: 'agent-dashboard',
    surface: 'terminal',
    component: 'AbovePrompt',
    props: { hasSurvey: false, isWorking: true, maxRows: 10, bodyColumns: 100 },
  })

  expect(await ui.find({ type: 'Text', text: /Progress 0\/1/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Add validators/ })).toBeDefined()
  await ui.unmount()
})

test('a failed edit is marked as failed, not left looking in progress', async ($, on) => {
  on('tool.call', { tool: 'Edit' }, () => ({ result: 'File must be read first', isError: true }))

  await $.tool.call({
    tool: 'Edit',
    file_path: '/repo/frontend/components/app/shell/nav-icons.tsx',
    old_string: 'a',
    new_string: 'b',
  })

  const ui = await $.ui.mount({
    plugin: 'agent-dashboard',
    surface: 'terminal',
    component: 'AbovePrompt',
    props: { hasSurvey: false, isWorking: true, maxRows: 10, bodyColumns: 100 },
  })

  expect(await ui.find({ type: 'Text', text: /✗ shell\/nav-icons\.tsx — edit failed/ })).toBeDefined()
  await ui.unmount()
})
