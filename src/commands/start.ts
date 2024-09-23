import { LogoCommand } from '../logo-command';
import { startServer } from '../index';

export default class Start extends LogoCommand {
  static description = 'Start the larp server.';

  async run(): Promise<void> {
    this.log('Starting larp API server...');
    await startServer();
  }
}

