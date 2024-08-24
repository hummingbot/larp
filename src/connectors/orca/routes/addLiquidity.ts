import { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { PublicKey } from '@solana/web3.js';
import { increaseLiquidityQuoteByInputTokenWithParams, TokenExtensionUtil } from "@orca-so/whirlpools-sdk";
import { DecimalUtil, Percentage } from "@orca-so/common-sdk";
import Decimal from "decimal.js";
import { OrcaController } from '../orca.controller';

class AddLiquidityController extends OrcaController {
  async addLiquidity(positionAddress: string): Promise<{ signature: string }> {
    await this.initializeClient();

    // Token definition
    // devToken specification
    // https://everlastingsong.github.io/nebula/
    const devUSDC = {mint: new PublicKey("BRjpCHtyQLNCo8gqRUr8jtdAj5AjPYQaoqbvcZiHok1k"), decimals: 6};
    const devSAMO = {mint: new PublicKey("Jd4M8bfJG3sAkd82RsGWyEXoaBXQP7njFzBwEaCTuDa"), decimals: 9};

    // Retrieve the position address from the WHIRLPOOL_POSITION environment variable
    const position_address = process.env.WHIRLPOOL_POSITION;
    const position_pubkey = new PublicKey(position_address);
    console.log("position address:", position_pubkey.toBase58());

    // Get the position and the pool to which the position belongs
    const position = await this.client.getPosition(position_pubkey);
    const whirlpool = await this.client.getPool(position.getData().whirlpool);

    // Set amount of tokens to deposit and acceptable slippage
    const dev_usdc_amount = DecimalUtil.toBN(new Decimal("1" /* devUSDC */), devUSDC.decimals);
    const slippage = Percentage.fromFraction(10, 1000); // 1%

    // Obtain deposit estimation
    const whirlpool_data = whirlpool.getData();
    const token_a = whirlpool.getTokenAInfo();
    const token_b = whirlpool.getTokenBInfo();
    const quote = increaseLiquidityQuoteByInputTokenWithParams({
        // Pass the pool definition and state
        tokenMintA: token_a.mint,
        tokenMintB: token_b.mint,
        sqrtPrice: whirlpool_data.sqrtPrice,
        tickCurrentIndex: whirlpool_data.tickCurrentIndex,
        // Pass the price range of the position as is
        tickLowerIndex: position.getData().tickLowerIndex,
        tickUpperIndex: position.getData().tickUpperIndex,
        // Input token and amount
        inputTokenMint: devUSDC.mint,
        inputTokenAmount: dev_usdc_amount,
        // Acceptable slippage
        slippageTolerance: slippage,
        // Get token info for TokenExtensions
        tokenExtensionCtx: await TokenExtensionUtil.buildTokenExtensionContext(this.ctx.fetcher, whirlpool_data),
    });

    // Output the estimation
    console.log("devSAMO max input:", DecimalUtil.fromBN(quote.tokenMaxA, token_a.decimals).toFixed(token_a.decimals));
    console.log("devUSDC max input:", DecimalUtil.fromBN(quote.tokenMaxB, token_b.decimals).toFixed(token_b.decimals));

    // Output the liquidity before transaction execution
    console.log("liquidity(before):", position.getData().liquidity.toString());

    // Create a transaction
    const increase_liquidity_tx = await position.increaseLiquidity(quote);

    // Send the transaction
    const signature = await increase_liquidity_tx.buildAndExecute();
    console.log("signature:", signature);

    // Wait for the transaction to complete
    const latest_blockhash = await this.ctx.connection.getLatestBlockhash();
    await this.ctx.connection.confirmTransaction({signature, ...latest_blockhash}, "confirmed");

    // Output the liquidity after transaction execution
    console.log("liquidity(after):", (await position.refreshData()).liquidity.toString());

    return {
      signature,
    };
  }
}

export default function addLiquidityRoute(fastify: FastifyInstance, folderName: string) {
  const controller = new AddLiquidityController();

  fastify.post(`/${folderName}/addLiquidity`, {
    schema: {
      tags: [folderName],
      description: 'Add liquidity to an Orca position',
      body: Type.Object({
        positionAddress: Type.String(),
      }),
      response: {
        200: Type.Object({
          signature: Type.String(),
        })
      }
    },
    handler: async (request, reply) => {
      const { positionAddress } = request.body as { positionAddress: string };
      fastify.log.info(`Adding liquidity to Orca position: ${positionAddress}`);
      const result = await controller.addLiquidity(positionAddress);
      return result;
    }
  });
}