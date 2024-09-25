import axios, { AxiosResponse } from 'axios';
import { EventEmitter } from 'events';

type Params = {
  api_key: string;
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

export class Client {
  private readonly params: Params;
  private is_instance_ready: boolean = false;
  private coins_map: Record<string, Coin> = {};

  public ee: EventEmitter;

  constructor(params: Params) {
    this.params = params;
    this.ee = new EventEmitter();
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
      start: '1',
      limit: '5000',
      sort: 'id'
    };

    try {
      const response = await this.api_get('v1/cryptocurrency/map', params);

      // Handle the successful response
      const coins = response.data.data;
      this.coins_map = coins.reduce((acc: Record<string, Coin>, coin: Coin) => {
        acc[coin.symbol] = coin;
        return acc;
      }, {});
      this.is_instance_ready = true;
      this.ee.emit('ready');
    } catch (error) {
      // Handle any errors
      if (error instanceof Error) {
        console.error('Error fetching CoinMarketCap ID Map:', (error as any).response?.data || error.message);
      } else {
        console.error('Unknown error fetching CoinMarketCap ID Map');
      }
    }
  }

  public get_coin_by_symbol(symbol: string): Coin | null {
    return this.coins_map[symbol] || null;
  }

  public get_all_coins(): Coin[] {
    return Object.values(this.coins_map);
  }

  public get_coin_id_by_symbol(symbol: string): number | null {
    const coin = this.get_coin_by_symbol(symbol);
    return coin ? coin.id : null;
  }

  public get_status(): boolean {
    return this.is_instance_ready;
  }

  public async get_coin_quotes_latest(coin_id: number): Promise<any> {
    try {
      const response = await this.api_get('v2/cryptocurrency/quotes/latest', {
        id: coin_id
      });

      // The API returns data in the format { "data": { "1": { ... } } }
      // where "1" is the coin ID. We'll extract just the coin data.
      const coin_data = response.data.data[coin_id];

      if (!coin_data) {
        throw new Error(`No data found for coin ID ${coin_id}`);
      }

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

  public async get_coin_quotes_latest_by_symbol(symbol: string): Promise<CoinQuote> {
    const coin_id = this.get_coin_id_by_symbol(symbol);
    if (!coin_id) {
      throw new Error(`Coin with symbol ${symbol} not found`);
    }
    return this.get_coin_quotes_latest(coin_id);
  }

  public async get_usd_price_of_asset(symbol: string): Promise<number> {
    const coin_data = await this.get_coin_quotes_latest_by_symbol(symbol.toUpperCase());
    return coin_data.quote.USD.price;
  }
}
