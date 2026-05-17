import { describe, it, expect } from 'vitest'
import React from 'react'
import { render } from 'ink-testing-library'
import { NavSidebar } from '../../src/components/NavSidebar.js'

describe('NavSidebar', () => {
  it('renders nothing when panes < 3', () => {
    const { lastFrame } = render(React.createElement(NavSidebar, { panes: 1, currentScreen: 'TreeNavigator' }))
    expect(lastFrame()).toBe('')
  })

  it('renders route labels and shortcuts when panes === 3', () => {
    const { lastFrame } = render(React.createElement(NavSidebar, { panes: 3, currentScreen: 'TreeNavigator' }))
    const frame = lastFrame()
    expect(frame).toContain('tree')
    expect(frame).toContain('spawn')
  })

  it('highlights current screen with > marker', () => {
    const { lastFrame } = render(React.createElement(NavSidebar, { panes: 3, currentScreen: 'Spawn' }))
    const frame = lastFrame()
    expect(frame).toContain('>')
  })

  it('displays shortcut keys h, s, o for tree, spawn, orchestrate', () => {
    const { lastFrame } = render(React.createElement(NavSidebar, { panes: 3, currentScreen: 'TreeNavigator' }))
    const frame = lastFrame()
    expect(frame).toContain('h')
    expect(frame).toContain('s')
    expect(frame).toContain('o')
  })
})
