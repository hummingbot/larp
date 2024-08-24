import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { OrcaController } from './orca.controller';
import { PositionsRequestSchema, PositionsResponseSchema } from '../../schemas';
import path from 'path';

const orcaRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const orcaController = new OrcaController();

  // Get the folder name dynamically
  const folderName = path.basename(__dirname);

  fastify.get(`/${folderName}/positions/:address`, {
    schema: {
      tags: [folderName],
      summary: 'Get positions for a specific address',
      description: 'Retrieve positions from Orca for a given address',
      params: PositionsRequestSchema,
      response: {
        200: PositionsResponseSchema,
      }
    },
    handler: async (request, reply) => {
      const { address } = request.params as { address: string };
      fastify.log.info(`Getting Orca positions for address: ${address}`);
      return orcaController.getPositions(request, reply);
    }
  });

  // You can add more routes here for additional functionality
};

export default orcaRoutes;