import axios, { AxiosResponse } from 'axios';
import { EventEmitter } from 'events';
import fs from 'fs';
import { to_console } from './utils';

type Params = {
  api_key: string;
  save_map_to_file?: boolean;
  map_file_folder?: string;
};

type Coin = {
  id: number;
  rank: number;
  name: string;
  symbol: string;
  slug: string;
  is_active: number;
  first_historical_data: string;
  last_historical_data: string;
  platform: any;
}

type CoinQuote = {
  id: number;
  name: string;
  symbol: string;
  slug: string;
  is_active: number;
  is_fiat: number;
  circulating_supply: number;
  total_supply: number;
  max_supply: number;
  date_added: string;
  num_market_pairs: number;
  cmc_rank: number;
  last_updated: string;
  tags: any[];
  platform: any;
  self_reported_circulating_supply: number;
  self_reported_market_cap: number;
  quote: {
    USD: {
      price: number;
      volume_24h: number;
      volume_change_24h: number;
      percent_change_1h: number;
      percent_change_24h: number;
      percent_change_7d: number;
      percent_change_30d: number;
      market_cap: number;
      market_cap_dominance: number;
      fully_diluted_market_cap: number;
      last_updated: string;
    }
  }
}

type CoinsMapItem = Record<string, Coin[]>;
type CoinsMapItemById = Record<string, Coin>;

export class Client {
  private readonly params: Params;
  private is_instance_ready: boolean = false;
  private save_map_to_file: boolean;
  private map_file_folder: string = './tmp';
  private coins_map: CoinsMapItem = {};
  private coins_map_by_id: CoinsMapItemById = {};

  private start_of_map_pagination: number = 1;
  private items_per_map_pagination: number = 5000; // max 5000

  public ee: EventEmitter;

  private validate_if_ready() {
    if (!this.is_instance_ready) {
      throw new Error('Instance is not ready');
    }
  }

  constructor(params: Params) {
    this.params = params;
    this.ee = new EventEmitter();
    this.save_map_to_file = params.save_map_to_file || false;
    this.map_file_folder = params.map_file_folder || this.map_file_folder;
    this.get_map();
  }

  private async api_get(endpoint: string, params: any): Promise<AxiosResponse> {
    return await axios.get(`https://pro-api.coinmarketcap.com/${endpoint}`, {
      headers: {
        'X-CMC_PRO_API_KEY': this.params.api_key
      },
      params: params
    });
  }

  private async get_map() {
    const params = {
      listing_status: 'active',
      start: this.start_of_map_pagination,
      limit: this.items_per_map_pagination,
      sort: 'id'
    };

    try {
      const response = await this.api_get('v1/cryptocurrency/map', params);

      // Handle the successful response
      const coins = response.data.data;
      this.coins_map = coins.reduce((acc: CoinsMapItem, coin: Coin) => {
        if (!acc[coin.symbol]) {
          acc[coin.symbol] = [];
        }
        acc[coin.symbol].push(coin);
        this.coins_map_by_id[coin.id] = coin;
        return acc;
      }, this.coins_map);

      if (coins.length !== 0) {
        this.start_of_map_pagination += this.items_per_map_pagination;
        this.get_map();
      } else {
        this.is_instance_ready = true;
        this.ee.emit('ready');

        if (this.save_map_to_file) {
          const file = `${this.map_file_folder}/coins_map.json`;
          await fs.writeFileSync(file, JSON.stringify(this.coins_map, null, 2));
          console.log(`Map saved to ${file}`);
        }
      }
    } catch (error) {
      // Handle any errors
      if (error instanceof Error) {
        console.error('Error fetching CoinMarketCap ID Map:', (error as any).response?.data || error.message);
      } else {
        console.error('Unknown error fetching CoinMarketCap ID Map');
      }
    }
  }

  public get_coins_by_symbol(symbol: string): Coin[] | null {
    this.validate_if_ready();
    return this.coins_map[symbol] || null;
  }

  public get_coin_by_symbol(symbol: string): Coin | null {
    this.validate_if_ready();
    const coins = this.get_coins_by_symbol(symbol);
    if (coins && coins.length > 1) {
      to_console(`Warning! Found ${coins.length} coins with symbol ${symbol}. Using the first one: ${coins[0].name}`);
    }
    return coins?.[0] || null;
  }

  public get_coin_by_id(id: number): Coin | null {
    this.validate_if_ready();
    return this.coins_map_by_id[id] || null;
  }

  public get_all_coins(): Coin[][] { 
    this.validate_if_ready();
    return Object.values(this.coins_map);
  }

  public get_coin_id_by_symbol(symbol: string): number | null {
    this.validate_if_ready();
    const coins = this.get_coins_by_symbol(symbol);
    if (coins && coins.length > 1) {
      to_console(`Warning! Found ${coins.length} coins with symbol ${symbol}. Using the first one: ${coins[0].name}`);
    }
    const coin = this.get_coins_by_symbol(symbol)?.[0];
    return coin ? coin.id : null;
  }

  public get_status(): boolean {
    return this.is_instance_ready;
  }

  public async get_coins_quotes_latest(coin_ids: number[]): Promise<any> {
    try {
      const ids_str = coin_ids.join(',');
      const response = await this.api_get('v2/cryptocurrency/quotes/latest', {
        id: ids_str
      });

      // The API returns data in the format { "data": { "1": { ... } } }
      // where "1" is the coin ID. We'll extract just the coin data.
      const coin_data = response.data.data;

      return coin_data;
    } catch (error) {
      // Handle any errors
      if (error instanceof Error) {
        console.error('Error fetching coin quotes:', (error as any).response?.data || error.message);
      } else {
        console.error('Unknown error fetching coin quotes');
      }
      throw error;
    }
  }

  public async get_coin_quotes_latest(coin_id: number): Promise<CoinQuote | null> {
    const coin_data = await this.get_coins_quotes_latest([coin_id]);
    return coin_data[coin_id] || null;
  }

  public async get_coin_quotes_latest_by_symbol(symbol: string): Promise<CoinQuote | null> {
    this.validate_if_ready();
    const coin_id = this.get_coin_id_by_symbol(symbol);
    if (!coin_id) {
      throw new Error(`Coin with symbol ${symbol} not found`);
    }
    return this.get_coin_quotes_latest(coin_id);
  }

  public async get_usd_price_of_asset(symbol: string): Promise<number | null> {
    this.validate_if_ready();
    const coin_data = await this.get_coin_quotes_latest_by_symbol(symbol.toUpperCase());
    return coin_data?.quote.USD.price || null;
  }

  public async get_usd_price_of_assets(symbols: string[]): Promise<Record<string, number | null>> {
    this.validate_if_ready();
    const coin_ids = symbols.map(symbol => this.get_coin_id_by_symbol(symbol)!);

    const coin_data = await this.get_coins_quotes_latest(coin_ids);
    
    return symbols.reduce((acc: Record<string, number | null>, symbol: string, index: number) => {
      const coin_id = coin_ids[index];
      const coin = coin_data[coin_id];
      acc[symbol] = coin?.quote?.USD?.price || null;
      return acc;
    }, {});
  }
}
