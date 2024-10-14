import dotenv from 'dotenv';
dotenv.config();
import Fastify from 'fastify';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';

// Import routes
import solanaRoutes from './connectors/solana';
import orcaRoutes from './connectors/orca';
import raydiumRoutes from './connectors/raydium';
import jupiterRoutes from './connectors/jupiter';
import meteoraRoutes from './connectors/meteora';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const SOLANA_NETWORK = process.env.SOLANA_NETWORK || 'mainnet-beta';

// Move the server configuration into a function
const configureServer = () => {
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
    },
  });

  // Register Swagger
  server.withTypeProvider<TypeBoxTypeProvider>();

  server.register(fastifySwagger, {
    openapi: {
      info: {
        title: 'larp',
        description: 'minimal middleware for on-chain liquidity providers',
        version: '0.0.1',
      },
      servers: [
        {
          url: '/',
        },
      ],
      tags: [
        { name: 'solana', description: 'Solana utility endpoints' },
        { name: 'orca', description: 'Orca LP endpoints' },
        { name: 'raydium', description: 'Raydium LP endpoints' },
        { name: 'meteora', description: 'Meteora LP endpoints' },
        // Add more tags for other connectors as needed
      ],
    },
    transform: ({ schema, url }) => {
      return {
        schema: Type.Strict(schema as any),
        url: url,
      };
    },
  });

  server.register(fastifySwaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list', // This makes tags collapsible
      deepLinking: false,
      tryItOutEnabled: true,
    },
    staticCSP: false,
    transformStaticCSP: (header) => header,
  });

  // Register routes
  server.register(solanaRoutes);
  server.register(jupiterRoutes);
  server.register(orcaRoutes);
  server.register(raydiumRoutes);
  server.register(meteoraRoutes);

  return server;
};

export const startServer = async (): Promise<void> => {
  const server = configureServer();
  try {
    await server.listen({ port: PORT, host: '0.0.0.0' });
    server.log.info(`Server listening on http://localhost:${PORT}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

export { configureServer };
