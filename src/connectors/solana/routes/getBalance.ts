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
  mint: Type.String(),
  name: Type.String(),
  uiAmount: Type.String(),
}));

class GetBalanceController extends SolanaController {
  private balanceResponseValidator = TypeCompiler.Compile(BalanceResponse);

  async getBalance(address?: string): Promise<string> {
    const publicKey = address ? new PublicKey(address) : new PublicKey(this.getWallet().publicKey);

    // Fetch the token list
    const tokenList = this.getTokenList();
    const tokenDefs = tokenList.reduce((acc, token) => {
      acc[token.address] = { name: token.symbol, decimals: token.decimals };
      return acc;
    }, {});

    // get all token accounts for the provided address
    const accounts = await this.connection.getTokenAccountsByOwner(
      publicKey, // Use the provided address
      { programId: TOKEN_PROGRAM_ID }
    );

    const tokenAccounts = [];
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
        // tokenAccount: value.pubkey.toBase58(),
        mint: mint.toBase58(),
        name: tokenDef.name,
        // amount: amount.toString(),
        uiAmount: uiAmount.toString(),
      });
    }

    const response = tokenAccounts; // Remove the tokenAccounts wrapper

    if (!this.balanceResponseValidator.Check(response)) {
      throw new Error('Balance response does not match the expected schema');
    }

    return JSON.stringify(response);
  }
}

export default function getBalanceRoute(fastify: FastifyInstance, folderName: string) {
    const controller = new GetBalanceController();
  
    fastify.get(`/${folderName}/balances`, {
      schema: {
        tags: [folderName],
        description: 'Get token balances for the specified wallet address or the user\'s wallet if not provided',
        querystring: Type.Object({
          address: Type.Optional(SolanaAddressSchema)
        }),
        response: {
          200: BalanceResponse,
          400: BadRequestResponseSchema
        }
      },
      handler: async (request, reply) => {
        const { address } = request.query as { address?: string };
        fastify.log.info(`Getting token balances for address: ${address || 'user wallet'}`);
        try {
          const result = await controller.getBalance(address);
          return result;
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