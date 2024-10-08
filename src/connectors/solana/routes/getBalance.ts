import { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { TypeCompiler } from '@sinclair/typebox/compiler'
import { PublicKey, Connection } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, unpackAccount } from "@solana/spl-token";
import { DecimalUtil } from "@orca-so/common-sdk";
import BN from "bn.js";
import {
  SolanaController,
  SolanaAddressSchema,
  BadRequestResponseSchema,
} from '../solana.controller';

// Update the BalanceResponse schema
const BalanceResponse = Type.Array(Type.Object({
  address: Type.String(),
  symbol: Type.String(),
  amount: Type.String(),
}));

export class GetBalanceController extends SolanaController {
  private balanceResponseValidator = TypeCompiler.Compile(BalanceResponse);

  async getBalance(address?: string, symbols?: string[]): Promise<any> {
    const publicKey = address ? new PublicKey(address) : new PublicKey(this.getWallet().publicKey);

    const tokenAccounts = [];

    // Fetch SOL balance only if symbols is undefined or includes "SOL"
    if (!symbols || symbols.includes("SOL")) {
      const solBalance = await this.connection.getBalance(publicKey);
      tokenAccounts.push({
        address: "11111111111111111111111111111111",
        symbol: "SOL",
        amount: (solBalance / 1e9).toString(), // Convert lamports to SOL
      });
    }

    // Fetch the token list
    const tokenList = this.getTokenList();
    const tokenDefs = tokenList.reduce((acc, token) => {
      if (!symbols || symbols.includes(token.symbol)) {
        acc[token.address] = { name: token.symbol, decimals: token.decimals };
      }
      return acc;
    }, {});

    // get all token accounts for the provided address
    const accounts = await this.connection.getTokenAccountsByOwner(
      publicKey, // Use the provided address
      { programId: TOKEN_PROGRAM_ID }
    );

    // loop through all the token accounts and fetch the requested tokens
    for (const value of accounts.value) {
      const parsedTokenAccount = unpackAccount(value.pubkey, value.account);
      const mint = parsedTokenAccount.mint;
      const tokenDef = tokenDefs[mint.toBase58()];
      if (tokenDef === undefined) continue;

      const amount = parsedTokenAccount.amount;
      const uiAmount = DecimalUtil.fromBN(new BN(amount.toString()), tokenDef.decimals);

      // push requested tokens' info to the tokenAccounts array
      tokenAccounts.push({
        address: mint.toBase58(),
        symbol: tokenDef.name,
        amount: uiAmount.toString(),
      });
    }

    const response = tokenAccounts;

    if (!this.balanceResponseValidator.Check(response)) {
      throw new Error('Balance response does not match the expected schema');
    }

    return response; // Return the object directly, not stringified
  }
}

export default function getBalanceRoute(fastify: FastifyInstance, folderName: string) {
    const controller = new GetBalanceController();
  
    fastify.get(`/${folderName}/balance`, {
      schema: {
        tags: [folderName],
        description: 'Get token balances for the specified wallet address or the user\'s wallet if not provided',
        querystring: Type.Object({
          address: Type.Optional(SolanaAddressSchema),
          symbols: Type.Optional(Type.Array(Type.String(), { default: ["SOL"] }))
        }),
        response: {
          200: BalanceResponse,
          400: BadRequestResponseSchema
        }
      },
      handler: async (request, reply) => {
        const { address, symbols } = request.query as { address?: string; symbols?: string[] };
        fastify.log.info(`Getting token balances for address: ${address || 'user wallet'}`);
        try {
          const result = await controller.getBalance(address, symbols);
          reply.send(result); // Use reply.send() to let Fastify handle the serialization
        } catch (error) {
          fastify.log.error(error);
          reply.status(500).send({
            statusCode: 500,
            error: 'Internal Server Error',
            message: 'An error occurred while fetching token balances'
          });
        }
      }
  });
}