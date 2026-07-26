# Inner Forecast

An onchain inner-weather station on Base. Users can report one of six preset
conditions up to five times per UTC day.

## Setup

1. Deploy `contracts/InnerForecast.sol` on Base Mainnet.
2. Put the contract address in `src/config/contract.ts`.
3. Replace `bc_replace_me` in `src/config/wagmi.ts` with the Base Builder Code.
4. Add the Base App verification meta tag to `index.html`.
5. Run `npm install` and `npm run build`.

There is no token and no application fee. Users only pay Base network gas.
