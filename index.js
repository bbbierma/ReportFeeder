import Parser from 'rss-parser';
import { EURLEX_FIELDS, parseCreator } from './taxonomy.js';
import { Client } from '@notionhq/client';

const parser = new Parser();
const FEED_URL = 'https://eur-lex.europa.eu/EN/display-feed.rss?rssId=161';
const notion = new Client({ auth: process.env.NOTION_TOKEN });

async function main() {
  try {
    const feed = await parser.parseURL(FEED_URL);

    const items = feed.items.map(i => {
      const celex = i.title?.match(/CELEX:(\d+[A-Z]*)/i)?.[1] || null;
      const { institution, dg } = parseCreator(i.creator);
      const doctype = i.title?.split(':')[2]?.split(' ')[0] || null;

      return {
        celex,
        guid: i.guid,
        doctype,
        category: i.category,
        creator: i.creator,
        institution,
        dg,
        title: i.title,
        description: i.contentSnippet || '',
        link: i.link,
        pubDate: i.pubDate
      };
    });

    console.table(items.slice(0, 5));

    await pushToNotion(items);
  } catch (err) {
    console.error('Main error:', err.message);
  }
}

async function pushToNotion(items) {
  for (const it of items) {
    try {
      await notion.pages.create({
        parent: { database_id: process.env.DATABASE_ID },
        properties: {
          CELEX: { rich_text: [{ text: { content: it.celex || '' } }] },
          Title: { title: [{ text: { content: it.title } }] },
          DG: { rich_text: [{ text: { content: it.dg || '' } }] },
          Type: { select: { name: it.doctype || 'unknown' } },
          Link: { url: it.link }
        }
      });
      console.log('Added:', it.title);
    } catch (err) {
      console.error('Error adding', it.title, err.body || err.message);
    }
  }
}

main();
