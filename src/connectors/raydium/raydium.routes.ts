import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { RaydiumController } from './raydium.controller';
import path from 'path';

const raydiumRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const SOLANA_PRIVATE_KEY = process.env.SOLANA_PRIVATE_KEY;
  const SOLANA_NETWORK = process.env.SOLANA_NETWORK;

  if (!SOLANA_PRIVATE_KEY) {
    throw new Error('SOLANA_PRIVATE_KEY is not set in the environment variables');
  }

  if (!SOLANA_NETWORK) {
    throw new Error('SOLANA_NETWORK is not set in the environment variables');
  }

  const raydiumController = new RaydiumController();

  // Get the folder name dynamically
  const folderName = path.basename(__dirname);

  fastify.get(`/${folderName}/pool/:poolAddress`, {
    schema: {
      tags: [folderName],
      summary: 'Get pool info',
      description: 'Retrieve pool information from Raydium',
      params: {
        type: 'object',
        properties: {
          poolAddress: { type: 'string' }
        },
        required: ['poolAddress']
      },
      response: {
        200: {
          description: 'Successful response',
          type: 'object',
          properties: {
            poolInfo: { type: 'object' }
          }
        }
      }
    },
    handler: async (request, reply) => {
      const { poolAddress } = request.params as { poolAddress: string };
      fastify.log.warn(`Getting pool info for ${poolAddress}`);
      await raydiumController.fetchPool([poolAddress], reply);
    }
  });

  // You can add more routes here for additional functionality
};

export default raydiumRoutes;