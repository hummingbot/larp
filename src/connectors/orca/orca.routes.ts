import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { OrcaController } from './orca.controller';
import path from 'path';

const orcaRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const PRIVATE_KEY = process.env.PRIVATE_KEY;
  const NETWORK = process.env.NETWORK;

  if (!PRIVATE_KEY) {
    throw new Error('PRIVATE_KEY is not set in the environment variables');
  }

  if (!NETWORK) {
    throw new Error('NETWORK is not set in the environment variables');
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