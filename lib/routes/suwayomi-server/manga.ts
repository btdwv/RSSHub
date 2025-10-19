import { Route } from '@/types';
import cache from '@/utils/cache';
import got from '@/utils/got';
import dayjs from 'dayjs';
import { config } from '@/config';
import ConfigNotFoundError from '@/errors/types/config-not-found';

export const route: Route = {
    path: '/manga/:id',
    categories: ['anime'],
    example: '/suwayomi-server/manga/3909',
    parameters: { id: '漫画ID' },
    features: {
        requireConfig: false,
        requirePuppeteer: false,
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
    if (!process.env.SUWAYOMI_INTERNAL_ADDRESS || !process.env.SUWAYOMI_EXTERNAL_ADDRESS) {
        throw new ConfigNotFoundError('not found environment variable [SUWAYOMI_INTERNAL_ADDRESS] or [SUWAYOMI_EXTERNAL_ADDRESS]');
    }

    const id = ctx.req.param('id');
    const site = process.env.SUWAYOMI_INTERNAL_ADDRESS || ''; // rsshub怎样访问suwayomi-server，填写rsshub能访问到的地址 如: http://Suwayomi:4567
    const pageAddress = process.env.SUWAYOMI_EXTERNAL_ADDRESS || ''; // 用户怎样访问suwayomi-server，填写浏览器中看到的地址 如: http://192.168.50.50:14567

    const rootUrl = String(site);
    const pageUrl = `${pageAddress}/manga/${id}`; // 漫画的网页

    const titleUrl = `${rootUrl}/api/v1/manga/${id}/?onlineFetch=false`; // 获取标题、简介
    const chaptersUrl = `${rootUrl}/api/v1/manga/${id}/chapters?onlineFetch=true`; // 获取章节
    // const thumbnailUrl = `${rootUrl}/api/v1/manga/${id}/thumbnail?useCache=true`; // 获取封面

    const getMangaInfo = async () => {
        const { data } = await got({
            method: 'get',
            url: titleUrl,
        });
        return data;
    };

    const mangaData = await cache.tryGet(titleUrl, getMangaInfo, config.cache.routeExpire, false);
    const sTitle = mangaData.title; // 标题
    const sDescription = mangaData.description; // 简介
    const sAuthor = mangaData.author; // 作者
    const sSource = mangaData.source.name; // 来源

    const fetchChaptorxData = async () => {
        const { data } = await got({
            method: 'get',
            url: chaptersUrl,
        });

        const items = [];
        for (const datum of data) {
            const listItem = {};
            listItem.title = datum.name;
            listItem.link = `${pageUrl}/chapter/${datum.index}`;
            listItem.author = sAuthor;
            listItem.pubDate = dayjs(datum.uploadDate).format('YYYY-MM-DD HH:mm:ss');
            listItem.description = `<h1>${datum.pageCount}P </h1><a href="${listItem.link}">Suwayomi-Server </a><p></p><a href="${datum.realUrl}">${sSource} </a>`;
            items.push(listItem);
        }
        return items;
    };
    const chapterArray = await cache.tryGet(chaptersUrl, fetchChaptorxData, config.cache.routeExpire, false);

    return {
        title: sTitle + ' - ' + sSource,
        description: sDescription,
        link: pageUrl,
        item: chapterArray,
    };
}
