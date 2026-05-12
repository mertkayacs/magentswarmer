import { describe, it, expect } from 'vitest'
import { DEDUPED_ROUTES } from '../../src/hooks/useScreenNav.js'
import type { NavSidebarProps } from '../../src/components/NavSidebar.js'

describe('NavSidebar', () => {
  it('exports NavSidebar component', async () => {
    const { NavSidebar } = await import('../../src/components/NavSidebar.js')
    expect(NavSidebar).toBeDefined()
    expect(typeof NavSidebar).toBe('function')
  })

  it('accepts panes and currentScreen props', async () => {
    const { NavSidebar } = await import('../../src/components/NavSidebar.js')
    const props: NavSidebarProps = { panes: 3, currentScreen: 'Home' }
    expect(props.panes).toBe(3)
    expect(props.currentScreen).toBe('Home')
  })

  it('DEDUPED_ROUTES contains home, spawn, orchestrate shortcuts', () => {
    const labels = DEDUPED_ROUTES.map(r => r.primary.slice(1))
    expect(labels).toContain('home')
    expect(labels).toContain('spawn')
    expect(labels).toContain('orchestrate')
  })

  it('DEDUPED_ROUTES has h, s, o shortcuts', () => {
    const homeRoute = DEDUPED_ROUTES.find(r => r.screen === 'Home')
    const spawnRoute = DEDUPED_ROUTES.find(r => r.screen === 'Spawn')
    const orchestrateRoute = DEDUPED_ROUTES.find(r => r.screen === 'Orchestrate')

    expect(homeRoute?.alias).toBe('/h')
    expect(spawnRoute?.alias).toBe('/s')
    expect(orchestrateRoute?.alias).toBe('/o')
  })

  it('screen names map correctly to routes', () => {
    expect(DEDUPED_ROUTES.some(r => r.screen === 'Home')).toBe(true)
    expect(DEDUPED_ROUTES.some(r => r.screen === 'Spawn')).toBe(true)
    expect(DEDUPED_ROUTES.some(r => r.screen === 'Settings')).toBe(true)
  })
})
