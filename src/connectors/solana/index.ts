import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import path from 'path';
import { Type } from '@sinclair/typebox';
import { SolanaController } from './solana.controller';
import createWalletRoute from './routes/createWallet';

export const solanaRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // Get the folder name dynamically
  const folderName = path.basename(__dirname);
  const controller = new SolanaController();

  // Register individual routes
  createWalletRoute(fastify, folderName);

}

export default solanaRoutes;