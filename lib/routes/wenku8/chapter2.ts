import { load } from 'cheerio';

import type { Route } from '@/types';
import playwright from '@/utils/playwright';

export const route: Route = {
    path: '/chapter2/:id',
    categories: ['reading'],
    example: '/wenku8/chapter/74',
    parameters: { id: '小说 id, 可在对应小说页 URL 中找到' },
    features: {
        requireConfig: false,
        requirePuppeteer: true,
        antiCrawler: true,
        supportBT: false,
        supportPodcast: false,
        supportScihub: false,
    },
    name: '章节',
    maintainers: ['zsakvo'],
    handler,
};

async function handler(ctx) {
    const id = ctx.req.param('id');
    const index = Math.floor(Number.parseInt(id) / 1000);

    // const browser = await playwright.launch({headless: true, args: ["--no-sandbox"]});
    const browser = await playwright();
    const page = await browser.newPage();
    await page.route('**/*', (route) => {
        route.request().resourceType() === 'document' ? route.continue() : route.abort();
    });
    let responseHtml;
    try {
        await page.goto(`https://www.wenku8.net/novel/${index}/${id}/index.htm`, { timeout: 30000, waitUntil: 'domcontentloaded' });
        await page.waitForSelector('#headlink', { timeout: 10000 });
        responseHtml = await page.evaluate(() => document.querySelector('body').innerHTML);
    } finally {
        browser.close();
    }

    const $ = load(responseHtml);

    const name = $('#title').text();

    const chapter_item = [];

    $('.ccss>a').each((_, el) => {
        chapter_item.push({
            title: $(el).text(),
            link: `https://www.wenku8.net/novel/${index}/${id}/` + $(el).attr('href'),
        });
    });

    return {
        title: `轻小说文库 ${name}`,
        link: `https://www.wenku8.net/book/${id}.htm`,
        item: chapter_item,
    };
}
