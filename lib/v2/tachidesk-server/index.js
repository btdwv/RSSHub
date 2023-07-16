const got = require('@/utils/got');
// const cheerio = require('cheerio');
// const timezone = require('@/utils/timezone');
// const { parseDate } = require('@/utils/parse-date');
const dayjs = require('dayjs');

module.exports = async (ctx) => {
    const id = ctx.params.id ?? '1';
    const site = ctx.params.site ?? '192.168.50.50:14567';

    const rootUrl = `http://${site}`;
    const pageUrl = `${rootUrl}/manga/${id}`; // 漫画的网页

    const titleUrl = `${rootUrl}/api/v1/manga/${id}/?onlineFetch=false`; // 获取标题、简介
    const chaptersUrl = `${rootUrl}/api/v1/manga/${id}/chapters?onlineFetch=true`; // 获取章节
    // const thumbnailUrl = `${rootUrl}/api/v1/manga/${id}/thumbnail?useCache=true`; // 获取封面

    let response = await got({
        method: 'get',
        url: titleUrl,
    });
    const sTitle = response.data.title; // 标题
    const sDescription = response.data.description; // 简介
    const sAuthor = response.data.author; // 作者
    const sSource = response.data.source.name; // 来源

    response = await got({
        method: 'get',
        url: chaptersUrl,
    });

    const items = [];
    for (let i = 0; i < response.data.length; i++) {
        const listItem = {};
        listItem.title = response.data[i].name;
        listItem.link = `${pageUrl}/chapter/${response.data[i].index}`;
        listItem.author = sAuthor;
        listItem.pubDate = dayjs(response.data[i].uploadDate).format('YYYY-MM-DD HH:mm:ss');
        listItem.description = `<h1>${response.data[i].pageCount}P </h1><a href="${listItem.link}">Tachidesk-server </a><p></p><a href="${response.data[i].realUrl}">${sSource} </a>`;
        items.push(listItem);
    }

    ctx.state.data = {
        title: sTitle + ' - ' + sSource,
        description: sDescription,
        link: pageUrl,
        item: items,
    };
};
