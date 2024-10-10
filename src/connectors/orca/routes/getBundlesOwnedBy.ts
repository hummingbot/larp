import { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { PublicKey } from '@solana/web3.js';
import { getAllPositionAccountsByOwner, PositionMap } from "@orca-so/whirlpools-sdk/dist/network/public";
import { OrcaController } from '../orca.controller';

class BundlesOwnedController extends OrcaController {
  async getBundleAddresses(address?: string): Promise<string[]> {
    await this.loadOrca();

    const publicKey = address ? new PublicKey(address) : this.ctx.wallet.publicKey;

    const positionMap: PositionMap = await getAllPositionAccountsByOwner({
      ctx: this.ctx as any,
      includesBundledPositions: true,
      includesPositions: false,
      includesPositionsWithTokenExtensions: false,
      owner: publicKey,
    });

    return positionMap.positionBundles.map(bundle => bundle.positionBundleAddress.toString());
  }
}

export default function bundlesOwnedRoute(fastify: FastifyInstance, folderName: string) {
  const controller = new BundlesOwnedController();

  fastify.get(`/${folderName}/bundles-owned`, {
    schema: {
      tags: [folderName],
      description: 'Retrieve a list of Orca position bundle addresses owned by an address or, if no address is provided, the user\'s wallet',
      querystring: Type.Object({
        address: Type.Optional(Type.String())
      }),
      response: {
        200: Type.Array(Type.String())
      }
    },
    handler: async (request, reply) => {
      const { address } = request.query as { address?: string };

      fastify.log.info(`Getting Orca position bundle addresses for ${address || 'user wallet'}`);
      
      const bundleAddresses = await controller.getBundleAddresses(address);
      return bundleAddresses;
    }
  });
}
