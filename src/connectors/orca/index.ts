import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import path from 'path';
import getPositionsRoute from './routes/getPositions';
import getPositionInfoRoute from './routes/getPositionInfo';
import addLiquidityRoute from './routes/addLiquidity';
import removeLiquidityRoute from './routes/removeLiquidity';

export const orcaRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // Get the folder name dynamically
  const folderName = path.basename(__dirname);

  // Register individual routes
  getPositionsRoute(fastify, folderName);
  getPositionInfoRoute(fastify, folderName);
  addLiquidityRoute(fastify, folderName);
  removeLiquidityRoute(fastify, folderName);
};

export default orcaRoutes;