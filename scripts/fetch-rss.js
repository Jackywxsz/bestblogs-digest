#!/usr/bin/env node
/**
 * fetch-rss.js
 * Fetches BestBlogs.dev AI RSS feeds (English + Chinese), parses them,
 * merges by GUID, and outputs structured JSON to stdout.
 *
 * Usage: node fetch-rss.js [--lang en|zh|both]
 */

import { XMLParser } from 'fast-xml-parser';

const RSS_BASE = 'https://www.bestblogs.dev/{lang}/feeds/rss?category=ai&minScore=90';
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

// --- CLI args ---
const args = process.argv.slice(2);
const langIndex = args.indexOf('--lang');
const lang = langIndex >= 0 ? args[langIndex + 1] : 'both';

// --- RSS fetch with retry ---
async function fetchRSS(language) {
  const url = RSS_BASE.replace('{lang}', language);
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'bestblogs-digest/1.0 (+https://github.com/qujingde/bestblogs-digest)' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (err) {
      if (attempt === MAX_RETRIES) throw err;
      await new Promise(r => setTimeout(r, RETRY_DELAY_MS * attempt));
    }
  }
}

// --- HTML entity decode (minimal, handles RSS-common entities) ---
function decodeHtml(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&nbsp;/g, ' ');
}

// --- Strip HTML tags, collapse whitespace ---
function stripHtml(str) {
  return str.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

// --- Parse description HTML into structured sections ---
function parseDescription(rawHtml) {
  const html = decodeHtml(rawHtml);

  // One-Sentence Summary / 一句话摘要: text in <p> after "📌" heading
  const oneSentenceMatch = html.match(/📌<\/span>[^<]*(?:One-Sentence Summary|一句话摘要)[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/);
  const oneSentenceSummary = oneSentenceMatch ? stripHtml(oneSentenceMatch[1]) : '';

  // Summary / 详细摘要: text in <p> after "📝" heading
  const summaryMatch = html.match(/📝<\/span>[^<]*(?:Summary|详细摘要)[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/);
  const summary = summaryMatch ? stripHtml(summaryMatch[1]) : '';

  // Main Points / 主要观点: extract <li> items from the <ol> after "💡"
  const mainPointsSection = html.match(/💡<\/span>[^<]*(?:Main Points|主要观点)[\s\S]*?<ol[^>]*>([\s\S]*?)<\/ol>/);
  const mainPoints = [];
  if (mainPointsSection) {
    const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/g;
    let liMatch;
    while ((liMatch = liRegex.exec(mainPointsSection[1])) !== null) {
      const liHtml = liMatch[1];
      const titleMatch = liHtml.match(/<strong[^>]*>([\s\S]*?)<\/strong>/);
      const detailMatch = liHtml.match(/<span[^>]*>([\s\S]*?)<\/span>/);
      if (titleMatch) {
        mainPoints.push({
          title: stripHtml(titleMatch[1]),
          detail: detailMatch ? stripHtml(detailMatch[1]) : '',
        });
      }
    }
  }

  // Key Quotes / 文章金句: <li> items in <ul> after "💬"
  const quotesSection = html.match(/💬<\/span>[^<]*(?:Key Quotes|文章金句)[\s\S]*?<ul[^>]*>([\s\S]*?)<\/ul>/);
  const keyQuotes = [];
  if (quotesSection) {
    const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/g;
    let liMatch;
    while ((liMatch = liRegex.exec(quotesSection[1])) !== null) {
      const text = stripHtml(liMatch[1]);
      if (text) keyQuotes.push(text);
    }
  }

  // Read time / 阅读时间 from Article Meta section
  const readTimeMatch = html.match(/(?:Read Time|阅读时间)[：:]\s*<\/span><span[^>]*>([\s\S]*?)<\/span>/);
  const readTime = readTimeMatch ? stripHtml(readTimeMatch[1]) : '';

  return { oneSentenceSummary, summary, mainPoints, keyQuotes, readTime };
}

// --- Parse RSS XML into array of article objects ---
function parseRSS(xmlText) {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    cdataPropName: '__cdata',
    parseAttributeValue: true,
    processEntities: false,
  });
  const result = parser.parse(xmlText);
  const items = result?.rss?.channel?.item;
  if (!items) return [];
  const arr = Array.isArray(items) ? items : [items];

  return arr.map(item => {
    const guid = String(item.guid?.['#text'] || item.guid || '').replace(/^RAW_/, '');
    const descriptionRaw = item.description?.__cdata || item.description || '';
    const parsed = parseDescription(descriptionRaw);

    return {
      guid,
      title: String(item.title || ''),
      link: String(item.link || ''),
      pubDate: item.pubDate ? new Date(item.pubDate).toISOString() : '',
      author: String(item.author || ''),
      score: Number(item.score) || 0,
      keywords: String(item.keywords || '').split(',').map(k => k.trim()).filter(Boolean),
      imageUrl: item.enclosure?.['@_url'] || '',
      ...parsed,
    };
  });
}

// --- Merge English + Chinese articles by GUID ---
function mergeArticles(enArticles, zhArticles) {
  const zhMap = new Map(zhArticles.map(a => [a.guid, a]));
  return enArticles.map(enArt => {
    const zhArt = zhMap.get(enArt.guid);
    if (!zhArt) return { ...enArt, zh: null };
    return {
      guid: enArt.guid,
      title: enArt.title,
      zhTitle: zhArt.title,
      link: enArt.link,
      pubDate: enArt.pubDate,
      author: enArt.author,
      score: enArt.score,
      keywords: enArt.keywords,
      imageUrl: enArt.imageUrl,
      en: {
        oneSentenceSummary: enArt.oneSentenceSummary,
        summary: enArt.summary,
        mainPoints: enArt.mainPoints,
        keyQuotes: enArt.keyQuotes,
        readTime: enArt.readTime,
      },
      zh: {
        oneSentenceSummary: zhArt.oneSentenceSummary,
        summary: zhArt.summary,
        mainPoints: zhArt.mainPoints,
        keyQuotes: zhArt.keyQuotes,
        readTime: zhArt.readTime,
      },
    };
  });
}

// --- Main ---
async function main() {
  let articles;

  if (lang === 'both') {
    const [enXml, zhXml] = await Promise.all([fetchRSS('en'), fetchRSS('zh')]);
    const enArticles = parseRSS(enXml);
    const zhArticles = parseRSS(zhXml);
    articles = mergeArticles(enArticles, zhArticles);
  } else {
    const xml = await fetchRSS(lang);
    articles = parseRSS(xml);
  }

  process.stdout.write(JSON.stringify(articles, null, 2));
}

main().catch(err => {
  process.stderr.write(`Error: ${err.message}\n`);
  process.exit(1);
});
