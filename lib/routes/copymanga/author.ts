import { Route } from '@/types';
import cache from '@/utils/cache';
import { load } from 'cheerio';
import { config } from '@/config';
import puppeteer from '@/utils/puppeteer';
import { decodeOriginalBody } from './decode-utils';

export const route: Route = {
    path: '/author/:id',
    categories: ['anime'],
    example: '/copymanga/author/hiroyuki',
    parameters: { id: '作者ID' },
    features: {
        requireConfig: false,
        requirePuppeteer: true,
        antiCrawler: false,
        supportBT: false,
        supportPodcast: false,
        supportScihub: false,
    },
    name: '作者作品',
    maintainers: ['btdwv'],
    handler,
};

async function handler(ctx) {
    const id = ctx.req.param('id');
    let authorName = '';

    const strBaseUrl = 'https://www.mangacopy.com';
    const strPageUrl = `${strBaseUrl}/author/${id}/comics`;

    const strProxyAddr = process.env.CLOUDFLARE_PROXY_ADDR || '';
    const strProxyPwd = process.env.CLOUDFLARE_PROXY_PWD || '';
    const strProxyPageUrl = `${strProxyAddr}${strPageUrl}`; // 通过cloudflare搭建的代理 https://github.com/gaboolic/cloudflare-reverse-proxy  https://github.com/1234567Yang/cf-proxy-ex

    const fetchChaptorxData = async () => {
        const browser = await puppeteer();
        const page = await browser.newPage();
        await page.setRequestInterception(true); // 启用请求拦截功能，允许控制页面发出的网络请求
        page.on('request', (request) => {
            request.resourceType() === 'document' ? request.continue() : request.abort(); // 监听页面的所有请求，只允许文档类型的请求通过，其他资源（如图片、CSS、JS等）都被阻止。提高爬取速度，减少不必要的资源加载
        });
        if (strProxyPwd !== '' && strProxyAddr !== '') {
            await page.setCookie({
                name: '__PROXY_PWD__',
                value: strProxyPwd,
                domain: strProxyAddr.replace('https://', '').replace('/', ''),
                path: '/',
            });
        }
        await page.goto(strProxyPageUrl);
        const html = await page.evaluate(() => document.querySelector('body')?.innerHTML || '');
        browser.close();
        // 如果通过代理访问，需要进行解码
        const $ = load(strProxyAddr === '' ? html : decodeOriginalBody(html));
        const bookUrls = $("div[class='correlationItem-txt'] > a");
        const bookNames = $("div[class='correlationItem-txt'] > a > p");
        const authorMatch = $("div[class='correlation-title-top'] h4 span")
            .text()
            .match(/\[(.*?)]/);
        authorName = authorMatch ? authorMatch[1] : '';
        const covers = $("div[class='correlationItem-img loadingIcon hoverImage'] a img");
        const count = bookUrls.length;

        const items: any[] = [];
        for (let i = 0; i < count; i++) {
            const listItem: any = {};
            listItem.link = strBaseUrl + bookUrls[i].attribs.href.replace(strProxyAddr, '').replace(strBaseUrl, '');
            listItem.title = bookNames[i].attribs.title;
            if (covers[i].attribs.src !== undefined) {
                listItem.description = `<img src=${covers[i].attribs.src.replace(strProxyAddr, '')}></img>`.trim();
            } else if (covers[i].attribs['data-src'] !== undefined) {
                listItem.description = `<img src=${covers[i].attribs['data-src'].replace(strProxyAddr, '')}></img>`.trim();
            }
            listItem.author = authorName;
            items.push(listItem);
        }
        return items;
    };

    const chapterArray = await cache.tryGet(strProxyPageUrl, fetchChaptorxData, config.cache.routeExpire, false);

    return {
        title: `拷贝漫画 - [${authorName}] 相关作品`,
        link: String(strPageUrl),
        description: `[${authorName}] 相关作品`,
        item: chapterArray,
    };
}
