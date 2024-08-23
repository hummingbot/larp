import dotenv from 'dotenv';
dotenv.config();
import Fastify from 'fastify';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';

// Import routes
import orcaRoutes from './connectors/orca/orca.routes';
import raydiumRoutes from './connectors/raydium/raydium.routes';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

const server = Fastify({
    logger: {
      level: 'info',
      transport: {
        target: 'pino-pretty',
        options: {
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
        },
      },
    }
});

// Register Swagger
server.register(fastifySwagger, {
  swagger: {
    info: {
      title: 'larp',
      description: 'API for on-chain liquidity providers',
      version: '0.0.1'
    },
    externalDocs: {
      url: 'https://swagger.io',
      description: 'Find more info here'
    },
    host: `localhost:${PORT}`,
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
server.register(raydiumRoutes);

const start = async (): Promise<void> => {
  try {
    await server.listen({ port: PORT, host: '0.0.0.0' });
    server.log.info(`Server listening on http://localhost:${PORT}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();