import * as React from 'react';
import { Item } from '@/types/lol-items';
import { Badge } from './ui/badge';

type Props = {
  items: Item[];
  selectedItemIds: string[];
};

// Attributes that should display with '%' suffix
const PERCENT_ATTRS = new Set([
  'Velocidade de Ataque',
  'Chance de Acerto Crítico',
  'Velocidade de Movimento',
  'Tenacidade',
]);

export function AggregatesDisplay({ items, selectedItemIds }: Props) {
  const selectedItems = items.filter(i => selectedItemIds.includes(i.id));

  const totalGold = selectedItems.reduce((s, it) => s + (it.gold?.total ?? 0), 0);

  const attrMap = new Map<string, number>();
  selectedItems.forEach(it => {
    (it.attributes || []).forEach(attr => {
      const key = attr.descricao;
      const prev = attrMap.get(key) ?? 0;
      attrMap.set(key, prev + (attr.valor || 0));
    });
  });

  const attrs = Array.from(attrMap.entries()).map(([descricao, valor]) => ({ descricao, valor }));

  return (
    <div className="space-y-3">
      <div className="text-sm font-medium">Totalizador</div>
      <div className="flex flex-col gap-2">
        {attrs.length > 0 ? attrs.map(a => (
          <div key={a.descricao} className="text-sm">
            <strong className="text-accent">{a.valor}{PERCENT_ATTRS.has(a.descricao) ? '%' : ''}</strong>
            <span className="ml-2">de {a.descricao}</span>
          </div>
        )) : (
          <div className="text-sm text-muted-foreground">Nenhum atributo selecionado</div>
        )}
      </div>
      <div className="pt-2 border-t flex items-center justify-between">
        <div className="text-sm font-medium">Custo total</div>
        <div className="text-sm font-mono text-accent">{totalGold}</div>
      </div>
    </div>
  );
}
