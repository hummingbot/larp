import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { OrcaController } from './orca.controller';
import path from 'path';

const orcaRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const SOLANA_PRIVATE_KEY = process.env.SOLANA_PRIVATE_KEY;
  const SOLANA_NETWORK = process.env.SOLANA_NETWORK;

  if (!SOLANA_PRIVATE_KEY) {
    throw new Error('SOLANA_PRIVATE_KEY is not set in the environment variables');
  }

  if (!SOLANA_NETWORK) {
    throw new Error('SOLANA_NETWORK is not set in the environment variables');
  }

  const orcaController = new OrcaController();

  // Get the folder name dynamically
  const folderName = path.basename(__dirname);

  fastify.get(`/${folderName}/positions`, {
    schema: {
      tags: [folderName],
      summary: 'Get positions',
      description: 'Retrieve positions from Orca',
      response: {
        200: {
          description: 'Successful response',
          type: 'object',
          properties: {
            positions: { type: 'array', items: { type: 'string' } },
          }
        }
      }
    },
    handler: async (request, reply) => {
      fastify.log.info('Getting positions');
      return orcaController.getPositions(request, reply);
    }
  });

  // You can add more routes here for additional functionality
};

export default orcaRoutes;