function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

export function renderRobotsTxt({ publicUrl } = {}) {
  const origin = String(publicUrl || '').replace(/\/+$/, '');
  return [
    'User-agent: *',
    'Allow: /',
    'Disallow: /v1/',
    'Disallow: /health',
    'Disallow: /catalog',
    `Sitemap: ${origin}/sitemap.xml`,
    ''
  ].join('\n');
}

export function renderSitemapXml({ publicUrl, paths = ['/', '/studio'] } = {}) {
  const origin = String(publicUrl || '').replace(/\/+$/, '');
  const urls = paths.map((path) => `  <url><loc>${escapeXml(`${origin}${path}`)}</loc></url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}
