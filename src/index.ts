import Fastify from 'fastify';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import { OrcaController } from './connectors/orca/orca.controller';
import orcaRoutes from './connectors/orca/orca.routes';

const server = Fastify({
    logger: {
      level: 'info',
      transport: {
        target: 'pino-pretty'
      }
    }
});

// Register Swagger
server.register(fastifySwagger, {
  openapi: {
    info: {
      title: 'Orca LP API',
      description: 'API for Orca liquidity providers',
      version: '1.0.0'
    },
    servers: [
      {
        url: 'http://localhost:3000'
      }
    ]
  }
});
server.register(fastifySwaggerUi, {
  routePrefix: '/docs'
});

// Orca
const orcaController = new OrcaController();
orcaRoutes(server, orcaController);

const start = async () => {
  try {
    await server.listen({ port: 3000 });
    console.log('Server listening on http://localhost:3000');
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
