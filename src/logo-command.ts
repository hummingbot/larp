import { Command } from '@oclif/core';
import { asciiLogo } from './index';

export abstract class LogoCommand extends Command {
  async init(): Promise<void> {
    await super.init();
    this.log(asciiLogo);
  }
}