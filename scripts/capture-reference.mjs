import { chromium } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'

const output = '.artifacts/reference'
mkdirSync(output, { recursive: true })
const browser = await chromium.launch({ channel: 'msedge', headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })

async function reset() {
  await page.goto('https://nikukikai.art/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
}

const states = [
  ['essay', 'Essay'],
  ['dev', 'Dev proj'],
  ['manga', 'Manga'],
]

for (const [id, label] of states) {
  await reset()
  await page.getByText(label, { exact: true }).click()
  await page.waitForTimeout(1800)
  await page.screenshot({ path: `${output}/nikukikai-${id}-1440x900.png` })
}

await reset()
const metrics = await page.evaluate(() => {
  const all = [...document.querySelectorAll('body *')]
  return all.map((node) => {
    const text = node.textContent?.trim().replace(/\s+/g, ' ')
    if (!text || text.length > 30) return null
    const rect = node.getBoundingClientRect()
    const style = getComputedStyle(node)
    if (rect.width < 20 || rect.height < 10) return null
    return { tag: node.tagName, text, x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height), font: style.fontFamily, fontSize: style.fontSize, background: style.backgroundColor, color: style.color, border: style.border }
  }).filter(Boolean)
})
writeFileSync(`${output}/nikukikai-metrics.json`, JSON.stringify(metrics, null, 2))
await browser.close()
