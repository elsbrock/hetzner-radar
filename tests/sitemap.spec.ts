import test, { expect } from './fixtures';

test('/sitemap.xml is valid', async ({ page }) => {
  const response = await page.goto('/sitemap.xml');
  expect(response?.status()).toBe(200);

  // Ensure XML is valid. Playwright parses the XML here and will error if it
  // cannot be parsed.
  const urls = await page.$$eval('url', (urls) =>
    urls.map((url) => ({
      loc: url.querySelector('loc')?.textContent,
      // changefreq: url.querySelector('changefreq').textContent, // if you enabled in your sitemap
      // priority: url.querySelector('priority').textContent,
    }))
  );

  // Sanity check
  expect(urls.length).toBeGreaterThan(5);

  // Ensure entries are in a valid format.
  for (const url of urls) {
    expect(url.loc).toBeTruthy();
    expect(() => new URL(url.loc!)).not.toThrow();
    // expect(url.changefreq).toBe('daily');
    // expect(url.priority).toBe('0.7');
  }
});
