# CoinMarketCap API Client

This TypeScript library provides a convenient wrapper for the CoinMarketCap API, allowing easy access to cryptocurrency data.

## Features

- Fetch and cache cryptocurrency map data
- Retrieve coin information by symbol
- Get latest quotes for cryptocurrencies
- Fetch USD prices for assets

## Usage

### Installation

```bash
npm install @igorpronin/coinmarketcap-client
```

### Code Example

```typescript
import { Client } from '@igorpronin/coinmarketcap-client';
const client = new Client({ 
  api_key: 'YOUR_API_KEY',
  save_map_to_file: true, // optional, default: false
  map_file_folder: './tmp', // optional, default: './tmp'
});
client.ee.on('ready', async () => {
  // Get coin information
  const bitcoin = client.get_coin_by_symbol('BTC');
  console.log(bitcoin);
  // Get latest quotes
  const btcQuotes = await client.get_coin_quotes_latest_by_symbol('BTC');
  console.log(btcQuotes);
  // Get USD price
  const ethPrice = await client.get_usd_price_of_asset('ETH');
  console.log(`ETH price: $${ethPrice}`);
});
```

## API

- `get_coins_by_symbol(symbol: string): Coin[] | null`
- `get_coin_by_symbol(symbol: string): Coin | null`
- `get_coin_by_id(id: number): Coin | null`
- `get_all_coins(): Coin[][]`
- `get_coin_id_by_symbol(symbol: string): number | null`
- `get_status(): boolean`
- `get_coin_quotes_latest(coin_id: number): Promise<CoinQuote>`
- `get_coin_quotes_latest_by_symbol(symbol: string): Promise<CoinQuote>`
- `get_usd_price_of_asset(symbol: string): Promise<number | null>`
- `get_usd_price_of_assets(symbols: string[]): Promise<Record<string, number | null>>`

## Note

Make sure to replace 'YOUR_API_KEY' with your actual CoinMarketCap API key when initializing the client.

