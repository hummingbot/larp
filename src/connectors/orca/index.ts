import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import path from 'path';
import getPositionsRoute from './routes/getPositions';
import getPositionInfoRoute from './routes/getPositionInfo';
import addLiquidityRoute from './routes/addLiquidity';
import removeLiquidityRoute from './routes/removeLiquidity';
import getFeesQuoteRoute from './routes/getFeesQuote';
import collectFeesRoute from './routes/collectFees';

export const orcaRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // Get the folder name dynamically
  const folderName = path.basename(__dirname);

  // Register individual routes
  getPositionsRoute(fastify, folderName);
  getPositionInfoRoute(fastify, folderName);
  addLiquidityRoute(fastify, folderName);
  removeLiquidityRoute(fastify, folderName);
  getFeesQuoteRoute(fastify, folderName);
  collectFeesRoute(fastify, folderName);
};

export default orcaRoutes;