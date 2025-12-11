export interface ItemAttribute {
  valor: number;
  descricao: string;
}

export interface Item {
  id: string;
  name: string;
  description: string;
  plaintext: string;
  into?: string[];
  from?: string[];
  image: {
    full: string;
    sprite: string;
    group: string;
    x: number;
    y: number;
    w: number;
    h: number;
  };
  gold: {
    base: number;
    purchasable: boolean;
    total: number;
    sell: number;
  };
  tags: string[];
  maps: {
    [key: string]: boolean;
  };
  stats: {
    [key: string]: number;
  };
  attributes?: ItemAttribute[];
}

export interface ItemData {
  [key: string]: Omit<Item, 'id' | 'attributes'>;
}

export interface ItemApiResponse {
  type: string;
  version: string;
  data: ItemData;
}
