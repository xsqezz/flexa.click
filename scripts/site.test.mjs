import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { encodeQr, qrSvg } from './lib/qr.mjs'
import { canonicalBase, DEFAULT_SITE_BASE, robotsTxt, sitemapXml, softwareJsonLd } from './lib/site-meta.mjs'

const zxing = createRequire(import.meta.url)('@zxing/library')
const APK = 'https://github.com/xsqezz/flexa.click/releases/latest/download/flexa.apk'

function decode({ size, modules }) {
  const scale = 4
  const border = 4
  const dimension = (size + border * 2) * scale
  const luminance = new Uint8ClampedArray(dimension * dimension).fill(255)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!modules[y][x]) continue
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) luminance[((y + border) * scale + dy) * dimension + (x + border) * scale + dx] = 0
      }
    }
  }
  const bitmap = new zxing.BinaryBitmap(new zxing.HybridBinarizer(new zxing.RGBLuminanceSource(luminance, dimension, dimension)))
  return new zxing.QRCodeReader().decode(bitmap, new Map([[zxing.DecodeHintType.PURE_BARCODE, true]])).getText()
}

test('QR codes decode back to the original text for every level, small and multi-block versions', () => {
  const samples = ['a', APK, 'Zażółć gęślą jaźń — Flexa', 'x'.repeat(400), 'y'.repeat(1200)]
  for (const level of ['L', 'M', 'Q', 'H']) {
    for (const text of samples) assert.equal(decode(encodeQr(text, { level })), text, `${level}: ${text.slice(0, 20)}`)
  }
})

test('QR encoder chooses the smallest version and draws the standard structure', () => {
  const qr = encodeQr(APK, { level: 'M' })
  assert.equal(qr.version, 5)
  assert.equal(qr.size, 37)
  assert.equal(qr.modules.length, 37)
  const finder = [[1, 1, 1, 1, 1, 1, 1], [1, 0, 0, 0, 0, 0, 1], [1, 0, 1, 1, 1, 0, 1], [1, 0, 1, 1, 1, 0, 1], [1, 0, 1, 1, 1, 0, 1], [1, 0, 0, 0, 0, 0, 1], [1, 1, 1, 1, 1, 1, 1]]
  for (const [ox, oy] of [[0, 0], [30, 0], [0, 30]]) {
    finder.forEach((row, y) => row.forEach((value, x) => assert.equal(qr.modules[oy + y][ox + x], value === 1)))
  }
  for (let i = 8; i < 29; i++) assert.equal(qr.modules[6][i], i % 2 === 0)
  assert.equal(qr.modules[qr.size - 8][8], true)
  assert.equal(encodeQr('a').version, 1)
  assert.throws(() => encodeQr('z'.repeat(3000), { level: 'H' }), /too long/)
})

test('QR SVG is accessible, self-contained and escapes its label', () => {
  const svg = qrSvg(APK, { label: 'Kod <QR> & link', id: 'qr-test' })
  assert.match(svg, /^<svg class="qr-code" viewBox="0 0 45 45" role="img" aria-labelledby="qr-test"/)
  assert.match(svg, /<title id="qr-test">Kod &lt;QR&gt; &amp; link<\/title>/)
  assert.ok(!svg.includes('<script'))
  assert.ok(!svg.includes('href'))
})

test('canonical base uses the custom domain only when configured', () => {
  assert.equal(canonicalBase(undefined), DEFAULT_SITE_BASE)
  assert.equal(canonicalBase('  '), 'https://xsqezz.github.io/flexa.click/')
  assert.equal(canonicalBase('Flexa.Click'), 'https://flexa.click/')
  assert.throws(() => canonicalBase('flexa.click/evil'), /not a valid hostname/)
  assert.throws(() => canonicalBase('http://flexa.click'), /not a valid hostname/)
})

test('robots.txt and sitemap.xml point at the canonical base', () => {
  assert.equal(robotsTxt(DEFAULT_SITE_BASE), 'User-agent: *\nAllow: /\n\nSitemap: https://xsqezz.github.io/flexa.click/sitemap.xml\n')
  const sitemap = sitemapXml('https://flexa.click/')
  assert.match(sitemap, /^<\?xml version="1\.0" encoding="UTF-8"\?>/)
  assert.deepEqual([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]), ['https://flexa.click/', 'https://flexa.click/setup.html'])
})

test('JSON-LD describes a free Polish health application and cannot close its script element', () => {
  const json = softwareJsonLd({ base: DEFAULT_SITE_BASE, androidUrl: APK, description: 'Opis </script><b>' })
  assert.ok(!json.includes('</script>'))
  assert.ok(!json.includes('<'))
  const data = JSON.parse(json)
  assert.equal(data['@type'], 'SoftwareApplication')
  assert.equal(data.name, 'Flexa')
  assert.equal(data.applicationCategory, 'HealthApplication')
  assert.equal(data.operatingSystem, 'Web, Android')
  assert.equal(data.inLanguage, 'pl')
  assert.deepEqual(data.offers, { '@type': 'Offer', price: '0', priceCurrency: 'PLN' })
  assert.equal(data.description, 'Opis </script><b>')
  assert.equal(data.image, 'https://xsqezz.github.io/flexa.click/og-image.png')
})
