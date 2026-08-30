/**
 * Live Website Updates — the poller behind the store feed (Reading A).
 *
 * Runs on a Cloudflare cron trigger. Each run:
 *   1. Pulls the live catalogue from homekode.com/products.json
 *   2. Diffs it against the last snapshot held in Cloudflare D1
 *   3. Writes real change events, not a product list
 *   4. Replaces the snapshot
 *
 * Verified 23 Aug 2026: the endpoint returns title, handle, updated_at,
 * images, and variants carrying price, compare_at_price and available.
 */

import { getSnapshots, upsertSnapshot, insertStoreEvents } from '../src/lib/store.js';

const SOURCE = 'https://homekode.com/products.json';
const PAGE_SIZE = 250;
const MAX_PAGES = 12; // 3,000 products is well clear of the catalogue size

async function fetchCatalogue() {
  const products = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = await fetch(`${SOURCE}?limit=${PAGE_SIZE}&page=${page}`, {
      headers: { 'User-Agent': 'HomeKode-MessageStudio/1.0 (+internal)' },
      cf: { cacheTtl: 0 },
    });
    if (!res.ok) throw new Error(`Catalogue fetch failed: ${res.status}`);
    const json = await res.json();
    const batch = json.products || [];
    products.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  return products.map((p) => {
    const v = (p.variants || [])[0] || {};
    return {
      handle: p.handle,
      title: p.title,
      product_type: p.product_type || null,
      price: v.price != null ? Number(v.price) : null,
      compare_at: v.compare_at_price != null ? Number(v.compare_at_price) : null,
      available: (p.variants || []).some((x) => x.available),
      image_url: (p.images || [])[0] ? p.images[0].src : null,
      updated_at: p.updated_at || null,
    };
  });
}

function diff(previous, current) {
  const before = new Map(previous.map((p) => [p.handle, p]));
  const events = [];

  for (const now of current) {
    const was = before.get(now.handle);

    if (!was) {
      events.push({
        kind: 'new_arrival',
        handle: now.handle,
        title: now.title,
        detail: now.product_type ? `Added to ${now.product_type}` : 'Added to the store',
        new_value: now.price,
      });
      continue;
    }

    if (was.price != null && now.price != null && was.price !== now.price) {
      events.push({
        kind: now.price < was.price ? 'price_drop' : 'price_increase',
        handle: now.handle,
        title: now.title,
        detail: `${was.price.toFixed(2)} → ${now.price.toFixed(2)} AED`,
        old_value: was.price,
        new_value: now.price,
      });
    }

    if (was.available && !now.available) {
      events.push({ kind: 'sold_out', handle: now.handle, title: now.title, detail: 'Now out of stock' });
    }
    if (!was.available && now.available) {
      events.push({ kind: 'back_in_stock', handle: now.handle, title: now.title, detail: 'Available again' });
    }
  }

  return events;
}

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(run(env));
  },
  // Manual trigger, owner-only, for testing the poller from the app.
  async fetch(request, env) {
    if (request.headers.get('X-Poll-Key') !== env.POLL_TRIGGER_KEY) {
      return new Response('Unauthorized', { status: 401 });
    }
    const summary = await run(env);
    return Response.json(summary);
  },
};

async function run(env) {
  const current = await fetchCatalogue();
  const previous = await getSnapshots(env.DB);
  const isFirstRun = !previous || previous.length === 0;
  const events = isFirstRun ? [] : diff(previous, current);
  if (events.length) await insertStoreEvents(env.DB, events);
  for (const p of current) await upsertSnapshot(env.DB, p);
  return { products: current.length, events: events.length, firstRun: isFirstRun };
}
