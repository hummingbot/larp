import Fastify from 'fastify';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import { OrcaController } from './connectors/orca/orca.controller';
import orcaRoutes from './connectors/orca/orca.routes';

const server = Fastify({
    logger: {
      level: 'warn',
      transport: {
        target: 'pino-pretty'
      }
    }
});

// Register Swagger
server.register(fastifySwagger, {
  swagger: {
    info: {
      title: 'Orca LP API',
      description: 'API for Orca liquidity providers',
      version: '1.0.0'
    },
    externalDocs: {
      url: 'https://swagger.io',
      description: 'Find more info here'
    },
    host: 'localhost:3000',
    schemes: ['http'],
    consumes: ['application/json'],
    produces: ['application/json']
  }
});

server.register(fastifySwaggerUi, {
  routePrefix: '/docs',
  uiConfig: {
    docExpansion: 'full',
    deepLinking: false
  },
  staticCSP: true
});

// Register routes
server.register(orcaRoutes);

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
