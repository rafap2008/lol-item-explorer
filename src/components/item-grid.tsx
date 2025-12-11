'use client';

import * as React from 'react';
import Image from 'next/image';
import { ArrowUp, ArrowDown, ChevronsUpDown, Search } from 'lucide-react';
import { Item } from '@/types/lol-items';
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

type SortKey = 'name' | 'plaintext' | 'gold' | 'attribute';
type SortDirection = 'ascending' | 'descending';

interface ItemGridProps {
  initialItems: Item[];
  uniqueAttributes: string[];
}

export function ItemGrid({ initialItems, uniqueAttributes }: ItemGridProps) {
  const [filter, setFilter] = React.useState('');
  const [selectedAttribute, setSelectedAttribute] = React.useState('');
  const [sortConfig, setSortConfig] = React.useState<{ key: SortKey; direction: SortDirection } | null>({
    key: 'name',
    direction: 'ascending',
  });

  const filteredAndSortedItems = React.useMemo(() => {
    let sortableItems = [...initialItems];

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
          return bAttr - aAttr; // Always descending for attributes
        }
        
        let aValue: string | number;
        let bValue: string | number;

        if (sortConfig.key === 'gold') {
          aValue = a.gold.total;
          bValue = b.gold.total;
        } else {
          aValue = a[sortConfig.key]?.toLowerCase() ?? '';
          bValue = b[sortConfig.key]?.toLowerCase() ?? '';
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
  }, [initialItems, filter, sortConfig, selectedAttribute]);

  const requestSort = (key: SortKey) => {
    let direction: SortDirection = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
    if(key !== 'attribute') {
      setSelectedAttribute('');
    }
  };

  const handleAttributeSortChange = (attribute: string) => {
    if (attribute && attribute !== 'default') {
      setSelectedAttribute(attribute);
      setSortConfig({ key: 'attribute', direction: 'descending' });
    } else {
      setSelectedAttribute('');
      // Revert to default sort (name, ascending) if no attribute is selected
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

  return (
    <div className="space-y-6">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 pt-8 pb-4">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
          <h1 className="text-3xl font-bold text-foreground">LoL Item Explorer</h1>
          <div className="flex w-full flex-col sm:flex-row sm:w-auto sm:items-center gap-2">
            <div className="relative w-full sm:w-72">
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
    </div>
  );
}
