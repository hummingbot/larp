import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import path from 'path';
import getPositionsRoute from './routes/getPositions';
import getPositionInfoRoute from './routes/getPositionInfo';
import getPositionsInBundleRoute from './routes/getPositionsInBundle';
import getFeesQuoteRoute from './routes/getFeesQuote';
import getSwapQuoteRoute from './routes/getSwapQuote';
import executeSwapRoute from './routes/executeSwap';
import openPositionRoute from './routes/openPosition';
import closePositionRoute from './routes/closePosition';
import addLiquidityRoute from './routes/addLiquidity';
import removeLiquidityRoute from './routes/removeLiquidity';
import collectFeesRoute from './routes/collectFees';
import collectFeeRewardsRoute from './routes/collectFeeRewards';
import createPositionBundleRoute from './routes/createPositionBundle';
import openPositionInBundleRoute from './routes/openPositionInBundle';
import addLiquidityInBundleRoute from './routes/addLiquidityInBundle';
import deletePositionBundleRoute from './routes/deletePositionBundle';


export const orcaRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // Get the folder name dynamically
  const folderName = path.basename(__dirname);

  // Register individual routes
  getPositionsRoute(fastify, folderName);
  getPositionInfoRoute(fastify, folderName);
  getPositionsInBundleRoute(fastify, folderName);
  getFeesQuoteRoute(fastify, folderName);
  getSwapQuoteRoute(fastify, folderName);
  executeSwapRoute(fastify, folderName);
  openPositionRoute(fastify, folderName);
  closePositionRoute(fastify, folderName);
  addLiquidityRoute(fastify, folderName);
  removeLiquidityRoute(fastify, folderName);
  collectFeesRoute(fastify, folderName);
  collectFeeRewardsRoute(fastify, folderName);
  createPositionBundleRoute(fastify, folderName);
  openPositionInBundleRoute(fastify, folderName);
  addLiquidityInBundleRoute(fastify, folderName);
  deletePositionBundleRoute(fastify, folderName);
};

export default orcaRoutes;