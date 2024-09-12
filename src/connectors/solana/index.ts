import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import path from 'path';
import createWalletRoute from './routes/createWallet';
import getBalanceRoute from './routes/getBalance';

export const solanaRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // Get the folder name dynamically
  const folderName = path.basename(__dirname);

  // Register individual routes
  createWalletRoute(fastify, folderName);
  getBalanceRoute(fastify, folderName);
}

export default solanaRoutes;