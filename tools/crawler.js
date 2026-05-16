import { chromium } from 'playwright';

export async function findSitemap(baseUrl) {
  try {
    const sitemapUrl = new URL('/sitemap.xml', baseUrl).href;
    const response = await fetch(sitemapUrl, { method: 'HEAD' });
    if (response.ok) return sitemapUrl;
  } catch (e) {
    // ignore
  }

  try {
    const robotsUrl = new URL('/robots.txt', baseUrl).href;
    const response = await fetch(robotsUrl);
    if (response.ok) {
      const text = await response.text();
      const sitemapMatch = text.match(/Sitemap:\s*(https?:\/\/[^\s]+)/i);
      if (sitemapMatch) return sitemapMatch[1];
    }
  } catch (e) {
    // ignore
  }

  return null;
}

export async function extractUrlsFromSitemap(sitemapUrl) {
  try {
    const response = await fetch(sitemapUrl);
    const xml = await response.text();
    const locs = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map(m => m[1].trim());

    const urls = [];
    if (xml.includes('<sitemapindex')) {
      for (const loc of locs) {
        try {
          const nestedUrls = await extractUrlsFromSitemap(loc);
          urls.push(...nestedUrls);
        } catch (e) {
          // ignore nested errors
        }
      }
    } else {
      urls.push(...locs);
    }
    
    // Deduplicate and filter out obvious non-html files if needed
    return [...new Set(urls)].filter(u => !u.endsWith('.xml'));
  } catch (e) {
    return [];
  }
}

export async function crawlSite(baseUrl, maxPages = 20) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const visited = new Set();
  const toVisit = [baseUrl];
  const internalUrls = [];

  while (toVisit.length > 0 && visited.size < maxPages) {
    const url = toVisit.pop();
    if (visited.has(url)) continue;
    
    visited.add(url);
    internalUrls.push(url);

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      const hrefs = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('a')).map(a => a.href);
      });

      for (const href of hrefs) {
        try {
          const parsedUrl = new URL(href);
          const parsedBase = new URL(baseUrl);
          if (parsedUrl.origin === parsedBase.origin) {
            // Strip hash to avoid treating anchor links as new pages
            const cleanUrl = parsedUrl.origin + parsedUrl.pathname;
            if (!visited.has(cleanUrl) && !toVisit.includes(cleanUrl)) {
              toVisit.push(cleanUrl);
            }
          }
        } catch (e) {
          // Ignore invalid URLs
        }
      }
    } catch (error) {
      // Ignore navigation timeouts or errors for individual pages
    }
  }

  await browser.close();
  return internalUrls;
}
