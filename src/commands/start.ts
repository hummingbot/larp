import { Command } from '@oclif/core'
import { startServer } from '../index'

export default class Start extends Command {
  static description = 'Start the larp server.'

  async run(): Promise<void> {
    this.log('Starting larp server...')
    await startServer()
  }
}