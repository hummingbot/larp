import { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { SolanaController } from '../solana.controller';

export default function createWalletRoute(fastify: FastifyInstance, folderName: string) {
  const controller = new SolanaController();

  fastify.get(`/${folderName}/create-wallet`, {
    schema: {
      tags: [folderName],
      description: 'Get Solana wallet JSON for a given private key',
      response: {
        200: Type.Object({
          publicKey: Type.String(),
          network: Type.String()
        })
      }
    },
    handler: async (request, reply) => {
      fastify.log.info('Getting Solana wallet information');
      const walletInfo = controller.getWallet();
      return walletInfo;
    }
  })
}