import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import path from 'path';
import getPoolInfoRoute from './routes/getPoolInfo';

export const raydiumRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // Get the folder name dynamically
  const folderName = path.basename(__dirname);

  // Register individual routes
  getPoolInfoRoute(fastify, folderName);

};

export default raydiumRoutes;