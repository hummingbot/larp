import { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { PublicKey } from '@solana/web3.js';
import { getAllPositionAccountsByOwner, PositionMap } from "@orca-so/whirlpools-sdk/dist/network/public";
import { OrcaController } from '../orca.controller';

// Update the interface for the PositionBundleData
interface PositionBundleData {
  positionBundleAddress: PublicKey;
  positionBitmapCount: number; // Changed from positionCount to positionBitmapCount
}

class BundlesOwnedController extends OrcaController {
  async getBundleData(address?: string): Promise<PositionBundleData[]> {
    await this.loadOrca();

    const publicKey = address ? new PublicKey(address) : this.ctx.wallet.publicKey;

    const positionMap: PositionMap = await getAllPositionAccountsByOwner({
      ctx: this.ctx as any,
      includesBundledPositions: true,
      includesPositions: false,
      includesPositionsWithTokenExtensions: false,
      owner: publicKey,
    });

    return positionMap.positionBundles
      .map(bundle => ({
        positionBundleAddress: bundle.positionBundleAddress as PublicKey,
        positionBitmapCount: bundle.positionBundleData.positionBitmap.filter(bit => bit !== 0).length, // Changed property name
      }))
      .sort((a, b) => b.positionBitmapCount - a.positionBitmapCount); // Updated sort comparison
  }
}

export default function bundlesOwnedRoute(fastify: FastifyInstance, folderName: string) {
  const controller = new BundlesOwnedController();

  fastify.get(`/${folderName}/bundles-owned`, {
    schema: {
      tags: [folderName],
      description: 'Retrieve a list of Orca position bundle data owned by an address or, if no address is provided, the user\'s wallet',
      querystring: Type.Object({
        address: Type.Optional(Type.String())
      }),
      response: {
        200: Type.Array(Type.Object({
          positionBundleAddress: Type.String(),
          positionBitmapCount: Type.Number()
        }))
      }
    },
    handler: async (request, reply) => {
      const { address } = request.query as { address?: string };

      fastify.log.info(`Getting Orca position bundle data for ${address || 'user wallet'}`);
      
      return await controller.getBundleData(address);
    }
  });
}
