```
 _      __    ___   ___  
| |    / /\  | |_) | |_) 
|_|__ /_/--\ |_| \ |_| 
```

`larp` is a Typescript-based CLI and API client for on-chain liquidity providers (LP), maintained by the [Hummingbot](https://github.com/hummingbot) community. The client standardizes common LP actions on decentralized exchanges (DEX) and other DeFi protocols across different blockchains.

Similar to Hummingbot exchange connectors, a `larp` connector provides a shared, standardized interface for a DEX or other DeFi protocol, supports `larp` CLI commands, and provides REST API endpoints when the server is running.

Each connector has a dedicated [Maintainer](#maintainers) and resides in a sub-folder inside the [/src/connectors](/src/connectors) folder.

`larp` offers two primary modes of operation:

1. [Command Line Interface (CLI)](#using-the-cli): 
   - Commands for common liquidity provider operations on each connector.
   - Useful for operations like creating wallets, fetching token info, and checking balances/portfolio.
   - Current commands: `larp createWallet`, `larp start`
   - Coming soon: `larp balance`, `larp token`, `larp portfolio`
   - Based on [Oclif](https://oclif.io/), an open source framework for building a command line interfaces (CLI) in Typescript.

2. [REST API Server](#using-the-api-server):
   - Run a server exposing standardized REST API endpoints for operations on each connector.
   - Run automated LP and arbitrage strategies using the [Hummingbot client](https://github.com/hummingbot/hummingbot)
   - Perform research and visualize your strategies using [Hummingbot quants-lab](https://github.com/hummingbot/quants-lab)
   - Based on [Fastify](https://fastify.dev/), an open source Typescript server framework.

## Maintainers

`larp` is an community-driven project that will be transitioned to the [Hummingbot Foundation](https://github.com/hummingbot) as the successor to [Gateway](https://github.com/hummingbot/gateway) once it is more feature complete.

Each connector within `larp` has a dedicated maintainer who commits to keeping it up-to-date with both larp and the underlying protocol. This community-driven approach allows us to leverage expertise across various DeFi protocols and blockchains, ensuring that `larp` remains a free, open-source tool for the global liquidity provider community.

Below is a list of current connectors and their maintainers:

| Connector | Type | Maintainer |
| --------- | ---- | ---------- |
| [Solana](/src/connectors/solana) | Chain | [fengtality](https://github.com/fengtality) |
| [Jupiter](/src/connectors/jupiter) | Aggregator | [fengtality](https://github.com/fengtality) |
| [Orca](/src/connectors/orca) | CLMM | [fengtality](https://github.com/fengtality) |
| [Raydium](/src/connectors/raydium) | AMM, CLMM | [fengtality](https://github.com/fengtality) |
| [Meteora](/src/connectors/meteora) | CLMM | [mlguys](https://github.com/mlguys) |

### For Prospective Maintainers

Hummingbot Foundation only plans to maintain a small set of reference connectors of each type. We welcome interest from the community to maintain connectors for other protocols. 

If you'd like to maintain a connector for a protocol not listed above, please open an [issue](https://github.com/hummingbot/larp/issues) and list your qualifications.

## Connector Types

Currently, `larp` supports connectors of the following standard types:

- **Chain**: L1/L2 blockchain
- **Aggregator**: Liquidity aggregator
- **AMM**: Automated Market Maker (AMM) pools similar to Raydium Standard pools
- **CLMM**: Concentrated Liquidity pools similar to Orca Whirlpool pools.

Future support is planned for more connector types, such as other types of DEXs, lending protocools, staking providers, and cross-chain bridges.

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

>Note: We use `pnpm`, a faster and more efficient alternative to `npm`, to install the dependencies. To install `pnpm` globally, run `npm install -g pnpm`.

### Build distribution files
```sh-session
$ pnpm build
```

### Link `larp` command to global path
```sh-session
$ pnpm link
```

>Note: If you get an error saying that the `larp` command is not found, try adding the following to your `.zshrc` or `.bashrc`:

```sh-session
export PATH="$PATH:$HOME/Library/pnpm/global/5/node_modules/.bin"
```

Afterwards, runn `pnpm unlink -g` to remove the global link and try the `pnpm link` command again.


## Using the CLI

### See commands
```sh-session
$ larp
 _      __    ___   ___  
| |    / /\  | |_) | |_) 
|_|__ /_/--\ |_| \ |_| 

A CLI and API client for on-chain liquidity providers, maintained by Hummingbot.

VERSION
  larp/0.0.1 darwin-arm64 node-v20.13.1

USAGE
  $ larp [COMMAND]
```

### Get help

```sh-session
$ larp help
```

### Create wallet JSON

Create a Solana wallet JSON file from a private key and save it in user's `/.larp/` configs folder.

```sh-session
$ larp createWallet
Enter your private key (base58): <private_key>
Wallet created successfully!
```

## Start API server

Starts a local REST API server at the PORT specified in `.env` (default `3000`).

```sh-session
$ larp start
 _      __    ___   ___  
| |    / /\  | |_) | |_) 
|_|__ /_/--\ |_| \ |_| 

A CLI and API client for on-chain liquidity providers, maintained by Hummingbot.

Starting larp server...
```

## Using the API Server

First, ensure that you have a wallet JSON file in the root directory (see [Create wallet JSON](#create-wallet-json)).

1. Rename `env.example` file in the root directory as `.env`.
2. Modify the environment variables as needed.

```sh-session
PORT=3000
SOLANA_NETWORK=mainnet-beta
SOLANA_WALLET_JSON=wallet.json
```

Next, start the API server by running `larp start`:

```sh-session
$ larp start
Starting larp server...
Solana connector initialized:
        - Network: devnet
        - RPC URL: https://api.devnet.solana.com
        - Wallet Public Key: <wallet_public_key>
        - Token List: devnet-tokenlist.json
```

### API Documentation

Run `larp start` to start the server, then navigate to [http://localhost:3000/docs](http://localhost:3000/docs) to view the API documentation and test the endpoints.

## Contribute

Currently, `larp` is still in the alpha stages of development. Once it is officially released, we will accept connector contributions from external maintainers.

In the meantime, we welcome you to fork the project and contribute by reporting/fixing bugs, adding documentation, and/or requesting features.

1. Fork the [repository](http://github.com/fengtality/larp).
2. Report bugs or request features by opening a detailed [issue](http://github.com/fengtality/larp/issues).
3. Submit bug and documentation fixes by opening a [pull request](https://github.com/fengtality/larp/pulls) with rationale for the changes you made.

## License

`larp` is licensed under the [MIT License](https://opensource.org/license/mit).

Copyright 2024 Michael Feng

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
