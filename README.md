larp
=================

A community-maintained client for on-chain liquidity providers.

larp standardizes operations with AMMs and other DeFi protocols on various blockchains. Each connector provides a set of standardized REST API endpoints and commands for common operations for a specific protocol of a particular type.

larp offers two primary modes of operation:

1. **Command Line Interface (CLI)**: 
   - Provides direct access to various commands and utilities.
   - Useful for quick operations like creating wallets, checking balances, and starting the API server.
   - Example commands: `larp createWallet`, `larp balance`, `larp start`

2. **REST API Server**:
   - When started with `larp start`, it runs a server exposing standardized REST endpoints for operations on various AMMs and chains.
   - Run automated LP and arbitrage strategies using the [Hummingbot client](https://github.com/hummingbot/hummingbot)
   - Perform research and visualize your strategies using [Hummingbot quants-lab](https://github.com/hummingbot/quants-lab)
   - API documentation available at `http://localhost:3000/docs` when the server is running.

This dual functionality allows users to interact with larp in a way that best suits their needs, whether through direct command-line operations or by integrating with the REST API in their applications.

## Maintainers

larp is an community-driven project that will be transitioned to the [Hummingbot Foundation](https://github.com/hummingbot) as the successor to [Gateway](https://github.com/hummingbot/gateway) once it is more feature complete.

Each connector within larp has a dedicated maintainer who commits to keeping it up-to-date with both larp and the underlying protocol. This community-driven approach allows us to leverage expertise across various protocols and blockchains, ensuring that larp remains a free, open-source tool for all liquidity providers.

Below is a list of current connectors and their maintainers:

| Connector | Type | Maintainer |
| --------- | ---- | ---------- |
| [Solana](/src/connectors/solana) | Chain | [fengtality](https://github.com/fengtality) |
| [Jupiter](/src/connectors/jupiter) | Aggregator | [fengtality](https://github.com/fengtality) |
| [Orca](/src/connectors/orca) | AMM | [fengtality](https://github.com/fengtality) |
| [Raydium](/src/connectors/raydium) | AMM | [fengtality](https://github.com/fengtality) |
| [Meteora](/src/connectors/meteora) | AMM | [mlguys](https://github.com/mlguys) |

## Installation

### Clone repository

```sh-session
# Clone the repository
$ git clone https://github.com/fengtality/larp.git
$ cd larp
```

### Install dependencies
```sh-session
$ pnpm install
```

### Build distribution files
```sh-session
$ pnpm build
```

### Link `larp` command to global path
```sh-session
$ pnpm link -g
```

### Run `larp`
```sh-session
$ larp

A client for on-chain liquidity providers

VERSION
  larp/0.0.1 darwin-arm64 node-v20.13.1

USAGE
  $ larp [COMMAND]

TOPICS
  plugins  List installed plugins.

COMMANDS
  createWallet  Create a Solana wallet JSON file from private key.
  help          Display help for larp.
  plugins       List installed plugins.
  start         Start the larp server.
```

# Setup

## Create wallet JSON
```sh-session
$ larp createWallet
```

## Confirm environment variables

1. Rename `env.example` file in the root directory as `.env`.
2. Modify the environment variables as needed.

```sh-session
PORT=3000
SOLANA_NETWORK=mainnet-beta
SOLANA_WALLET_JSON=wallet.json
```

# Usage

## Get balance on Solana (WIP)
```
$ larp balance
```

## Start API server
```sh-session
$ larp start
Starting larp server...
Solana connector initialized:
        - Network: devnet
        - RPC URL: https://api.devnet.solana.com
        - Wallet Public Key: <wallet_public_key>
        - Token List: devnet-tokenlist.json
```

## View server docs

See documentation for all routes at: [http://localhost:3000/docs](http://localhost:3000/docs).

# Contribute

Contributions are welcome! Please follow these steps:

1. Fork the [repository](http://github.com/fengtality/larp)
2. Create a folder connector following the [Orca](src/connectors/orca) folder and file structure
3. Ensure that your connector meets the standard (WIP)
4. Push your changes to your fork
5. Submit a pull request with a detailed description of your changes

For bug reports or feature requests, please open an [issue](http://github.com/fengtality/larp/issues) with a clear title and description.

## License

This project is licensed under the MIT License.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software