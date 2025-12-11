'use client';

import * as React from 'react';
import Image from 'next/image';
import { ArrowUp, ArrowDown, ChevronsUpDown, Search } from 'lucide-react';
import * as cheerio from 'cheerio';
import { Item, ItemApiResponse, ItemAttribute, MapItem } from '@/types/lol-items';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Card } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from './ui/skeleton';

type SortKey = 'name' | 'plaintext' | 'gold' | 'attribute';
type SortDirection = 'ascending' | 'descending';

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

export function ItemGrid() {
  const [items, setItems] = React.useState<Item[]>([]);
  const [maps, setMaps] = React.useState<MapItem[]>([]);
  const [uniqueAttributes, setUniqueAttributes] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(true);

  const [filter, setFilter] = React.useState('');
  const [selectedAttribute, setSelectedAttribute] = React.useState('');
  const [selectedMap, setSelectedMap] = React.useState('11');
  const [sortConfig, setSortConfig] = React.useState<{ key: SortKey; direction: SortDirection } | null>({
    key: 'name',
    direction: 'ascending',
  });

  React.useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const [itemResponse, mapsResponse] = await Promise.all([
          fetch('https://ddragon.leagueoflegends.com/cdn/15.14.1/data/pt_BR/item.json'),
          fetch('https://static.developer.riotgames.com/docs/lol/maps.json')
        ]);

        if (!itemResponse.ok || !mapsResponse.ok) {
          throw new Error('Failed to fetch data');
        }

        const apiResponse: ItemApiResponse = await itemResponse.json();
        const mapsData: MapItem[] = await mapsResponse.json();
        setMaps(mapsData);

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
          .filter(item => item.gold.total > 0 && item.maps[selectedMap] === true);

        setItems(itemsArray);
        setUniqueAttributes(Array.from(allAttributes).sort());

      } catch (error) {
        console.error(error);
        setItems([]);
        setUniqueAttributes([]);
        setMaps([]);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [selectedMap]);

  const filteredAndSortedItems = React.useMemo(() => {
    let sortableItems = [...items];

    if (filter) {
      const lowercasedFilter = filter.toLowerCase();
      sortableItems = sortableItems.filter(
        (item) =>
          item.name.toLowerCase().includes(lowercasedFilter) ||
          item.plaintext.toLowerCase().includes(lowercasedFilter) ||
          item.description.toLowerCase().includes(lowercasedFilter)
      );
    }

    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        if (sortConfig.key === 'attribute' && selectedAttribute) {
          const aAttr = a.attributes?.find(attr => attr.descricao === selectedAttribute)?.valor ?? -1;
          const bAttr = b.attributes?.find(attr => attr.descricao === selectedAttribute)?.valor ?? -1;
          return bAttr - aAttr;
        }

        let aValue: string | number;
        let bValue: string | number;

        if (sortConfig.key === 'gold') {
          aValue = a.gold.total;
          bValue = b.gold.total;
        } else {
          aValue = a[sortConfig.key as keyof Item]?.toString().toLowerCase() ?? '';
          bValue = b[sortConfig.key as keyof Item]?.toString().toLowerCase() ?? '';
        }

        if (aValue < bValue) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }

    return sortableItems;
  }, [items, filter, sortConfig, selectedAttribute]);

  const requestSort = (key: SortKey) => {
    let direction: SortDirection = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
    if (key !== 'attribute') {
      setSelectedAttribute('');
    }
  };

  const handleAttributeSortChange = (attribute: string) => {
    if (attribute && attribute !== 'default') {
      setSelectedAttribute(attribute);
      setSortConfig({ key: 'attribute', direction: 'descending' });
    } else {
      setSelectedAttribute('');
      requestSort('name');
    }
  };

  const renderSortArrow = (key: SortKey) => {
    if (!sortConfig || sortConfig.key !== key) {
      return <ChevronsUpDown className="ml-2 h-4 w-4 text-muted-foreground/70" />;
    }
    return sortConfig.direction === 'ascending' ? (
      <ArrowUp className="ml-2 h-4 w-4" />
    ) : (
      <ArrowDown className="ml-2 h-4 w-4" />
    );
  };

  const GridSkeleton = () => (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-20">Ícone</TableHead>
            <TableHead className="w-1/4">Nome</TableHead>
            <TableHead>Descrição</TableHead>
            <TableHead className="w-28 text-right">Valor</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 10 }).map((_, index) => (
            <TableRow key={index}>
              <TableCell className="p-2"><Skeleton className="h-12 w-12 rounded-md" /></TableCell>
              <TableCell><Skeleton className="h-6 w-3/4" /></TableCell>
              <TableCell><Skeleton className="h-6 w-full" /></TableCell>
              <TableCell><Skeleton className="h-6 w-1/2 ml-auto" /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );

  return (
    <div className="space-y-6">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 pt-8 pb-4">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
          <h1 className="text-3xl font-bold text-foreground">LoL Item Explorer</h1>
          <div className="flex w-full flex-col sm:flex-row sm:w-auto sm:items-center gap-2">
            <div className="relative w-full sm:w-60">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Filtrar por nome ou descrição..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="pl-10 text-base"
                aria-label="Filter items"
              />
            </div>
            <Select onValueChange={setSelectedMap} value={selectedMap}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Selecionar mapa" />
              </SelectTrigger>
              <SelectContent>
                {maps.map(map => (
                  <SelectItem key={map.mapId} value={map.mapId.toString()}>{map.mapName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select onValueChange={handleAttributeSortChange} value={selectedAttribute || 'default'}>
              <SelectTrigger className="w-full sm:w-[220px]">
                <SelectValue placeholder="Ordenar por atributo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Padrão</SelectItem>
                {uniqueAttributes.map(attr => (
                  <SelectItem key={attr} value={attr}>{attr}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </header>

      {loading ? <GridSkeleton /> : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">Ícone</TableHead>
                <TableHead className="w-1/4">
                  <Button variant="ghost" onClick={() => requestSort('name')} className="px-2">
                    Nome {renderSortArrow('name')}
                  </Button>
                </TableHead>
                <TableHead>
                  <Button variant="ghost" onClick={() => requestSort('plaintext')} className="px-2">
                    Descrição {renderSortArrow('plaintext')}
                  </Button>
                </TableHead>
                <TableHead className="w-28 text-right">
                  <Button variant="ghost" onClick={() => requestSort('gold')} className="px-2">
                    Valor {renderSortArrow('gold')}
                  </Button>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSortedItems.length > 0 ? (
                filteredAndSortedItems.map((item) => (
                  <TableRow key={item.id} className="transition-opacity duration-300 ease-in-out">
                    <TableCell className="p-2">
                      <div className="flex items-center justify-center">
                        <Image
                          src={`https://ddragon.leagueoflegends.com/cdn/15.14.1/img/item/${item.image.full}`}
                          alt={item.name}
                          width={48}
                          height={48}
                          className="rounded-md transition-transform duration-200 hover:scale-110"
                        />
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell
                      className="text-muted-foreground text-sm max-w-md"
                      dangerouslySetInnerHTML={{ __html: item.description }}
                    />
                    <TableCell className="text-right font-mono text-accent">
                      {item.gold.total}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center">
                    Nenhum item encontrado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
