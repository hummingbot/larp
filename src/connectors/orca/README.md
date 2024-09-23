# Orca Connector

This connector standardizes REST endpoints for interacting with [Orca](https://www.orca.so/), a Concentrated Liquidity (CLMM) DEX on the Solana blockchain.

## Maintainer

[fengtality](https://github.com/fengtality)

## Routes

GET /{folderName}/positions-owned
- Retrieve a list of Orca positions owned by an address or the user's wallet

GET /{folderName}/position/:positionAddress
- Retrieve info about an Orca position

GET /{folderName}/quote-fees/:positionAddress
- Get the fees quote for an Orca position

GET /{folderName}/quote-swap
- Get a swap quote for Orca

POST /{folderName}/execute-swap
- Execute a swap on Orca

POST /{folderName}/open-position
- Open a new Orca position

POST /{folderName}/close-position
- Close an Orca position

POST /{folderName}/add-liquidity-quote
- Get quote for adding liquidity to an Orca position

POST /{folderName}/add-liquidity
- Add liquidity to an Orca position

POST /{folderName}/remove-liquidity
- Remove liquidity from an Orca position

POST /{folderName}/collect-fees/:positionAddress
- Collect fees for an Orca position

GET /{folderName}/positions-in-bundle/:positionBundleAddress
- Retrieve info about all positions in an Orca position bundle

GET /{folderName}/fee-rewards-quote/:positionAddress
- Get the fees and rewards quote for an Orca position

POST /{folderName}/collect-fee-rewards/:positionAddress
- Collect fees and rewards for an Orca position

POST /{folderName}/create-position-bundle
- Create a new Orca position bundle

POST /{folderName}/open-positions-in-bundle
- Open multiple new bundled Orca positions

POST /{folderName}/add-liquidity-in-bundle
- Add liquidity to multiple Orca positions in a bundle

POST /{folderName}/remove-liquidity-in-bundle
- Remove liquidity from multiple Orca positions in a bundle

POST /{folderName}/close-positions-in-bundle
- Close all bundled Orca positions in a position bundle

POST /{folderName}/delete-position-bundle
- Delete an Orca position bundle