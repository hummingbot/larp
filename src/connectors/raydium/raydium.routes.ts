import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { RaydiumController } from './raydium.controller';
import { PoolInfoRequestSchema, PoolInfoResponseSchema } from '../../schemas';
import path from 'path';

const raydiumRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const raydiumController = new RaydiumController();

  // Get the folder name dynamically
  const folderName = path.basename(__dirname);

  fastify.get(`/${folderName}/pool/:poolAddress`, {
    schema: {
      tags: [folderName],
      summary: 'Get pool info',
      description: 'Retrieve pool information from Raydium',
      params: PoolInfoRequestSchema,
      example: 'hello',
      response: {
        200: PoolInfoResponseSchema
      }
    },
    handler: async (request, reply) => {
      const { poolAddress } = request.params as { poolAddress: string };
      fastify.log.info(`Getting pool info for ${poolAddress}`);
      await raydiumController.fetchPool(request, reply);
      fastify.log.info(`Response sent for pool ${poolAddress}.`);
    }
  });

  // You can add more routes here for additional functionality
};

export default raydiumRoutes;