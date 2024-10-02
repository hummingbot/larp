import { LogoCommand } from '../logo-command';
import { startServer } from '../server';

export default class Start extends LogoCommand {
  static description = 'Start the larp server.';

  async run(): Promise<void> {
    process.env.START_SERVER = 'true';
    this.log('Starting larp API server...');
    await startServer();
  }
}

