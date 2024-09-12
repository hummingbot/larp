import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import path from 'path';
import createWalletRoute from './routes/createWallet';
import getBalanceRoute from './routes/getBalance';
import getTokenListRoute from './routes/listTokens';
import getTokenInfoRoute from './routes/getTokenInfo';

export const solanaRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // Get the folder name dynamically
  const folderName = path.basename(__dirname);

  // Register individual routes
  createWalletRoute(fastify, folderName);
  getBalanceRoute(fastify, folderName);
  getTokenListRoute(fastify, folderName);
  getTokenInfoRoute(fastify, folderName);
}

export default solanaRoutes;