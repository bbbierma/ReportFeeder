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
  for (const r of rows.slice(0, 50)) { // limit for safety
    try {
      await notion.pages.create({
        parent: { database_id: process.env.DATABASE_ID },
        properties: {
          Source: {
            select: { name: r.src || 'Unknown Source' }
          },
          Committee: {
            multi_select: r.committee
              ? r.committee.split(',').map(c => ({ name: c.trim() }))
              : [{ name: 'Unknown' }]
          },
          PubDate: {
            date: r.pub ? { start: r.pub } : null
          },
          PE_number: {
            rich_text: [{ text: { content: r.pe || '' } }]
          },
          Rapporteur: {
            multi_select: r.rapporteur
              ? r.rapporteur.split(',').map(p => ({ name: p.trim() }))
              : [{ name: 'Unknown' }]
          },
          Group: {
            multi_select: r.group
              ? r.group.split(',').map(g => ({ name: g.trim() }))
              : [{ name: 'Unknown' }]
          },
          Procedure: {
            rich_text: [{ text: { content: r.procedure || '' } }]
          },
          Link: {
            url: r.link || null
          },
          Title: {
            title: [{ text: { content: r.title || '(untitled)' } }]
          }
        }
      });
      console.log(`✅ ${label}: added ${r.title}`);
    } catch (err) {
      console.error(`❌ ${label}: error adding ${r.title}`, err.body || err.message);
    }
  }
}

