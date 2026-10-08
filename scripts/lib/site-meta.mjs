export const DEFAULT_SITE_BASE = 'https://xsqezz.github.io/flexa.click/'
export const SITE_PAGES = ['', 'setup.html']

const HOSTNAME = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i

export function validDomain(domain) {
  return HOSTNAME.test(domain)
}

/** Absolute public base URL of the landing, always ending with a slash. */
export function canonicalBase(domain) {
  const value = domain?.trim()
  if (!value) return DEFAULT_SITE_BASE
  if (!validDomain(value)) throw new Error('FLEXA_SITE_DOMAIN is not a valid hostname.')
  return `https://${value.toLowerCase()}/`
}

const escapeXml = (value) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')

export function robotsTxt(base) {
  return `User-agent: *\nAllow: /\n\nSitemap: ${new URL('sitemap.xml', base).href}\n`
}

export function sitemapXml(base, pages = SITE_PAGES) {
  const urls = pages.map((page) => `  <url><loc>${escapeXml(new URL(page, base).href)}</loc></url>`).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
}

/** JSON-LD safe to embed inside a <script type="application/ld+json"> element. */
export function softwareJsonLd({ base, androidUrl, description }) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Flexa',
    description,
    url: base,
    image: new URL('og-image.png', base).href,
    applicationCategory: 'HealthApplication',
    operatingSystem: 'Web, Android',
    inLanguage: 'pl',
    isAccessibleForFree: true,
    downloadUrl: androidUrl,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'PLN' },
  }
  return JSON.stringify(data, null, 2)
    .replaceAll('<', '\\u003c').replaceAll('>', '\\u003e').replaceAll('&', '\\u0026')
}
