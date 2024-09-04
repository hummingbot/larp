import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import path from 'path';
import getPositionsRoute from './routes/getPositions';
import getPositionInfoRoute from './routes/getPositionInfo';
import getFeesQuoteRoute from './routes/getFeesQuote';
import getSwapQuoteRoute from './routes/getSwapQuote';
import openPositionRoute from './routes/openPosition';
import addLiquidityRoute from './routes/addLiquidity';
import removeLiquidityRoute from './routes/removeLiquidity';
import collectFeesRoute from './routes/collectFees';
import collectFeeRewardsRoute from './routes/collectFeeRewards';
import closePositionRoute from './routes/closePosition';

export const orcaRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // Get the folder name dynamically
  const folderName = path.basename(__dirname);

  // Register individual routes
  getPositionsRoute(fastify, folderName);
  getPositionInfoRoute(fastify, folderName);
  getFeesQuoteRoute(fastify, folderName);
  getSwapQuoteRoute(fastify, folderName);
  openPositionRoute(fastify, folderName);
  addLiquidityRoute(fastify, folderName);
  removeLiquidityRoute(fastify, folderName);
  collectFeesRoute(fastify, folderName);
  collectFeeRewardsRoute(fastify, folderName);
  closePositionRoute(fastify, folderName);
};

export default orcaRoutes;