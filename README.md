larp
=================

A client for on-chain liquidity providers

# Installation

## Clone repository

```sh-session
# Clone the repository
$ git clone https://github.com/fengtality/larp.git
$ cd larp
```

## Install dependencies
```sh-session
$ pnpm install
```

## Build distribution files
```sh-session
$ pnpm build
```

## Link `larp` command to global path
```sh-session
$ pnpm link -g
```

## Run `larp`
```sh-session
$ larp

minimal middleware for on-chain liquidity providers

VERSION
  larp/0.0.1 darwin-arm64 node-v20.13.1

USAGE
  $ larp [COMMAND]

TOPICS
  plugins  List installed plugins.

COMMANDS
  createWallet  Create a new wallet
  help          Display help for larp.
  plugins       List installed plugins.
```

# Setup

## Create wallet JSON
```sh-session
$ larp create-wallet
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

## Start server
```
$ pnpm start
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