# larp

*minimal middleware for on-chain liquidity providers*

This library standardizes common actions from Automated Market Makers (AMMs) and other DeFi protocols into REST endpoints. It allows market makers and other algorithmic participants to access different DeFi protocols through a single entry point.

## Install

1. Clone the repository:
   ```
   git clone https://github.com/fengtality/larp.git
   cd larp
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Set up environment variables:
   Modify the `env.template` file in the root directory and rename it as `.env`:
   ```
   PORT=3000
   SOLANA_NETWORK=mainnet-beta
   SOLANA_PRIVATE_KEY=<your-solana-wallet-private-key>
   ```

## Run

1. Start the server:
   ```
   npm start
   ```

2. Use your browser or curl to send requests to the endpoints. For example:
   ```
   curl http://localhost:3000/raydium/pool/<pool-address>
   ```

2. View docs at:
   ```
   http://localhost:3000/docs
   ```

   This will display the Swagger UI with detailed information about all available routes.


## Contribute

[Add information about how to contribute to the project]

## License

[Add your license information here]
