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
   If you have `pnpm` installed:
   ```
   pnpm install
   ```
   If you don't have `pnpm`, you can install it globally first:
   ```
   npm install -g pnpm
   ```
   Or use npm directly:
   ```
   npm install
   ```

3. Generate the wallet JSON file from a Solana private key
   ```
   pnpm create-wallet
   ```

4. Set up environment variables:
   Check the `env.example` file in the root directory and rename it as `.env`:
   ```
   PORT=3000
   SOLANA_NETWORK=mainnet-beta
   SOLANA_WALLET_JSON=wallet.json
   ```

## Run

1. Start the server:
   ```
   pnpm start
   ```

2. View the docs with detailed information about all available routes at:
   ```
   http://localhost:3000/docs
   ```

## Contribute

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a new branch for your feature or bug fix
3. Make your changes and commit them with clear, descriptive messages
4. Push your changes to your fork
5. Submit a pull request with a detailed description of your changes

For bug reports or feature requests, please open an issue with a clear title and description.

## License

This project is licensed under the MIT License.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software