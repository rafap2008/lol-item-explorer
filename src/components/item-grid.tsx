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
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from './ui/skeleton';
import { AggregatesDisplay } from './aggregates-display';

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
  const [clientError, setClientError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    const onError = (e: ErrorEvent) => {
      console.error('Captured window error', e);
      setClientError(e.error || new Error(e.message || 'Unknown error'));
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      console.error('Captured unhandled rejection', e);
      const reason = (e.reason instanceof Error) ? e.reason : new Error(String(e.reason));
      setClientError(reason);
    };
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);
  const [items, setItems] = React.useState<Item[]>([]);
  const [maps, setMaps] = React.useState<MapItem[]>([]);
  const [uniqueAttributes, setUniqueAttributes] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(true);

  const [filter, setFilter] = React.useState('');
  const [selectedAttribute, setSelectedAttribute] = React.useState('');
  const [selectedMaps, setSelectedMaps] = React.useState<string[]>([]);
  const [sortConfig, setSortConfig] = React.useState<{ key: SortKey; direction: SortDirection } | null>({
    key: 'name',
    direction: 'ascending',
  });

  // Versão do Data Dragon (usada para buscar itens e imagens)
  const [ddragonVersion, setDdragonVersion] = React.useState<string>('15.24.1');

  // Seleção de itens do inventário (até 6)
  const [selectedItemIds, setSelectedItemIds] = React.useState<string[]>([]);
  const [selectionEnabled, setSelectionEnabled] = React.useState<boolean>(false);

  const toggleSelectItem = (itemId: string) => {
    if (!selectionEnabled) return; // ignore when selection disabled
    setSelectedItemIds((prev) => {
      if (prev.includes(itemId)) return prev.filter((id) => id !== itemId);
      if (prev.length >= 6) return prev; // silenciosamente limitar a 6
      return [...prev, itemId];
    });
  };
  const clearSelection = () => setSelectedItemIds([]);

  const toggleSelectionEnabled = (checked?: boolean | 'mixed') => {
    const enabled = checked === undefined ? !selectionEnabled : !!checked;
    setSelectionEnabled(enabled);
    if (!enabled) clearSelection();
  };

  // Normaliza texto removendo acentos e caracteres não alfanuméricos
  const normalizeText = (s?: string) => {
    const str = (s ?? '').toString();
    const decomposed = typeof str.normalize === 'function' ? str.normalize('NFD') : str;
    return decomposed
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^0-9a-zA-Z\s]/g, '')
      .toLowerCase()
      .trim();
  };

  // Lista de itens do tipo 'cabeça' (nomes em inglês e PT-BR)
  const headItemNames = React.useMemo(() => {
    const names = [
      "Abyssal Mask", "Máscara Abissal",
      "Bloodletter's Curse", "Maldição Sanguessuga",
      "Cosmic Drive", "Ímpeto Cósmico",
      "Edge of Night", "Limiar da Noite",
      "Experimental Hexplate", "Hexoplaca Experimental",
      "Fimbulwinter",
      "Haunting Guise", "Máscara Assustadora",
      "Hollow Radiance", "Resplendor Vazio",
      "Hubris", "Húbris",
      "Jak'Sho, The Protean", "Jak'Sho, o Inconstante",
      "Knight's Vow", "Juramento do Cavaleiro",
      "Liandry's Torment", "Tormento de Liandry",
      "Rabadon's Deathcap", "Capuz da Morte de Rabadon",
      "Riftmaker", "Criafendas",
      "Shurelya's Battlesong", "Hino Bélico de Shurelya",
      "Spectre's Cowl", "Capuz do Espectro",
      "Wooglet's Witchcap", "Chapéu Mágico de Wooglet",
    ];
    return new Set(names.map((n) => normalizeText(n)));
  }, []);

  React.useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        // fetch latest versions to determine which DATA Dragon version to use
        const versionsResp = await fetch('https://ddragon.leagueoflegends.com/api/versions.json');
        if (!versionsResp.ok) throw new Error('Failed to fetch versions');
        const versions: string[] = await versionsResp.json();
        const latest = versions && versions.length ? versions[0] : ddragonVersion;
        setDdragonVersion(latest);

        const [itemResponse, mapsResponse] = await Promise.all([
          fetch(`https://ddragon.leagueoflegends.com/cdn/${latest}/data/pt_BR/item.json`),
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
            const isHead = headItemNames.has(normalizeText(itemData.name)) || headItemNames.has(normalizeText(itemData.plaintext));
            return {
              ...itemData,
              id,
              attributes,
              annotations: isHead ? 'Cabeça/Chapéu/Máscara' : '',
            };
          })
          .filter(item => {
            if (item.gold.total <= 0) return false;
            if (!selectedMaps || selectedMaps.length === 0) return true;
            return selectedMaps.some(sm => item.maps[sm] === true);
          });

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
  }, [selectedMaps]);

  const filteredAndSortedItems = React.useMemo(() => {
    let sortableItems = [...items];

    if (filter) {
      const normalizedFilter = normalizeText(filter);
      sortableItems = sortableItems.filter((item) => {
        const name = normalizeText(item.name);
        const plaintext = normalizeText(item.plaintext);
        const descBase = item.description?.replace(/<[^>]*>/g, '') || '';
        const descText = normalizeText(`${descBase} ${item.annotations || ''}`);
        return (
          name.includes(normalizedFilter) ||
          plaintext.includes(normalizedFilter) ||
          descText.includes(normalizedFilter)
        );
      });
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


  // Toggle a map selection
  const toggleMapSelection = (mapId: string, checked?: boolean | "mixed") => {
    setSelectedMaps((prev) => {
      const exists = prev.includes(mapId);
      const shouldCheck = checked === undefined ? !exists : !!checked;
      if (shouldCheck && !exists) return [...prev, mapId];
      if (!shouldCheck && exists) return prev.filter((m) => m !== mapId);
      return prev;
    });
  };

  // Group maps by name (distinct names) -> mapIds[]
  const groupedMapsByName = React.useMemo(() => {
    const map = new Map<string, number[]>();
    maps.forEach((m) => {
      const arr = map.get(m.mapName) || [];
      arr.push(m.mapId);
      map.set(m.mapName, arr);
    });
    return map;
  }, [maps]);

  const distinctMapNames = React.useMemo(() => Array.from(groupedMapsByName.keys()).sort(), [groupedMapsByName]);

  // Toggle selection by map name (affects all associated mapIds)
  const toggleMapNameSelection = (mapName: string, checked?: boolean | "mixed") => {
    const ids = (groupedMapsByName.get(mapName) || []).map(String);
    setSelectedMaps((prev) => {
      const allSelected = ids.every((id) => prev.includes(id));
      const shouldCheck = checked === undefined ? !allSelected : !!checked;
      if (shouldCheck) {
        // add ids (avoid duplicates)
        const next = new Set(prev);
        ids.forEach((id) => next.add(id));
        return Array.from(next);
      } else {
        // remove ids
        return prev.filter((p) => !ids.includes(p));
      }
    });
  };

  // Retorna nomes distintos de mapas onde o item está disponível
  const getItemMapNames = (item: Item) => {
    if (!item.maps) return [] as string[];
    const ids = Object.entries(item.maps)
      .filter(([id, val]) => !!val)
      .map(([id]) => id);
    const names = ids
      .map((id) => maps.find((m) => String(m.mapId) === id)?.mapName)
      .filter(Boolean) as string[];
    return Array.from(new Set(names));
  };

  const selectedDistinctNames = React.useMemo(() => {
    return distinctMapNames.filter((name) => {
      const ids = groupedMapsByName.get(name) || [];
      return ids.some((id) => selectedMaps.includes(String(id)));
    });
  }, [distinctMapNames, groupedMapsByName, selectedMaps]);

  const allMapsSelected = maps.length > 0 && selectedMaps.length === maps.length;
  const toggleAllMaps = (checked?: boolean | "mixed") => {
    const shouldCheck = checked === undefined ? !allMapsSelected : !!checked;
    if (shouldCheck) setSelectedMaps(maps.map(m => m.mapId.toString()));
    else setSelectedMaps([]);
  }

  const headerRef = React.useRef<HTMLElement | null>(null);
  const [availableHeight, setAvailableHeight] = React.useState<number>(0);

  // Selected panel resizing
  const [selectedPanelWidth, setSelectedPanelWidth] = React.useState<number>(243); // default: 75% of previous ~324px
  const isDraggingRef = React.useRef(false);
  const draggingModeRef = React.useRef<'main' | 'inner' | null>(null);
  const startXRef = React.useRef(0);
  const startWidthRef = React.useRef(0);
  const asideRef = React.useRef<HTMLDivElement | null>(null);
  const [isLargeScreen, setIsLargeScreen] = React.useState<boolean>(typeof window !== 'undefined' ? window.innerWidth >= 1024 : false);

  React.useEffect(() => {
    function updateAvailable() {
      const headerH = headerRef.current?.getBoundingClientRect().height ?? 0;
      const vh = typeof window !== 'undefined' ? window.innerHeight : 0;
      const extra = 48; // padding/margins allowance
      const computed = Math.max(220, vh - headerH - extra);
      setAvailableHeight(computed);
    }

    updateAvailable();
    function handleResize() {
      updateAvailable();
      setIsLargeScreen(window.innerWidth >= 1024);
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  React.useEffect(() => {
    // cleanup in case of unmount while dragging
    return () => {
      isDraggingRef.current = false;
      window.removeEventListener('mousemove', onMouseMove as any);
      window.removeEventListener('mouseup', onMouseUp as any);
      window.removeEventListener('touchmove', onTouchMove as any);
      window.removeEventListener('touchend', onTouchEnd as any);
    };
  }, []);

  const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

  const onMouseMove = (e: MouseEvent) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - startXRef.current;
    if (draggingModeRef.current === 'main') {
      // dragging main splitter: positive dx should decrease aside width (so main grid grows)
      const newAside = clamp(startAsideWidthRef.current - dx, asideMin, asideMax);
      setAsideWidth(newAside);
    } else {
      // inner splitter (between selected and totals): positive dx increases selected width
      const maxSelected = asideWidth - totalsMin - splitterThickness;
      const newWidth = clamp(startWidthRef.current + dx, 180, maxSelected);
      setSelectedPanelWidth(newWidth);
    }
  };

  const onMouseUp = () => {
    isDraggingRef.current = false;
    draggingModeRef.current = null;
    window.removeEventListener('mousemove', onMouseMove as any);
    window.removeEventListener('mouseup', onMouseUp as any);
  };

  const onTouchMove = (e: TouchEvent) => {
    if (!isDraggingRef.current) return;
    const touch = e.touches[0];
    const dx = touch.clientX - startXRef.current;
    if (draggingModeRef.current === 'main') {
      const newAside = clamp(startAsideWidthRef.current - dx, asideMin, asideMax);
      setAsideWidth(newAside);
    } else {
      const maxSelected = asideWidth - totalsMin - splitterThickness;
      const newWidth = clamp(startWidthRef.current + dx, 180, maxSelected);
      setSelectedPanelWidth(newWidth);
    }
  };

  const onTouchEnd = () => {
    isDraggingRef.current = false;
    window.removeEventListener('touchmove', onTouchMove as any);
    window.removeEventListener('touchend', onTouchEnd as any);
  };

  const onSplitterMouseDown = (e: React.MouseEvent) => {
    draggingModeRef.current = 'inner';
    isDraggingRef.current = true;
    startXRef.current = e.clientX;
    startWidthRef.current = selectedPanelWidth;
    window.addEventListener('mousemove', onMouseMove as any);
    window.addEventListener('mouseup', onMouseUp as any);
  };

  const onSplitterTouchStart = (e: React.TouchEvent) => {
    draggingModeRef.current = 'inner';
    isDraggingRef.current = true;
    const touch = e.touches[0];
    startXRef.current = touch.clientX;
    startWidthRef.current = selectedPanelWidth;
    window.addEventListener('touchmove', onTouchMove as any, { passive: false } as any);
    window.addEventListener('touchend', onTouchEnd as any);
  };

  const onMainSplitterMouseDown = (e: React.MouseEvent) => {
    draggingModeRef.current = 'main';
    isDraggingRef.current = true;
    startXRef.current = e.clientX;
    startAsideWidthRef.current = asideWidth;
    window.addEventListener('mousemove', onMouseMove as any);
    window.addEventListener('mouseup', onMouseUp as any);
  };

  const onMainSplitterTouchStart = (e: React.TouchEvent) => {
    draggingModeRef.current = 'main';
    isDraggingRef.current = true;
    const touch = e.touches[0];
    startXRef.current = touch.clientX;
    startAsideWidthRef.current = asideWidth;
    window.addEventListener('touchmove', onTouchMove as any, { passive: false } as any);
    window.addEventListener('touchend', onTouchEnd as any);
  };

  const totalsCardWidth = 288; // matches lg:w-72 (18rem -> 288px)
  const splitterThickness = 8; // hit area for main splitter
  const [asideWidth, setAsideWidth] = React.useState<number>(720); // total width reserved for aside on large screens
  const startAsideWidthRef = React.useRef<number>(asideWidth);
  const asideMin = 360;
  const asideMax = 1200;
  const totalsMin = 140;

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
      <div className="max-h-[60vh] overflow-auto" style={availableHeight ? { maxHeight: `${availableHeight}px` } : {}}>
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
                <TableCell className="p-2"><Skeleton className="h-10 w-10 rounded-md" /></TableCell>
                <TableCell><Skeleton className="h-6 w-3/4" /></TableCell>
                <TableCell><Skeleton className="h-6 w-full" /></TableCell>
                <TableCell><Skeleton className="h-6 w-1/2 ml-auto" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );

  if (clientError) {
    return (
      <div className="space-y-6 p-6">
        <Card>
          <h2 className="text-lg font-bold">Erro no cliente</h2>
          <pre className="whitespace-pre-wrap mt-2 text-sm">{clientError.stack || String(clientError)}</pre>
        </Card>
      </div>
    );
  }

  try {
    return (
      <div className="space-y-6">
        <header ref={headerRef} className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 pt-8 pb-4">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex items-baseline gap-3">
              <h1 className="text-3xl font-bold text-foreground">LoL Item Explorer</h1>
              <span className="text-sm text-muted-foreground">Versão: {ddragonVersion}</span>
            </div>
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
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full sm:w-[200px] justify-between">
                    {selectedDistinctNames.length === 0 ? 'Selecionar mapa' : selectedDistinctNames.length === 1 ? selectedDistinctNames[0] : `${selectedDistinctNames.length} selecionados`}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[260px]">
                  <div className="space-y-2 max-h-64 overflow-auto">
                    <label className="flex items-center gap-2">
                      <Checkbox checked={allMapsSelected} onCheckedChange={(c) => toggleAllMaps(c)} />
                      <span className="text-sm font-medium">Selecionar todos</span>
                    </label>
                    <div className="border-t" />
                    {distinctMapNames.map((name) => {
                      const ids = groupedMapsByName.get(name) || [];
                      const allSelected = ids.every((id) => selectedMaps.includes(String(id)));
                      const someSelected = ids.some((id) => selectedMaps.includes(String(id)));
                      const checkedProp: boolean | "mixed" = allSelected ? true : someSelected ? "mixed" : false;
                      return (
                        <label key={name} className="flex items-center gap-2">
                          <Checkbox
                            checked={checkedProp}
                            onCheckedChange={(c) => toggleMapNameSelection(name, c)}
                          />
                          <span className="text-sm">{name}</span>
                        </label>
                      );
                    })}
                  </div>
                </PopoverContent>
              </Popover>
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

              <div className="hidden sm:flex items-center gap-2">
                <label className="flex items-center gap-2">
                  <Checkbox checked={selectionEnabled} onCheckedChange={(c) => toggleSelectionEnabled(c)} />
                  <span className="text-sm">Ativar seleção</span>
                </label>
              </div>
            </div>
          </div>
        </header>

        <div className="flex flex-col lg:flex-row gap-4 items-stretch" style={availableHeight ? { height: `${availableHeight}px` } : {}}>
          <div className="flex-1">
            {loading ? <GridSkeleton /> : (
              <Card className="h-full">
                <div className="overflow-auto h-full">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-20">Ícone</TableHead>
                        <TableHead className="w-1/4">Nome</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Mapas</TableHead>
                        <TableHead className="w-28 text-right">Valor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAndSortedItems.length > 0 ? (
                        filteredAndSortedItems.map(item => (
                          <TableRow key={item.id} className={`transition-opacity duration-200 ${(selectionEnabled && selectedItemIds.includes(item.id)) ? 'bg-secondary/40' : ''}`}>
                            <TableCell className="p-2">
                              <div className="flex items-center gap-2">
                                {selectionEnabled ? (
                                  <input
                                    type="checkbox"
                                    checked={selectedItemIds.includes(item.id)}
                                    onChange={() => toggleSelectItem(item.id)}
                                    aria-label={`Selecionar ${item.name}`}
                                  />
                                ) : null}
                                <div className="flex items-center justify-center">
                                  <Image
                                    src={`https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/img/item/${item.image?.full}`}
                                    alt={item.name}
                                    width={40}
                                    height={40}
                                    className="rounded-md"
                                  />
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="font-medium">{item.name}</TableCell>
                            <TableCell className="text-muted-foreground text-sm max-w-md">
                              {
                                (() => {
                                  const isHead = headItemNames.has(normalizeText(item.name)) || headItemNames.has(normalizeText(item.plaintext));
                                  let descHtml = (item.description || '');
                                  if (isHead) {
                                    const tagHtml = '<br/><headitem>Cabeça/Chapéu/Máscara</headitem>';
                                    if (descHtml.includes('</mainText>')) {
                                      descHtml = descHtml.replace(/<\/mainText>/i, `${tagHtml}</mainText>`);
                                    } else {
                                      descHtml = descHtml + tagHtml;
                                    }
                                  }
                                  return <div dangerouslySetInnerHTML={{ __html: descHtml }} />;
                                })()
                              }
                            </TableCell>
                            <TableCell className="w-48">
                              <div className="flex flex-wrap gap-2">
                                {getItemMapNames(item).length > 0 ? (
                                  getItemMapNames(item).map((name) => (
                                    <Badge key={name} variant="outline">{name}</Badge>
                                  ))
                                ) : (
                                  <span className="text-sm text-muted-foreground">—</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-mono text-accent">{item.gold.total}</TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={5}>Nenhum item encontrado.</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            )}
          </div>
          {selectionEnabled && isLargeScreen && (
            // Splitter between main grid and aside (desktop)
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Redimensionar painel principal"
              onMouseDown={onMainSplitterMouseDown}
              onTouchStart={onMainSplitterTouchStart}
              className="hidden lg:flex items-stretch cursor-col-resize select-none"
              style={{ width: `${splitterThickness}px` }}
            >
              <div className="w-0.5 h-full bg-transparent hover:bg-slate-200/60 mx-auto" />
            </div>
          )}

          {selectionEnabled && (
            <aside ref={asideRef} className="w-full flex-shrink-0" style={isLargeScreen ? { width: `${asideWidth}px` } : undefined}>
              <div className="flex flex-col lg:flex-row gap-3 h-full">
                <Card className="w-full lg:flex-none h-full min-w-[180px]" style={isLargeScreen ? { width: `${selectedPanelWidth}px` } : undefined}>
                  <div className="flex flex-col gap-3 p-3 overflow-auto h-full">
                    <div className="flex items-center justify-between">
                      <div className="text-sm">Selecionados: {selectedItemIds.length} / 6</div>
                      <Button variant="ghost" onClick={clearSelection}>Limpar</Button>
                    </div>

                    <div className="flex flex-col gap-3">
                      {selectedItemIds.length > 0 ? (
                        selectedItemIds.map(id => {
                          const it = items.find(i => i.id === id);
                          if (!it) return null;
                          return (
                            <div key={id} className="border rounded p-3">
                              <div className="flex items-center gap-3">
                                <Image
                                  src={`https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/img/item/${it.image.full}`}
                                  alt={it.name}
                                  width={36}
                                  height={36}
                                  className="rounded-md"
                                />
                                <div>
                                  <div className="font-medium">{it.name}</div>
                                  <div className="text-xs text-muted-foreground">Valor: {it.gold.total}</div>
                                </div>
                              </div>

                              <div className="mt-2 text-sm text-muted-foreground">
                                {it.attributes && it.attributes.length ? (
                                  <ul className="list-disc pl-5">
                                    {it.attributes.map(attr => (
                                      <li key={attr.descricao}>{attr.descricao}: {attr.valor}</li>
                                    ))}
                                  </ul>
                                ) : (
                                  <div className="text-xs text-muted-foreground">Sem atributos.</div>
                                )}
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="p-4 text-sm text-muted-foreground">Nenhum item selecionado.</div>
                      )}

                    </div>
                  </div>
                </Card>

                {/* Splitter (desktop only) */}
                <div
                  role="separator"
                  aria-orientation="vertical"
                  aria-label="Redimensionar painel de seleção"
                  onMouseDown={onSplitterMouseDown}
                  onTouchStart={onSplitterTouchStart}
                  className="hidden lg:flex items-stretch cursor-col-resize select-none"
                >
                  <div className="w-2 h-full bg-transparent hover:bg-slate-200/60 transition-colors" />
                </div>

                <Card className="h-full" style={isLargeScreen ? { width: `${Math.max(totalsMin, asideWidth - selectedPanelWidth - splitterThickness)}px` } : undefined}>
                  <div className="p-4 overflow-auto h-full">
                    <AggregatesDisplay items={items} selectedItemIds={selectedItemIds} />
                  </div>
                </Card>
              </div>
            </aside>
          )}
        </div>
      </div>
    );
  } catch (err: any) {
    console.error('ItemGrid render error', err);
    return (
      <div className="space-y-6 p-6">
        <Card>
          <h2 className="text-lg font-bold">Erro ao renderizar ItemGrid</h2>
          <pre className="whitespace-pre-wrap mt-2 text-sm">{String(err && (err.stack || err.message || err))}</pre>
        </Card>
      </div>
    );
  }
}
