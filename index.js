import Parser from 'rss-parser';
import { Client } from '@notionhq/client';
import { FEEDS } from './feeds.js';

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const parser = new Parser();
const DB_ID  = process.env.DATABASE_ID;   //  your Notion DB id

async function parseFeed(label, url) {
  console.log(`📡 Fetching ${label}`);
  const feed = await parser.parseURL(url);
  const rows = [];

  for (const item of feed.items) {
    const src = url;
    const committee = item.categories?.[0] || '';
    const pub = item.pubDate || '';
    const pe = item.title?.match(/PE[0-9]+/)?.[0] || '';
    const rapporteur = item.creator || '';
    const group = item.title?.match(/\((.*?)\)/)?.[1] || '';
    const procedure = item.contentSnippet?.match(/Procedure:? ([A-Z0-9\/]+)/i)?.[1] || '';
    const link = item.link || '';
    const title = item.title || '';
    rows.push({ src, committee, pub, pe, rapporteur, group, procedure, link, title });
  }
  return rows;
}

async function pushToNotion(label, rows) {
  for (const r of rows.slice(0, 20)) {       //  limit example
    try {
      await notion.pages.create({
        parent: { database_id: DB_ID },
        properties: {
          Source:     { url: r.src },
          Committee:  { rich_text: [{ text: { content: r.committee } }] },
          PubDate:    { date: { start: r.pub } },
          PE_number:  { rich_text: [{ text: { content: r.pe } }] },
          Rapporteur: { rich_text: [{ text: { content: r.rapporteur } }] },
          Group:      { rich_text: [{ text: { content: r.group } }] },
          Procedure:  { rich_text: [{ text: { content: r.procedure } }] },
          Link:       { url: r.link },
          Title:      { title: [{ text: { content: r.title } }] }
        }
      });
    } catch (e) {
      console.error('❌', label, r.title, e.message);
    }
  }
  console.log(`✅ ${label} – pushed ${rows.length} items`);
}

(async () => {
  for (const [label, url] of Object.entries(FEEDS)) {
    const rows = await parseFeed(label, url);
    await pushToNotion(label, rows);
  }
})();
