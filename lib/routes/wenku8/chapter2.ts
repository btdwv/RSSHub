import { Route } from '@/types';
import { load } from 'cheerio';
// import puppeteer from "puppeteer";
import puppeteer from '@/utils/puppeteer';

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

    // const browser = await puppeteer.launch({headless: true, args: ["--no-sandbox"]});
    const browser = await puppeteer();
    const page = await browser.newPage();
    // 启用请求拦截功能，允许控制页面发出的网络请求
    await page.setRequestInterception(true);
    // 监听页面的所有请求，只允许文档类型的请求通过，其他资源（如图片、CSS、JS等）都被阻止。提高爬取速度，减少不必要的资源加载
    page.on('request', (request) => {
        request.resourceType() === 'document' ? request.continue() : request.abort();
    });
    await page.goto(`https://www.wenku8.net/novel/${index}/${id}/index.htm`);
    await page.waitForSelector('#headlink', { timeout: 10000 });
    const responseHtml = await page.evaluate(() => document.querySelector('body').innerHTML);
    browser.close();

    const $ = load(responseHtml);

    const name = $('#title').text();

    const chapter_item = [];

    $('.ccss>a').each(function () {
        chapter_item.push({
            title: $(this).text(),
            link: `https://www.wenku8.net/novel/${index}/${id}/` + $(this).attr('href'),
        });
    });

    return {
        title: `轻小说文库 ${name}`,
        link: `https://www.wenku8.net/book/${id}.htm`,
        item: chapter_item,
    };
}
