import { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { TypeCompiler } from '@sinclair/typebox/compiler'
import { PublicKey } from '@solana/web3.js';
import { Client, UtlConfig, Token } from '@solflare-wallet/utl-sdk';
import { Connection } from '@solana/web3.js';
import { SolanaController } from '../solana.controller';
import { TokenInfoResponse } from './listTokens';

class GetTokenInfoController {
  private tokenInfoValidator = TypeCompiler.Compile(TokenInfoResponse);
  private utl: Client;
  private solanaController: SolanaController;
  private network: string;

  constructor() {
    this.network = process.env.SOLANA_NETWORK || 'mainnet-beta';
    const connectionUrl = this.network === 'devnet' 
      ? 'https://api.devnet.solana.com' 
      : 'https://api.mainnet-beta.solana.com';
    
    const config = new UtlConfig({
      chainId: this.network === 'devnet' ? 103 : 101,
      timeout: 2000,
      connection: new Connection(connectionUrl),
      apiUrl: "https://token-list-api.solana.cloud",
      cdnUrl: "https://cdn.jsdelivr.net/gh/solflare-wallet/token-list/solana-tokenlist.json"
    });
    this.utl = new Client(config);
    this.solanaController = new SolanaController();
  }

  async getTokenInfo(tokenAddress: string, useApi: boolean = false): Promise<string> {
    if (useApi && this.network !== 'mainnet-beta') {
      throw new Error('API usage is only allowed on mainnet-beta');
    }

    const publicKey = new PublicKey(tokenAddress);
    let token: Token;

    if (useApi) {
      token = await this.utl.fetchMint(publicKey);
    } else {
      const tokenList = this.solanaController.getTokenList();
      const foundToken = tokenList.find(t => t.address === tokenAddress);
      if (!foundToken) {
        throw new Error('Token not found in the token list');
      }
      token = foundToken as Token;
    }

    console.log(token);

    // Validate the token object against the schema
    if (!this.tokenInfoValidator.Check(token)) {
      throw new Error('Token info does not match the expected schema');
    }

    return JSON.stringify(token);
  }
}

export default function getTokenInfoRoute(fastify: FastifyInstance, folderName: string) {
  const controller = new GetTokenInfoController();

  fastify.get(`/${folderName}/token/:tokenAddress`, {
    schema: {
      tags: [folderName],
      description: 'Retrieve info about a Solana token',
      params: Type.Object({
        tokenAddress: Type.String()
      }),
      response: {
        200: TokenInfoResponse
      },
      querystring: Type.Object({
        useApi: Type.Optional(Type.Boolean({ default: false }))
      })
    },
    handler: async (request, reply) => {
      const { tokenAddress } = request.params as { tokenAddress: string };
      const { useApi = false } = request.query as { useApi?: boolean };
      fastify.log.info(`Getting Solana token info for address: ${tokenAddress}, useApi: ${useApi}`);
      
      const tokenInfo = await controller.getTokenInfo(tokenAddress, useApi);
      return tokenInfo;
    }
  });
}