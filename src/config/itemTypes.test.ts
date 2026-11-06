import { describe, expect, it } from 'vitest'
import portalSchema from '../../public/portal.config.schema.json'
import {
  coverRequiredAppearances,
  homepageItemTypeContract,
  supportedAppearances,
} from './itemTypes'

describe('homepage item type contract', () => {
  it('publishes unique appearances including essay and cover requirements', () => {
    const appearances = homepageItemTypeContract.itemTypes.map((item) => item.appearance)
    expect(new Set(appearances).size).toBe(appearances.length)
    expect([...supportedAppearances]).toEqual(appearances)
    expect(supportedAppearances.has('essay')).toBe(true)
    expect([...coverRequiredAppearances]).toEqual(['browser', 'book', 'disc', 'gallery'])
  })

  it('keeps the portal config schema in sync with the published contract', () => {
    expect(portalSchema.$defs.content.properties.appearance.enum).toEqual(
      homepageItemTypeContract.itemTypes.map((item) => item.appearance),
    )
  })
})
