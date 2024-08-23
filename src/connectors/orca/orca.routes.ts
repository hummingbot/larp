import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { OrcaController } from './orca.controller';

const orcaRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const orcaController = new OrcaController();

  fastify.get('/positions', {
    schema: {
      description: 'Get positions',
      tags: ['orca'],
      response: {
        200: {
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