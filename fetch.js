const http = require('got');
const cheerio = require('cheerio');
const { join, basename } = require('path');
const { outputFile } = require('fs-extra');
const { createHash } = require('crypto');

const DOC_URL = `https://docs.gitlab.com/ee/ci/yaml/index.html`;
const OUT_DIR = join(__dirname, 'yaml');

(async () => {
  console.log('Loading document...');
  const $ = cheerio.load(await http.get(DOC_URL).text());

  const dropdown = $('#navbarDropdown').text().match(/GitLab\.com \(([^\)]+)\)/);
  const version = dropdown[1];
  console.log(`Version: ${version}`);

  console.log('Fetching assets...');
  const hrefs = $('[href]');
  for (const href of hrefs) {
    if (href.tagName == 'link' && href.attribs.rel == 'manifest') {
      continue;
    }
    if (href.attribs.href.startsWith('/assets/')) {
      const asset = await http.get(new URL(href.attribs.href, DOC_URL)).text();
      const name = basename(href.attribs.href).replace(/#.*$/, '');
      await outputFile(join(OUT_DIR, 'assets', name), asset);
      href.attribs.href = `assets/${name}`;
    }
  }

  console.log('Removing scripts...');
  const scripts = $('script');
  for (const script of scripts) {
    $(script).remove();
  }

  console.log('Rebuilding links...');
  const as = $('a[href]');
  for (const a of as) {
    if (!a.attribs.href.startsWith('#')) {
      a.attribs.href = new URL(a.attribs.href, DOC_URL).toString();
    }
  }

  console.log('Rebuilding body...');
  const body = $('main').html();
  $('body').html(body);
  $('body').css('padding', '16px');
  $('body').addClass('gl-docs');

  console.log('Output HTML...');
  const html = $.html();
  const hash = createHash('sha1').update(html).digest('hex').substring(0, 8);
  await outputFile(join(OUT_DIR, 'index.html'), html);
  await outputFile(join(__dirname, 'VERSION'), version);
  await outputFile(join(__dirname, 'DIGEST'), hash);
})();
