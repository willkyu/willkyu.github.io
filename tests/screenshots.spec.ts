import { expect, test } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

const output = resolve('.artifacts/screenshots')

test.beforeAll(() => mkdirSync(output, { recursive: true }))

test('capture review states', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1100)
  const profile = await page.evaluate(() => {
    const rect = document.querySelector('.identity-panel')!.getBoundingClientRect()
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
  })
  expect(profile.width).toBeCloseTo(359, 1)
  expect(profile.height).toBeCloseTo(259, 1)
  expect(profile.x).toBeCloseTo((1440 - profile.width) / 2, 1)
  expect(profile.y).toBeCloseTo((900 - profile.height) / 2, 1)
  await page.screenshot({ path: resolve(output, 'portal-desktop-initial.png') })

  await page.evaluate(() => {
    for (const label of ['Research', 'Blog', 'PM']) {
      const button = [...document.querySelectorAll('button')].find((item) => item.textContent?.includes(label))
      if (button instanceof HTMLButtonElement) button.click()
    }
  })
  await page.waitForTimeout(1200)
  await page.screenshot({ path: resolve(output, 'portal-desktop-multi-window.png') })

  const disc = page.locator('[data-content-id="pokemon-disc"]')
  await expect(disc).toBeVisible()
  const discBox = await disc.boundingBox()
  await disc.hover({ position: { x: discBox!.width * .8, y: discBox!.height * .25 } })
  await page.waitForTimeout(180)
  await page.screenshot({ path: resolve(output, 'portal-disc-parallax.png') })
  await page.mouse.move(0, 0)

  await page.setViewportSize({ width: 1024, height: 768 })
  await page.waitForTimeout(120)
  await page.screenshot({ path: resolve(output, 'portal-tablet-multi-window.png') })

  await page.setViewportSize({ width: 390, height: 844 })
  await page.waitForTimeout(120)
  await page.screenshot({ path: resolve(output, 'portal-mobile-expanded.png') })
})

test('capture disc cover loading state', async ({ page }) => {
  await page.route('**/assets/temporary/disc_cover.png', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1800))
    await route.continue()
  })
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: /PM，1 条内容/ }).click()
  const discArt = page.locator('[data-content-id="pokemon-disc"] .disc-art')
  await expect(discArt).toHaveAttribute('data-state', 'loading')
  await page.waitForTimeout(800)
  await page.screenshot({ path: resolve(output, 'portal-disc-loading.png') })
  await expect(discArt).toHaveAttribute('data-state', 'loaded')
})
