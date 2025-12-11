import { ItemGrid } from '@/components/item-grid';
import type { Item, ItemApiResponse, ItemAttribute } from '@/types/lol-items';
import * as cheerio from 'cheerio';

function parseAttributes(html: string): ItemAttribute[] {
  if (!html) return [];

  const $ = cheerio.load(html);
  const statsText = $('stats').html();
  if (!statsText) return [];

  const attributes: ItemAttribute[] = [];
  const parts = statsText.split('<br>').filter((part: string) => part.trim() !== '');

  parts.forEach((part: string) => {
    const part$ = cheerio.load(part);
    const valueText = part$('attention').text().trim();
    const value = parseInt(valueText, 10);

    if (!isNaN(value)) {
      part$('attention').remove();
      const description = part$.root().text().trim().replace(/^de\s/, '');
      attributes.push({ valor: value, descricao: description });
    }
  });

  return attributes;
}

async function getItems(): Promise<{ items: Item[], attributes: string[] }> {
  try {
    const response = await fetch('https://ddragon.leagueoflegends.com/cdn/15.14.1/data/pt_BR/item.json', {
      next: { revalidate: 3600 } // Revalidate every hour
    });
    if (!response.ok) {
      throw new Error('Failed to fetch item data');
    }
    const apiResponse: ItemApiResponse = await response.json();

    const allAttributes = new Set<string>();

    const itemsArray = Object.entries(apiResponse.data)
      .map(([id, itemData]) => {
        const attributes = parseAttributes(itemData.description);
        attributes.forEach(attr => allAttributes.add(attr.descricao));
        return {
          ...itemData,
          id,
          attributes,
        };
      })
      .filter(item => item.gold.total > 0 && item.maps['11'] === true);

    return { items: itemsArray, attributes: Array.from(allAttributes).sort() };
  } catch (error) {
    console.error(error);
    return { items: [], attributes: [] };
  }
}

export default async function Home() {
  const { items, attributes } = await getItems();

  return (
    <main className="container mx-auto px-4 py-8">
      <ItemGrid initialItems={items} uniqueAttributes={attributes} />
    </main>
  );
}
