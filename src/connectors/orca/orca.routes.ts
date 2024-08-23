import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { OrcaController } from './orca.controller';

const orcaRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const orcaController = new OrcaController();

  fastify.get('/positions', {
    schema: {
      tags: ['orca'],
      summary: 'Get positions',
      description: 'Retrieve positions from Orca',
      response: {
        200: {
          description: 'Successful response',
          type: 'object',
          properties: {
            positions: { type: 'array', items: { type: 'string' } },
            wallet: { type: 'string' }
          }
        }
      }
    },
    handler: async (request, reply) => {
      fastify.log.info('Getting positions');
      return orcaController.getPositions(request, reply);
    }
  });
};

export default orcaRoutes;