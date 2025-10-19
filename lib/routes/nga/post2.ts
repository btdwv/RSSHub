import { Route } from '@/types';
import { load } from 'cheerio';
import { parseDate } from '@/utils/parse-date';
import timezone from '@/utils/timezone';
import { config } from '@/config';
import puppeteer from '@/utils/puppeteer';

export const route: Route = {
    path: '/post2/:tid/:authorId?',
    categories: ['bbs'],
    example: '/nga/post2/18449558',
    parameters: { tid: '帖子 id, 可在帖子 URL 找到', authorId: '作者 id' },
    features: {
        requireConfig: false,
        requirePuppeteer: true,
        antiCrawler: false,
        supportBT: false,
        supportPodcast: false,
        supportScihub: false,
    },
    name: '帖子',
    maintainers: ['xyqfer', 'syrinka'],
    handler,
};

const getPageUrl = (tid, authorId, page = 1, hash = '') => `https://nga.178.com/read.php?tid=${tid}&page=${page}${authorId ? `&authorid=${authorId}` : ''}&rand=${Math.random() * 1000}#${hash}`;

const deepReplace = (str, pattern, replace) => {
    // 对于可能存在嵌套的样式一路 replace 到最深处
    while (pattern.test(str)) {
        str = str.replace(pattern, replace);
    }
    return str;
};

const formatContent = (str) => {
    // 简单样式
    str = deepReplace(str, /\[(b|u|i|del|code|sub|sup)](.+?)\[\/\1]/g, '<$1>$2</$1>');
    str = str
        .replaceAll(/\[dice](.+?)\[\/dice]/g, '<b>ROLL : $1</b>')
        .replaceAll(/\[color=(.+?)](.+?)\[\/color]/g, '<span style="color:$1;">$2</span>')
        .replaceAll(/\[font=(.+?)](.+?)\[\/font]/g, '<span style="font-family:$1;">$2</span>')
        .replaceAll(/\[size=(.+?)](.+?)\[\/size]/g, '<span style="font-size:$1;">$2</span>')
        .replaceAll(/\[align=(.+?)](.+?)\[\/align]/g, '<span style="text-align:$1;">$2</span>');
    // 列表
    str = deepReplace(str, /\[\*](.+?)(?=\[\*]|\[\/list])/g, '<li>$1</li>');
    str = deepReplace(str, /\[list](.+?)\[\/list]/g, '<ul>$1</ul>');
    // 图片
    str = str.replaceAll(/\[img](.+?)\[\/img]/g, (m, src) => `<img src='${src[0] === '.' ? 'https://img.nga.178.com/attachments' + src.slice(1) : src}'></img>`);
    // 折叠
    str = deepReplace(str, /\[collapse(?:=(.+?))?](.+?)\[\/collapse]/g, '<details><summary>$1</summary>$2</details>');
    // 引用
    str = deepReplace(str, /\[quote](.+?)\[\/quote]/g, '<blockquote>$1</blockquote>')
        .replaceAll(/\[@(.+?)]/g, '<a href="https://nga.178.com/nuke.php?func=ucp&username=$1">@$1</a>')
        .replaceAll(/\[uid=(\d+)](.+?)\[\/uid]/g, '<a href="https://nga.178.com/nuke.php?func=ucp&uid=$1">@$2</a>')
        .replaceAll(/\[tid=(\d+)](.+?)\[\/tid]/g, '<a href="https://nga.178.com/read.php?tid=$1">$2</a>')
        .replaceAll(/\[pid=(\d+),(\d+),(\d+)](.+?)\[\/pid]/g, (m, pid, tid, page, str) => {
            const url = `https://nga.178.com/read.php?tid=${tid}&page=${page}#pid${pid}Anchor`;
            return `<a href="${url}">${str}</a>`;
        });
    // 链接
    str = str.replaceAll(/\[url=(.+?)](.+?)\[\/url]/g, '<a href="$1">$2</a>');
    // 分割线
    str = str.replaceAll(/\[h](.+?)\[\/h]/g, '<h4 style="font-size:1.17em;font-weight:bold;border-bottom:1px solid #aaa;clear:both;margin:1.33em 0 0.2em 0;">$1</h4>');
    return str;
};

async function handler(ctx) {
    const getPage = async (tid, authorId, pageId = 1) => {
        const link = getPageUrl(tid, authorId, pageId);
        const timestamp = Math.floor(Date.now() / 1000);
        const browser = await puppeteer();
        const page = await browser.newPage();
        await page.setCookie({
            name: 'guestJs',
            value: timestamp.toString(),
            domain: '.nga.178.com',
        });
        if (config.nga.uid && config.nga.cid) {
            await page.setCookie({
                name: 'ngaPassportUid',
                value: config.nga.uid,
                domain: '.nga.178.com',
            });
            await page.setCookie({
                name: 'ngaPassportCid',
                value: config.nga.cid,
                domain: '.nga.178.com',
            });
        }
        await page.setRequestInterception(true); // 启用请求拦截功能，允许控制页面发出的网络请求
        page.on('request', (request) => {
            // 只允许文档和脚本类型的请求通过，其他资源（如图片、CSS等）都被阻止。这样可以允许JS执行，同时减少不必要的资源加载
            if (request.resourceType() === 'document' || request.resourceType() === 'script') {
                request.continue();
            } else {
                request.abort();
            }
        });
        await page.goto(link);
        // 如果没登陆就打开页面，页面可能提示“加载中 请稍候”，页面标题是“访客不能直接访问”，此时需要等待自动跳转
        const pageContent = await page.content();
        if (pageContent.includes('访客不能直接访问')) {
            await new Promise((resolve) => setTimeout(resolve, 3000));
        }

        const responseHtml = await page.evaluate(() => document.querySelector('html')?.innerHTML || '');
        const $ = load(responseHtml);
        browser.close();
        return $;
    };

    const getLastPageId = async (tid, authorId) => {
        const $ = await getPage(tid, authorId);
        const nav = $('#pagebtop');
        const match = nav.html().match(/{0:'\/read\.php\?tid=(\d+).*?',1:(\d+),.*?}/);
        return match ? match[2] : 1;
    };

    const tid = ctx.req.param('tid');
    const authorId = ctx.req.param('authorId') || undefined;
    const pageId = await getLastPageId(tid, authorId);

    const $ = await getPage(tid, authorId, pageId);
    const title = $('title').text() || '';
    const posterMap = JSON.parse(
        $('script')
            .text()
            .match(/commonui\.userInfo\.setAll\((.*)\)$/m)[1]
    );
    const authorName = authorId ? posterMap[authorId].username : undefined;

    const items = $('#m_posts_c')
        .children()
        .filter('table')
        .toArray()
        .map((post_) => {
            const post = $(post_);
            const posterId = post
                .find('.posterinfo a')
                .first()
                .attr('href')
                .match(/&uid=(-?\d+)$/)[1];
            const poster = authorName || posterMap[posterId].username;
            const content = post.find('.postcontent').first();
            const description = formatContent(content.html());
            const postId = content.attr('id');
            const link = getPageUrl(tid, authorId, pageId, postId);
            const pubDate = timezone(parseDate(post.find('.postInfo > span').first().text(), 'YYYY-MM-DD HH:mm'), +8);

            return {
                title: load(description).text(),
                author: poster,
                link,
                description,
                pubDate,
                guid: postId,
            };
        });

    const rssTitle = authorName ? `NGA ${authorName} ${title}` : `NGA ${title}`;

    return {
        title: rssTitle,
        link: getPageUrl(tid, authorId, pageId),
        item: items,
    };
}
