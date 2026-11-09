import { expect, test } from '@playwright/test'

test('introduces the centre, then entry blocks and the parallax reference credit', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page).toHaveTitle("willkyu's portal")
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href', '/assets/temporary/favicon.png')
  await expect(page.getByText('LOADING PORTAL…')).toHaveCount(0)

  const profile = page.locator('.identity-panel')
  await expect(profile).toBeVisible()
  await expect(profile).toHaveCSS('animation-name', 'item-popup')
  await expect(profile.getByRole('heading', { name: 'willkyu', exact: true })).toBeVisible()
  await expect(profile.getByRole('heading', { name: 'willkyu', exact: true })).toHaveCSS('letter-spacing', '-1px')

  const characterLayers = profile.locator('.character-layer')
  await expect(characterLayers).toHaveCount(4)
  await expect(profile.locator('.character-layer--base')).toHaveAttribute('src', '/assets/character/37.png')
  await expect(profile.locator('.character-layer--eye')).toHaveCount(2)
  const foreground = profile.locator('.character-layer--foreground')
  await expect(foreground).toHaveAttribute('src', '/assets/character/37-cover-v2.png')
  expect(Number(await foreground.evaluate((node) => getComputedStyle(node).zIndex))).toBeGreaterThan(3)
  const eye = profile.locator('.character-layer--eye').first()
  await page.mouse.move(1, 1)
  await expect.poll(async () => eye.evaluate((node) => new DOMMatrix(getComputedStyle(node).transform).m42)).toBeLessThan(-4.8)
  const upperEyeY = await eye.evaluate((node) => new DOMMatrix(getComputedStyle(node).transform).m42)
  await page.mouse.move(1439, 899)
  await expect.poll(async () => eye.evaluate((node) => new DOMMatrix(getComputedStyle(node).transform).m41)).toBeGreaterThan(4.8)
  await expect.poll(async () => eye.evaluate((node) => new DOMMatrix(getComputedStyle(node).transform).m42)).toBeGreaterThan(1.8)
  const lowerEyeY = await eye.evaluate((node) => new DOMMatrix(getComputedStyle(node).transform).m42)
  expect(lowerEyeY - upperEyeY).toBeGreaterThan(6.7)
  await expect(foreground).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)')

  const links = page.locator('.physics-link-card')
  await expect(links).toHaveCount(3, { timeout: 2_000 })
  for (const box of await links.evaluateAll((nodes) => nodes.map((node) => {
    const rect = node.getBoundingClientRect()
    return { width: rect.width, height: rect.height }
  }))) {
    expect(Math.abs(box.width - box.height)).toBeLessThan(.5)
  }
  await expect(links.first()).toHaveCSS('animation-name', 'none')
  const firstLinkItem = page.locator('.physics-item.popup-item').filter({ has: page.locator('.physics-link-card') }).first()
  await expect(firstLinkItem).toHaveCSS('animation-name', 'item-popup')
  await expect(firstLinkItem).toHaveCSS('animation-duration', '0.56s')
  await page.evaluate(() => window.dispatchEvent(new Event('blur')))
  const linkLabelOffsets = await links.evaluateAll((nodes) => nodes.map((node) => {
    const card = node.getBoundingClientRect()
    const label = node.querySelector('i')!.getBoundingClientRect()
    return {
      x: Math.abs(card.x + card.width / 2 - (label.x + label.width / 2)),
      y: Math.abs(card.y + card.height / 2 - (label.y + label.height / 2)),
    }
  }))
  for (const offset of linkLabelOffsets) {
    expect(offset.x).toBeLessThan(.25)
    expect(offset.y).toBeLessThan(.25)
  }

  const credit = page.getByRole('link', { name: '感谢并访问参考主页 NIKUKIKAI.ART' })
  await expect(credit).toBeVisible({ timeout: 2_000 })
  await expect(credit).toHaveAttribute('href', 'https://nikukikai.art/')
  const creditItem = page.locator('.physics-credit')
  const arrowOffset = await credit.evaluate((node) => {
    const card = node.getBoundingClientRect()
    const arrow = node.querySelector('i')!.getBoundingClientRect()
    return Math.abs(card.y + card.height / 2 - (arrow.y + arrow.height / 2))
  })
  expect(arrowOffset).toBeLessThan(.5)
  await creditItem.hover()
  expect(Number(await creditItem.evaluate((node) => getComputedStyle(node).zIndex))).toBeGreaterThanOrEqual(1000)
  await creditItem.evaluate((node) => {
    const rect = node.getBoundingClientRect()
    node.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerType: 'mouse', clientX: rect.left + rect.width * .85, clientY: rect.top + rect.height * .2 }))
  })
  await expect.poll(async () => credit.evaluate((node) => new DOMMatrix(getComputedStyle(node).transform).m41)).toBeGreaterThan(1)
  const creditLayers = await credit.evaluate((node) => ({
    surface: getComputedStyle(node).transform,
    surfaceX: new DOMMatrix(getComputedStyle(node).transform).m41,
    far: getComputedStyle(node.querySelector('.credit-far')!).transform,
    farBackground: getComputedStyle(node.querySelector('.credit-far')!).backgroundPosition,
    mid: getComputedStyle(node.querySelector('.credit-copy')!).transform,
    near: getComputedStyle(node.querySelector('i')!).transform,
  }))
  expect(creditLayers.surfaceX).toBeGreaterThan(1)
  expect(creditLayers.far).toBe('none')
  expect(creditLayers.farBackground).not.toBe('0px 0px')
  expect(creditLayers.farBackground).not.toBe('0% 0%')
  expect(new Set([creditLayers.far, creditLayers.mid, creditLayers.near]).size).toBe(3)
  expect(creditLayers.far).not.toBe(creditLayers.near)
})

test('loads published feeds before rendering and binds entries without authored ids', async ({ page }) => {
  await page.route('**/blog/homepage-feed.json', (route) => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({
      schemaVersion: 1,
      source: 'blog',
      generatedAt: '2026-11-06T01:00:00.000Z',
      items: [
        { bind: 'research', title: '博客中的研究笔记', summary: '研究摘要。', href: '/blog/research-note/', appearance: 'text', tags: ['研究'], order: 10 },
        { bind: 'pokemon', title: '宝可梦文章', summary: '宝可梦摘要。', href: '/blog/pokemon-note/', appearance: 'text', tags: ['Pokemon'], order: 20 },
      ],
    }),
  }))
  await page.route('**/research/homepage-feed.json', (route) => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({
      schemaVersion: 1,
      source: 'research',
      generatedAt: '2026-11-06T01:00:00.000Z',
      items: [
        { bind: 'research', title: 'SensorLM: Learning the Language of Wearable Sensors', summary: '这是一段用于验证向下展开的论文摘要。\n第二段用于验证换行、缩进与物理碰撞尺寸。', href: '/research/papers/sensorlm', appearance: 'essay', tags: ['论文'], order: 10 },
      ],
    }),
  }))

  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('button', { name: /Research，3 条内容/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Blog，1 条内容/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /PM，1 条内容/ })).toBeVisible()

  await page.getByRole('button', { name: /Research，3 条内容/ }).click()
  const sensor = page.locator('[data-content-id="feed:research:/research/papers/sensorlm"]')
  await expect(sensor).toBeVisible()
  await expect(sensor).toHaveAttribute('data-appearance', 'essay')
  expect(Number(await sensor.getAttribute('data-base-width'))).toBeGreaterThan(180)
  expect(Number(await sensor.getAttribute('data-base-height'))).toBeGreaterThan(64)
  await expect(sensor.getByRole('link', { name: '打开 SensorLM: Learning the Language of Wearable Sensors' })).toHaveAttribute('href', '/research/papers/sensorlm')
  await expect(sensor.locator('.essay-preview')).toBeVisible()
  await expect(sensor.locator('.essay-copy')).toBeHidden()
  await page.waitForTimeout(600)
  const collapsedPreviewMetrics = await sensor.locator('.essay-preview').evaluate((node) => {
    const range = document.createRange()
    range.selectNodeContents(node)
    return {
      renderedLines: range.getClientRects().length,
      previewBottom: node.getBoundingClientRect().bottom,
      cardBottom: node.closest('.card--essay')!.getBoundingClientRect().bottom,
    }
  })
  expect(collapsedPreviewMetrics.renderedLines).toBe(1)
  expect(collapsedPreviewMetrics.previewBottom).toBeLessThanOrEqual(collapsedPreviewMetrics.cardBottom)
  const collapsedEssay = await sensor.boundingBox()
  const expansionTop = await sensor.getByRole('link', { name: '打开 SensorLM: Learning the Language of Wearable Sensors' }).evaluate((link: HTMLAnchorElement) => {
    link.focus({ preventScroll: true })
    return link.closest<HTMLElement>('.physics-content')!.getBoundingClientRect().top
  })
  await expect.poll(async () => (await sensor.boundingBox())!.height).toBeGreaterThan(collapsedEssay!.height * 1.6)
  const expandedEssay = await sensor.boundingBox()
  // Viewport clamping may shift a card spawned near the bottom edge. Its top
  // must still move much less than a vertically recentered expansion would.
  const essayHeightIncrease = expandedEssay!.height - collapsedEssay!.height
  expect(Math.abs(expandedEssay!.y - expansionTop)).toBeLessThan(essayHeightIncrease * .4)
  await expect(sensor.locator('.essay-preview')).toBeHidden()
  await expect(sensor.locator('.essay-copy')).toBeVisible()
  expect(await sensor.locator('.essay-copy > p').first().evaluate((node) => parseFloat(getComputedStyle(node).fontSize))).toBeGreaterThanOrEqual(14)
  await expect(sensor.locator('.essay-copy > p')).toHaveCount(2)
  await expect(sensor.locator('.essay-copy > p').first()).toHaveCSS('text-indent', /28|29|30|31|32|33|34px/)
  await expect(sensor.locator('.essay-fade')).toHaveCSS('height', '50px')
  await expect(sensor.locator('.card--essay')).toHaveCSS('background-color', 'rgb(255, 255, 255)')
  await page.mouse.move(expandedEssay!.x + expandedEssay!.width / 2, expandedEssay!.y + expandedEssay!.height / 2)
  await page.mouse.move(0, 0)
  await sensor.getByRole('link', { name: '打开 SensorLM: Learning the Language of Wearable Sensors' }).evaluate((link: HTMLAnchorElement) => link.blur())
  await expect.poll(async () => (await sensor.boundingBox())!.height).toBeLessThan(expandedEssay!.height * .6)

  await page.getByRole('button', { name: /PM，1 条内容/ }).click()
  const remote = page.locator('[data-content-id="feed:blog:/blog/pokemon-note/"]')
  await expect(remote).toBeVisible()
  const remoteLink = remote.getByRole('link', { name: '打开 宝可梦文章' })
  await expect(remoteLink).toHaveAttribute('href', '/blog/pokemon-note/')
  await expect(remote).toHaveCSS('cursor', 'pointer')
  await expect(page.locator('[data-content-id="pokemon-disc"]')).toHaveCount(0)
})

test('navigates from a card edge after pointer parallax is active', async ({ page }) => {
  await page.route('**/blog/homepage-feed.json', (route) => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({
      schemaVersion: 1,
      source: 'blog',
      generatedAt: '2026-11-06T01:00:00.000Z',
      items: [{ bind: 'pokemon', title: '宝可梦文章', summary: '宝可梦摘要。', href: '/blog/pokemon-note/', appearance: 'text', tags: ['Pokemon'], order: 10 }],
    }),
  }))
  await page.route('**/research/homepage-feed.json', (route) => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ schemaVersion: 1, source: 'research', generatedAt: '2026-11-06T01:00:00.000Z', items: [] }),
  }))
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: /PM，1 条内容/ }).click()
  const remote = page.locator('[data-content-id="feed:blog:/blog/pokemon-note/"]')
  await expect(remote).toBeVisible()
  await remote.evaluate((node) => {
    const rect = node.getBoundingClientRect()
    node.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerType: 'mouse', clientX: rect.left + 8, clientY: rect.top + rect.height / 2 }))
  })
  await expect.poll(async () => Math.abs(parseFloat(await remote.evaluate((node) => getComputedStyle(node).getPropertyValue('--card-tilt-y'))))).toBeGreaterThan(5)
  const box = await remote.boundingBox()
  await Promise.all([
    page.waitForURL('**/blog/pokemon-note/', { waitUntil: 'commit' }),
    page.mouse.click(box!.x + 8, box!.y + box!.height / 2),
  ])
})

test('turns failed feeds into visible 404 fallback cards', async ({ page }) => {
  await page.route('**/blog/homepage-feed.json', (route) => route.fulfill({ status: 404, body: 'missing' }))
  await page.route('**/research/homepage-feed.json', (route) => route.fulfill({ status: 503, body: 'offline' }))

  await page.goto('/', { waitUntil: 'domcontentloaded' })
  const research = page.getByRole('button', { name: /Research，2 条内容/ })
  const blog = page.getByRole('button', { name: /Blog，2 条内容/ })
  await expect(research).toBeVisible()
  await expect(blog).toBeVisible()

  await research.click()
  const researchFallback = page.locator('[data-content-id="feed-error:research"]')
  await expect(researchFallback).toBeVisible()
  await expect(researchFallback.getByRole('heading', { name: 'RESEARCH FEED 404' })).toBeVisible()
  await expect(researchFallback.getByRole('link', { name: '打开 RESEARCH FEED 404' })).toHaveAttribute('href', '/research/')

  await blog.click()
  await expect(page.locator('[data-content-id="feed-error:blog"]')).toBeVisible()
})

test('one click pops in the whole category and keeps physics active', async ({ page }) => {
  await page.route('**/research/homepage-feed.json', (route) => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({
      schemaVersion: 1,
      source: 'research',
      generatedAt: '2026-11-08T01:00:00.000Z',
      items: [{ bind: 'research', title: '基于知识图谱的可穿戴传感器语言模型研究笔记', summary: '用于检查放大后文字保持原有换行。', href: '/research/wrap-test/', appearance: 'text', tags: ['Test'], order: 10 }],
    }),
  }))
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  const research = page.getByRole('button', { name: /Research，2 条内容/ })

  await research.click()
  await expect(page.getByRole('button', { name: /Research，暂无内容/ })).toBeDisabled()
  await expect(page.locator('.physics-content')).toHaveCount(2)
  await expect(page.locator('.physics-content').first()).toHaveCSS('animation-name', 'item-popup')
  await page.waitForTimeout(1400)

  const book = page.locator('[data-content-id="research-notes"]')
  const fontBefore = parseFloat(await book.locator('.book-spine strong').evaluate((node) => getComputedStyle(node).fontSize))
  const titleHeightBefore = (await book.locator('.book-spine strong').boundingBox())!.height
  const transformBefore = await book.evaluate((node) => getComputedStyle(node).transform)
  const before = await book.boundingBox()
  await book.hover()
  await page.waitForTimeout(500)
  const after = await book.boundingBox()
  const fontAfter = parseFloat(await book.locator('.book-spine strong').evaluate((node) => getComputedStyle(node).fontSize))
  const titleHeightAfter = (await book.locator('.book-spine strong').boundingBox())!.height
  expect(after!.width).toBeGreaterThan(before!.width * 1.35)
  expect(after!.height).toBeGreaterThan(before!.height * 1.35)
  expect(fontAfter).toBeCloseTo(fontBefore, 1)
  expect(titleHeightAfter / titleHeightBefore).toBeCloseTo(after!.width / before!.width, 1)
  expect(await book.evaluate((node) => getComputedStyle(node).transform)).not.toBe(transformBefore)

  const textItem = page.locator('[data-content-id="feed:research:/research/wrap-test/"]')
  const textBefore = await textItem.boundingBox()
  const lineCountBefore = await textItem.locator('h3').evaluate((node) => {
    const range = document.createRange()
    range.selectNodeContents(node)
    return new Set([...range.getClientRects()].map((rect) => Math.round(rect.top))).size
  })
  await textItem.hover({ position: { x: 5, y: textBefore!.height / 2 } })
  await page.waitForTimeout(450)
  const textAfter = await textItem.boundingBox()
  const lineCountAfter = await textItem.locator('h3').evaluate((node) => {
    const range = document.createRange()
    range.selectNodeContents(node)
    return new Set([...range.getClientRects()].map((rect) => Math.round(rect.top))).size
  })
  expect(textAfter!.height).toBeGreaterThan(textBefore!.height * 1.8)
  expect(textAfter!.height).toBeLessThan(textBefore!.height * 2.3)
  expect(textAfter!.width).toBeGreaterThan(textBefore!.width * 1.25)
  expect(lineCountAfter).toBe(lineCountBefore)
  await expect(textItem.locator('p')).toHaveCSS('opacity', '1')
  expect(parseFloat(await textItem.locator('p').evaluate((node) => getComputedStyle(node).fontSize))).toBeGreaterThanOrEqual(14)
  expect(await textItem.locator('p').evaluate((node) => getComputedStyle(node).fontFamily)).not.toContain('DotGothic16')
})

test('blank-canvas dragging leaves the fixed scene in place', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 })
  await page.goto('/', { waitUntil: 'domcontentloaded' })

  const profile = page.locator('.identity-panel')
  const credit = page.locator('.physics-credit')
  await page.waitForTimeout(1500)
  await expect(credit).toBeVisible()
  const before = await profile.boundingBox()
  const creditBefore = await credit.boundingBox()
  await page.mouse.move(60, 700)
  await page.mouse.down()
  await page.mouse.move(300, 640, { steps: 8 })
  await page.mouse.up()
  const after = await profile.boundingBox()
  const creditAfter = await credit.boundingBox()
  expect(after!.x - before!.x).toBeCloseTo(0, 1)
  expect(after!.y - before!.y).toBeCloseTo(0, 1)
  expect(creditAfter!.x - creditBefore!.x).toBeCloseTo(0, 1)
  expect(creditAfter!.y - creditBefore!.y).toBeCloseTo(0, 1)
  expect(768 - creditAfter!.y - creditAfter!.height).toBeCloseTo(24, 0)
  expect(Number(await credit.evaluate((node) => getComputedStyle(node).zIndex))).toBeGreaterThanOrEqual(1000)
  await expect(page.locator('.reference-portal')).not.toHaveAttribute('data-dragging', /.+/)
  await expect(page.locator('.reference-portal')).not.toHaveAttribute('data-camera-x', /.+/)
})

test('narrow screens scale and contain the scene', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(800)
  const profile = await page.locator('.identity-panel').boundingBox()
  expect(profile!.x + profile!.width / 2).toBeCloseTo(195, 0)
  expect(profile!.y + profile!.height / 2).toBeCloseTo(422, 0)
  expect(profile!.width).toBeCloseTo(323, 0)
  expect(profile!.height).toBeCloseTo(233, 0)
  const navButtons = await page.locator('.identity-panel .category-button').evaluateAll((nodes) => nodes.map((node) => {
    const rect = node.getBoundingClientRect()
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
  }))
  expect(navButtons.length).toBeGreaterThanOrEqual(3)
  expect(new Set(navButtons.map((button) => Math.round(button.y))).size).toBe(navButtons.length)
  const halftone = (await page.locator('.halftone-canvas').boundingBox())!
  expect(halftone.x).toBeLessThan(0)
  expect(halftone.y).toBeLessThan(0)
  expect(halftone.x + halftone.width).toBeGreaterThan(390)
  expect(halftone.y + halftone.height).toBeGreaterThan(844)
  const initialBlockPositions = await page.locator('.physics-item').filter({ has: page.locator('.physics-link-card') }).evaluateAll((nodes) => nodes.map((node) => {
    const rect = node.getBoundingClientRect()
    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
  }))
  await expect(page.locator('.physics-credit')).toBeVisible()
  await page.getByRole('button', { name: /PM，1 条内容/ }).click()
  const items = page.locator('.physics-content')
  const mobileCredit = page.locator('.physics-credit')
  await expect(page.locator('.reference-portal')).toHaveAttribute('data-mobile-docking', 'true')
  await expect(page.locator('.reference-portal')).toHaveAttribute('data-mobile-dock-phase', 'fade')
  await expect(page.locator('.identity-panel')).not.toHaveAttribute('data-mobile-compact', 'true')
  await page.waitForTimeout(60)
  await expect(page.locator('.identity-panel')).toHaveCSS('animation-name', 'item-shrink-out')
  await expect(mobileCredit).toHaveAttribute('data-exiting', 'true')
  await expect(mobileCredit).toHaveCSS('animation-name', 'item-shrink-out')
  await page.waitForTimeout(30)
  const fadingProfile = (await page.locator('.identity-panel').boundingBox())!
  expect(fadingProfile.x + fadingProfile.width / 2).toBeCloseTo(195, 0)
  expect(fadingProfile.y + fadingProfile.height / 2).toBeCloseTo(422, 0)
  await expect(page.locator('.reference-portal')).toHaveAttribute('data-mobile-dock-phase', 'reveal')
  await expect(page.locator('.identity-panel')).toHaveAttribute('data-mobile-compact', 'true')
  const revealBlockShift = await page.locator('.physics-item').filter({ has: page.locator('.physics-link-card') }).evaluateAll((nodes, before) => nodes.map((node, index) => {
    const rect = node.getBoundingClientRect()
    return Math.hypot(rect.x + rect.width / 2 - before[index].x, rect.y + rect.height / 2 - before[index].y)
  }), initialBlockPositions)
  expect(Math.max(...revealBlockShift)).toBeLessThan(30)
  await expect(items).toHaveCount(1)
  await page.waitForTimeout(610)
  await expect(page.locator('.reference-portal')).not.toHaveAttribute('data-mobile-docking', 'true')
  await expect(mobileCredit).toHaveCount(0)
  const compactProfile = (await page.locator('.identity-panel').boundingBox())!
  expect(compactProfile.x).toBeCloseTo(10, 0)
  expect(compactProfile.y).toBeCloseTo(10, 0)
  expect(compactProfile.width).toBeCloseTo(370, 0)
  expect(compactProfile.height).toBeCloseTo(58, 0)
  for (const box of await items.evaluateAll((nodes) => nodes.map((node) => {
    const rect = node.getBoundingClientRect()
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
  }))) {
    expect(box.x).toBeGreaterThanOrEqual(-1)
    expect(box.y).toBeGreaterThanOrEqual(-1)
    expect(box.x + box.width).toBeLessThanOrEqual(391)
    expect(box.y + box.height).toBeLessThanOrEqual(845)
    expect(box.y).toBeGreaterThanOrEqual(compactProfile.y + compactProfile.height + 10)
  }
  const mobileObjects = await page.locator('.physics-item').filter({ has: page.locator('a') }).evaluateAll((nodes) => nodes.map((node) => {
    const rect = node.getBoundingClientRect()
    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
  }))
  const maximumObjectDistance = mobileObjects.reduce((maximum, first) => Math.max(maximum, ...mobileObjects.map((second) => Math.hypot(second.x - first.x, second.y - first.y))), 0)
  expect(maximumObjectDistance).toBeGreaterThan(50)
  await page.waitForTimeout(300)
  const separatedObjects = await page.locator('.physics-item:not(.physics-credit)').filter({ has: page.locator('a') }).evaluateAll((nodes) => nodes.map((node) => {
    const rect = node.getBoundingClientRect()
    return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom }
  }))
  for (let first = 0; first < separatedObjects.length; first += 1) {
    for (let second = first + 1; second < separatedObjects.length; second += 1) {
      const overlapX = Math.min(separatedObjects[first].right, separatedObjects[second].right) - Math.max(separatedObjects[first].left, separatedObjects[second].left)
      const overlapY = Math.min(separatedObjects[first].bottom, separatedObjects[second].bottom) - Math.max(separatedObjects[first].top, separatedObjects[second].top)
      expect(overlapX <= 2 || overlapY <= 2).toBe(true)
    }
  }
  const blockShift = await page.evaluate(async () => {
    const blocks = [...document.querySelectorAll<HTMLElement>('.physics-item:has(.physics-link-card)')]
    const before = blocks.map((node) => {
      const rect = node.getBoundingClientRect()
      return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
    })
    const nextCategory = [...document.querySelectorAll<HTMLButtonElement>('.category-button')].find((button) => !button.disabled)
    nextCategory?.click()
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    return blocks.map((node, index) => {
      const rect = node.getBoundingClientRect()
      return Math.hypot(rect.x + rect.width / 2 - before[index].x, rect.y + rect.height / 2 - before[index].y)
    })
  })
  expect(Math.max(...blockShift)).toBeLessThan(20)
  await page.setViewportSize({ width: 844, height: 390 })
  await page.waitForTimeout(500)
  const landscapeProfile = (await page.locator('.identity-panel').boundingBox())!
  expect(landscapeProfile.x).toBeCloseTo(10, 0)
  expect(landscapeProfile.y).toBeCloseTo(10, 0)
  expect(landscapeProfile.width).toBeCloseTo(824, 0)
  expect(landscapeProfile.height).toBeCloseTo(52, 0)
  for (const box of await items.evaluateAll((nodes) => nodes.map((node) => {
    const rect = node.getBoundingClientRect()
    return { y: rect.y }
  }))) expect(box.y).toBeGreaterThanOrEqual(landscapeProfile.y + landscapeProfile.height + 10)
  await expect(page.locator('.window-dock')).toHaveCount(0)
})

test('touch devices preview content on the first tap and open it on the second', async ({ browser }) => {
  const context = await browser.newContext({ hasTouch: true, viewport: { width: 390, height: 844 } })
  await context.addInitScript(() => {
    class TestDeviceOrientationEvent extends Event {
      beta: number | null
      gamma: number | null
      constructor(type: string, init: { beta?: number; gamma?: number } = {}) {
        super(type)
        this.beta = init.beta ?? null
        this.gamma = init.gamma ?? null
      }
    }
    Object.defineProperty(window, 'DeviceOrientationEvent', { configurable: true, value: TestDeviceOrientationEvent })
  })
  const page = await context.newPage()
  await page.route('**/blog/homepage-feed.json', (route) => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({
      schemaVersion: 1,
      source: 'blog',
      generatedAt: '2026-11-08T01:00:00.000Z',
      items: [{ bind: 'blog', title: '基于知识图谱的推荐系统综述笔记', summary: '第一次点按显示摘要，第二次打开。', href: '/blog/touch-target/', appearance: 'text', tags: ['Touch'], order: 10 }],
    }),
  }))
  await page.route('**/research/homepage-feed.json', (route) => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({
      schemaVersion: 1,
      source: 'research',
      generatedAt: '2026-11-08T01:00:00.000Z',
      items: [{ bind: 'research', title: '触屏 Essay', summary: '第一段。\n第二段。', href: '/research/touch-essay/', appearance: 'essay', tags: ['Touch'], order: 10 }],
    }),
  }))
  await page.route('**/blog/touch-target/', (route) => route.fulfill({ contentType: 'text/html', body: '<title>touch target</title>' }))

  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.reference-portal')).toHaveAttribute('data-input', 'touch')
  await expect(page.locator('.reference-portal')).toHaveAttribute('data-touch-parallax', 'off')
  await page.waitForTimeout(950)
  const profileBox = (await page.locator('.identity-panel').boundingBox())!
  const blockBoxes = await page.locator('.physics-item').filter({ has: page.locator('.physics-link-card') }).evaluateAll((nodes) => nodes.map((node) => {
    const rect = node.getBoundingClientRect()
    return { top: rect.top, bottom: rect.bottom }
  }))
  expect(blockBoxes).toHaveLength(3)
  for (const block of blockBoxes) expect(block.bottom <= profileBox.y - 10 || block.top >= profileBox.y + profileBox.height + 10).toBe(true)
  await expect(page.locator('.identity-panel')).toHaveCSS('--centre-option-x', '0px')
  await expect(page.locator('.physics-link-card').first()).toHaveCSS('--layer-near-x', '0px')

  await page.evaluate(() => {
    window.dispatchEvent(new DeviceOrientationEvent('deviceorientation', { beta: 0, gamma: 0 }))
    window.dispatchEvent(new DeviceOrientationEvent('deviceorientation', { beta: 12, gamma: 14 }))
  })
  await expect(page.locator('.reference-portal')).toHaveAttribute('data-touch-parallax', 'gyro')
  await expect.poll(async () => page.locator('.identity-panel').evaluate((node) => node instanceof HTMLElement ? node.style.getPropertyValue('--centre-option-x') : '')).not.toBe('0px')
  await expect.poll(async () => page.locator('.physics-item').filter({ has: page.locator('.physics-link-card') }).first().evaluate((node) => node instanceof HTMLElement ? node.style.getPropertyValue('--layer-near-x') : '')).not.toBe('0px')

  await page.getByRole('button', { name: /Research，2 条内容/ }).tap()
  const essay = page.locator('[data-content-id="feed:research:/research/touch-essay/"]')
  await expect(essay).toBeVisible()
  await page.waitForTimeout(650)
  const collapsedHeight = (await essay.boundingBox())!.height
  await essay.getByRole('link').tap({ force: true })
  await expect(essay).toHaveAttribute('data-touch-expanded', 'true')
  await expect(essay.locator('.essay-copy')).toBeVisible()
  await expect.poll(async () => (await essay.boundingBox())!.height).toBeGreaterThan(collapsedHeight * 1.5)
  await page.locator('.reference-viewport').dispatchEvent('pointerdown', { button: 0, pointerType: 'touch' })
  await expect(essay).not.toHaveAttribute('data-touch-expanded', 'true')
  await expect(essay.locator('.essay-copy')).toBeHidden()
  await expect.poll(async () => (await essay.boundingBox())!.height).toBeLessThan(collapsedHeight * 1.15)
  const settledProfile = (await page.locator('.identity-panel').boundingBox())!
  const settledBlocks = await page.locator('.physics-item').filter({ has: page.locator('.physics-link-card') }).evaluateAll((nodes) => nodes.map((node) => {
    const rect = node.getBoundingClientRect()
    return { top: rect.top, bottom: rect.bottom }
  }))
  for (const block of settledBlocks) expect(block.top).toBeGreaterThanOrEqual(settledProfile.y + settledProfile.height + 8)

  await page.setViewportSize({ width: 820, height: 1000 })
  await page.getByRole('button', { name: /Blog，2 条内容/ }).tap()
  const text = page.locator('[data-content-id="feed:blog:/blog/touch-target/"]')
  await expect(text).toBeVisible()
  await page.waitForTimeout(650)
  const textSpacing = await text.evaluate((node) => {
    const card = node.querySelector('.card--text')!.getBoundingClientRect()
    const title = node.querySelector('.card--text h3')!.getBoundingClientRect()
    return { top: title.top - card.top, bottom: card.bottom - title.bottom }
  })
  expect(textSpacing.top).toBeGreaterThan(4)
  expect(textSpacing.bottom).toBeGreaterThan(4)
  expect(Math.abs(textSpacing.top - textSpacing.bottom)).toBeLessThan(2)
  const collapsedTextWidth = (await text.boundingBox())!.width
  await text.getByRole('link').evaluate((link: HTMLAnchorElement) => link.click())
  await expect(text).toHaveAttribute('data-touch-expanded', 'true')
  await expect(text.locator('.card--text p')).toHaveCSS('opacity', '1')
  await expect.poll(async () => (await text.boundingBox())!.width).toBeGreaterThan(collapsedTextWidth * 1.15)
  expect((await text.boundingBox())!.width).toBeLessThan(collapsedTextWidth * 1.34)
  await expect(page).toHaveURL(/\/$/)
  await text.getByRole('link').evaluate((link: HTMLAnchorElement) => link.click())
  await expect(page).toHaveURL(/\/blog\/touch-target\/$/)
  await context.close()
})

test('items and centre options use layered parallax while the disc stays centred', async ({ page }) => {
  await page.route('**/assets/temporary/disc_cover.png', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 350))
    await route.continue()
  })
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: /Blog，2 条内容/ }).click()
  const gallery = page.locator('[data-content-id="blog-home"]')
  await expect(gallery).toBeVisible()
  await page.waitForTimeout(550)
  await gallery.evaluate((node) => {
    const rect = node.getBoundingClientRect()
    node.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerType: 'mouse', clientX: rect.left + rect.width * .12, clientY: rect.top + rect.height / 2 }))
  })
  const left = parseFloat(await gallery.evaluate((node) => getComputedStyle(node).getPropertyValue('--card-tilt-y')))
  await gallery.evaluate((node) => {
    const rect = node.getBoundingClientRect()
    node.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerType: 'mouse', clientX: rect.left + rect.width * .88, clientY: rect.top + rect.height / 2 }))
  })
  const right = parseFloat(await gallery.evaluate((node) => getComputedStyle(node).getPropertyValue('--card-tilt-y')))
  expect(left).toBeLessThan(0)
  expect(right).toBeGreaterThan(0)
  expect(Math.abs(Math.abs(left) - Math.abs(right))).toBeLessThan(1)
  await page.waitForTimeout(140)
  const galleryDepth = await gallery.evaluate((node) => ({
    perspective: getComputedStyle(node.querySelector('.card--gallery')!).perspective,
    stage: getComputedStyle(node.querySelector('.gallery-stage')!).transform,
    planes: [...node.querySelectorAll('.gallery-plane')].map((plane) => ({
      transform: getComputedStyle(plane).transform,
      zIndex: Number(getComputedStyle(plane).zIndex),
    })),
    placardZ: Number(getComputedStyle(node.querySelector('.gallery-placard')!).zIndex),
    parallax: {
      frontX: new DOMMatrix(getComputedStyle(node.querySelector('.gallery-plane--front')!).transform).m41,
      frameX: new DOMMatrix(getComputedStyle(node.querySelector('.gallery-mat')!).transform).m41,
      placardX: new DOMMatrix(getComputedStyle(node.querySelector('.gallery-placard')!).transform).m41,
    },
  }))
  expect(galleryDepth.perspective).toBe('none')
  expect(galleryDepth.stage).not.toContain('matrix3d')
  expect(new Set(galleryDepth.planes.map((plane) => plane.transform)).size).toBe(3)
  expect(galleryDepth.planes.every((plane) => !plane.transform.includes('matrix3d'))).toBe(true)
  expect(galleryDepth.planes.map((plane) => plane.zIndex)).toEqual([1, 2, 3])
  expect(galleryDepth.placardZ).toBeGreaterThan(3)
  expect(Math.abs(galleryDepth.parallax.frameX)).toBeGreaterThan(0)
  const effectiveFrameX = galleryDepth.parallax.frontX + galleryDepth.parallax.frameX
  expect(Math.abs(galleryDepth.parallax.placardX)).toBeGreaterThan(Math.abs(effectiveFrameX))

  const profile = page.locator('.identity-panel')
  await page.mouse.move(20, 20)
  await page.waitForTimeout(120)
  const centreLeft = await profile.evaluate((node) => getComputedStyle(node).transform)
  const layersLeft = await profile.evaluate((node) => ({
    far: getComputedStyle(node.querySelector('.identity-black')!).transform,
    near: getComputedStyle(node.querySelector('.character-frame')!).transform,
    options: getComputedStyle(node.querySelector('.identity-copy')!).transform,
  }))
  await page.mouse.move(1420, 880)
  await page.waitForTimeout(120)
  const centreRight = await profile.evaluate((node) => getComputedStyle(node).transform)
  expect(centreLeft).toBe(centreRight)
  const centreLayers = await profile.evaluate((node) => ({
    far: getComputedStyle(node.querySelector('.identity-black')!).transform,
    near: getComputedStyle(node.querySelector('.character-frame')!).transform,
    options: getComputedStyle(node.querySelector('.identity-copy')!).transform,
  }))
  expect(layersLeft.far).not.toBe(centreLayers.far)
  expect(layersLeft.near).not.toBe(centreLayers.near)
  expect(layersLeft.options).not.toBe(centreLayers.options)
  expect(centreLayers.far).not.toBe(centreLayers.near)
  await expect(profile.locator('.category-button').first()).toHaveCSS('font-family', /Microsoft YaHei UI/)
  const centreZ = await profile.evaluate((node) => ({
    character: Number(getComputedStyle(node.querySelector('.character-frame')!).zIndex),
    options: Number(getComputedStyle(node.querySelector('.identity-copy')!).zIndex),
  }))
  expect(centreZ.options).toBeGreaterThan(centreZ.character)
  await page.evaluate(() => window.dispatchEvent(new Event('blur')))
  await page.waitForTimeout(130)
  await expect.poll(async () => profile.evaluate((node) => ({
    x: node instanceof HTMLElement ? node.style.getPropertyValue('--centre-option-x') : '',
    y: node instanceof HTMLElement ? node.style.getPropertyValue('--centre-option-y') : '',
  }))).toEqual({ x: '0px', y: '0px' })

  const linkItem = page.locator('.physics-item').filter({ has: page.locator('.physics-link-card') }).first()
  await linkItem.evaluate((node) => {
    const rect = node.getBoundingClientRect()
    node.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerType: 'mouse', clientX: rect.left + rect.width * .8, clientY: rect.top + rect.height * .25 }))
  })
  await page.waitForTimeout(100)
  const linkLayers = await linkItem.evaluate((node) => ({
    far: getComputedStyle(node.querySelector('.physics-link-card > span')!, '::before').transform,
    near: getComputedStyle(node.querySelector('.physics-link-card > i')!).transform,
  }))
  expect(linkLayers.far).not.toBe(linkLayers.near)
  await expect(linkItem.locator('.physics-link-card > i')).toHaveCSS('-webkit-text-stroke-width', '2px')

  await page.getByRole('button', { name: /Research，2 条内容/ }).evaluate((button: HTMLButtonElement) => button.click())
  const bookCard = page.locator('[data-content-id="research-notes"]')
  await expect(bookCard).toBeVisible()
  await bookCard.evaluate((node) => {
    const rect = node.getBoundingClientRect()
    node.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerType: 'mouse', clientX: rect.left + rect.width * .82, clientY: rect.top + rect.height * .25 }))
  })
  const layerTransforms = await bookCard.evaluate((node) => ({
    background: getComputedStyle(node.querySelector('.card--book > img')!).transform,
    caption: getComputedStyle(node.querySelector('.book-spine span')!).transform,
  }))
  expect(layerTransforms.background).not.toBe(layerTransforms.caption)

  await page.getByRole('button', { name: /PM，1 条内容/ }).evaluate((button: HTMLButtonElement) => button.click())
  const disc = page.locator('[data-content-id="pokemon-disc"]')
  await expect(disc.locator('.disc-art')).toBeVisible()
  await expect(disc.locator('.disc-art')).toHaveAttribute('data-state', 'loading')
  await expect(disc.locator('.disc-placeholder')).toBeVisible()
  await expect(disc.locator('.disc-art')).toHaveAttribute('data-state', 'loaded')
  await expect(disc.locator('.disc-image:not(.disc-image--shadow)')).toHaveCSS('opacity', '1')
  await page.mouse.move(0, 0)
  await expect.poll(async () => (await disc.boundingBox())!.width).toBeLessThan(250)
  const collapsedDiscTitleHeight = (await disc.locator('.disc-spine strong').boundingBox())!.height
  await disc.hover()
  await expect.poll(async () => disc.locator('.disc-image:not(.disc-image--shadow)').evaluate((node) => new DOMMatrix(getComputedStyle(node).transform).m41)).toBeGreaterThan(20)
  await expect.poll(async () => (await disc.locator('.disc-spine strong').boundingBox())!.height).toBeGreaterThan(collapsedDiscTitleHeight * 1.3)
  await page.mouse.move(0, 0)
  await expect.poll(async () => disc.locator('.disc-image:not(.disc-image--shadow)').evaluate((node) => Math.abs(new DOMMatrix(getComputedStyle(node).transform).m41))).toBeLessThan(.5)
  await disc.evaluate((node) => {
    const rect = node.getBoundingClientRect()
    node.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerType: 'mouse', clientX: rect.left + rect.width * .85, clientY: rect.top + rect.height * .2 }))
  })
  await expect.poll(async () => disc.locator('.card--disc').evaluate((node) => Math.abs(new DOMMatrix(getComputedStyle(node).transform).m41))).toBeGreaterThan(.5)
  const discLayers = await disc.evaluate((node) => ({
    shadow: getComputedStyle(node.querySelector('.disc-image--shadow')!).transform,
    image: getComputedStyle(node.querySelector('.disc-image:not(.disc-image--shadow)')!).transform,
    spine: getComputedStyle(node.querySelector('.disc-spine')!).transform,
    shadowX: new DOMMatrix(getComputedStyle(node.querySelector('.disc-image--shadow')!).transform).m41,
    imageX: new DOMMatrix(getComputedStyle(node.querySelector('.disc-image:not(.disc-image--shadow)')!).transform).m41,
    spineX: new DOMMatrix(getComputedStyle(node.querySelector('.disc-spine')!).transform).m41,
  }))
  expect(discLayers.shadow).not.toBe(discLayers.image)
  expect(discLayers.image).not.toBe(discLayers.spine)
  expect(Math.abs(discLayers.spineX)).toBeGreaterThan(0)
  expect(Math.abs(discLayers.spineX)).toBeLessThan(Math.abs(discLayers.shadowX))
  expect(Math.abs(discLayers.shadowX)).toBeLessThan(Math.abs(discLayers.imageX))
  await disc.evaluate((node) => {
    const rect = node.getBoundingClientRect()
    node.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerType: 'mouse', clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 }))
  })
  await page.waitForTimeout(120)
  const centres = await disc.evaluate((node) => {
    const card = node.querySelector('.card--disc')!.getBoundingClientRect()
    const image = node.querySelector('.disc-image:not(.disc-image--shadow)')!.getBoundingClientRect()
    return {
      cardX: card.x + card.width / 2,
      cardY: card.y + card.height / 2,
      imageX: image.x + image.width / 2,
      imageY: image.y + image.height / 2,
    }
  })
  expect(Math.abs(centres.cardX - centres.imageX)).toBeLessThan(1)
  expect(Math.abs(centres.cardY - centres.imageY)).toBeLessThan(1)
})

test('reduced motion preserves navigation and content', async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1024, height: 768 } })
  const page = await context.newPage()
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: /PM，1 条内容/ }).click()
  await expect(page.getByRole('link', { name: /打开/ })).toBeVisible()
  await context.close()
})
