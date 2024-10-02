import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import path from 'path';
import getPositionInfoRoute from './routes/getPositionInfo';
import getFeesQuoteRoute from './routes/getFeesQuote';
import getSwapQuoteRoute from './routes/quoteSwap';
import executeSwapRoute from './routes/executeSwap';
import openPositionRoute from './routes/openPosition';
import closePositionRoute from './routes/closePosition';
import getAddLiquidityQuoteRoute from './routes/addLiquidityQuote';
import addLiquidityRoute from './routes/addLiquidity';
import removeLiquidityRoute from './routes/removeLiquidity';
import collectFeesRoute from './routes/collectFees';
import getPositionsInBundleRoute from './routes/getPositionsInBundle';
import collectFeeRewardsRoute from './routes/collectFeeRewards';
import createPositionBundleRoute from './routes/createPositionBundle';
import openPositionsInBundleRoute from './routes/openPositionsInBundle';
import addLiquidityInBundleRoute from './routes/addLiquidityInBundle';
import removeLiquidityInBundleRoute from './routes/removeLiquidityInBundle';
import closePositionsInBundleRoute from './routes/closePositionsInBundle';
import deletePositionBundleRoute from './routes/deletePositionBundle';
import positionsOwnedRoute from './routes/getPositionsOwnedBy';

export const orcaRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // Get the folder name dynamically
  const folderName = path.basename(__dirname);

  // Register individual routes
  positionsOwnedRoute(fastify, folderName);
  getPositionInfoRoute(fastify, folderName);
  getFeesQuoteRoute(fastify, folderName);
  getSwapQuoteRoute(fastify, folderName);
  executeSwapRoute(fastify, folderName);
  openPositionRoute(fastify, folderName);
  closePositionRoute(fastify, folderName);
  getAddLiquidityQuoteRoute(fastify, folderName);
  addLiquidityRoute(fastify, folderName);
  removeLiquidityRoute(fastify, folderName);
  collectFeesRoute(fastify, folderName);
  getPositionsInBundleRoute(fastify, folderName);
  collectFeeRewardsRoute(fastify, folderName);
  createPositionBundleRoute(fastify, folderName);
  openPositionsInBundleRoute(fastify, folderName);
  addLiquidityInBundleRoute(fastify, folderName);
  removeLiquidityInBundleRoute(fastify, folderName);
  closePositionsInBundleRoute(fastify, folderName);
  deletePositionBundleRoute(fastify, folderName);
};

export default orcaRoutes;