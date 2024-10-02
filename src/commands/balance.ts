import { Command, Flags } from '@oclif/core'
import { GetBalanceController } from '../connectors/solana/routes/getBalance'

export default class Balance extends Command {
  static description = 'Get token balances for a Solana wallet'

  static flags = {
    address: Flags.string({char: 'a', description: 'Wallet address (optional)'}),
    symbols: Flags.string({char: 's', description: 'Comma-separated list of token symbols (optional)', multiple: true}),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(Balance)
    const controller = new GetBalanceController()

    try {
      const result = await controller.getBalance(flags.address, flags.symbols)
      const balances = JSON.parse(result)

      this.log(`Token balances for ${flags.address || 'default wallet'}:`)
      balances.forEach((balance: any) => {
        this.log(`${balance.name}: ${balance.uiAmount}`)
      })
    } catch (error) {
      this.error(`Error fetching balances: ${error.message}`)
    }
  }
}