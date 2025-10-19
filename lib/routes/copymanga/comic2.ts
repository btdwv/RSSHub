import { Route } from '@/types';
import cache from '@/utils/cache';
import { load } from 'cheerio';
import { config } from '@/config';
import puppeteer from '@/utils/puppeteer';

export const route: Route = {
    path: '/comic2/:id/:chapterCnt?',
    categories: ['anime'],
    example: '/copymanga/comic2/dianjuren/5',
    parameters: { id: '漫画ID', chapterCnt: '返回章节的数量，默认为 `10`' },
    features: {
        requireConfig: false,
        requirePuppeteer: true,
        antiCrawler: false,
        supportBT: false,
        supportPodcast: false,
        supportScihub: false,
    },
    name: '漫画更新',
    maintainers: ['btdwv'],
    handler,
};

async function handler(ctx) {
    // 漫画ID
    const id = ctx.req.param('id');
    // 用于控制返回的章节数量
    const chapterCnt = Number(ctx.req.param('chapterCnt') || 65535); // 访问1次页面就能拿到所有结果，不用特意控制返回数量
    const strBaseUrl = 'https://www.mangacopy.com';
    const strPageUrl = `${strBaseUrl}/comic/${id}`;

    const getChapters = ($) => {
        // 获取列表 （默认、单行本、全彩版、其他汉化版 的章节都能拿到，但是不能确保最新章节放到末尾）
        const chapterContainers = $('.table-default-box > div > div > ul').toArray();

        // 提取所有章节链接
        const chapters: any[] = [];
        for (const container of chapterContainers) {
            // 在当前容器中查找所有章节链接
            const chapterLinks = $(container).children('a').toArray();
            chapters.push(...chapterLinks);
        }

        // 将章节元素映射为结构化数据
        const result = chapters.map((element) => {
            const link = $(element);
            return {
                link: strBaseUrl + link.attr('href'),
                title: link.attr('title'),
            };
        });
        return result;
    };

    const genResult = (chapter) => ({
        link: chapter.link,
        guid: chapter.link,
        title: chapter.title,
        description: `<h1>${chapter.title}</h1>`.trim(),
    });

    let bookTitle = '';
    let bookIntro = '';
    const fetchChaptorxData = async () => {
        const browser = await puppeteer();
        const page = await browser.newPage();
        await page.setRequestInterception(true); // 启用请求拦截功能，允许控制页面发出的网络请求
        page.on('request', (request) => {
            const resourceType = request.resourceType();
            if (resourceType === 'document' || resourceType === 'script' || resourceType === 'xhr' || resourceType === 'fetch') {
                request.continue();
            } else {
                request.abort();
            }
        }); // 监听页面的所有请求，允许文档、JS脚本和网络请求通过，其他资源（如图片、CSS等）被阻止。提高爬取速度，减少不必要的资源加载

        await page.goto(strPageUrl);
        await page.waitForSelector('.table-default-box > div > div > ul', { timeout: 10000 });
        // await new Promise(resolve => setTimeout(resolve, 3000));// 加载页面后，页面通过js动态加载章节，等待3秒再继续
        const html = await page.evaluate(() => document.querySelector('body').innerHTML);
        browser.close();
        const $ = load(html);
        bookTitle = $('.comicParticulars-title-right > ul > li:nth-child(1) > h6').text();
        bookIntro = $('.comicParticulars-synopsis > div:nth-child(2) > p').text();
        // const coverImgSrc = $('.comicParticulars-title-left > div > img').attr('src');
        const chapters = getChapters($);
        chapters.reverse();
        let itemsLen = chapters.length;
        if (chapterCnt > 0) {
            itemsLen = chapterCnt;
        }
        return chapters.slice(0, itemsLen).map(genResult);
    };

    const chapterArray = await cache.tryGet(strPageUrl, fetchChaptorxData, config.cache.routeExpire, false);

    return {
        title: `${bookTitle} - 拷贝漫画`,
        link: `${strBaseUrl}/comic/${id}`,
        description: bookIntro,
        item: chapterArray,
    };
}
