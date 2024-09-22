import { Command, CliUx } from '@oclif/core'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import bs58 from 'bs58'

const WALLET_FILE = 'wallet.json'

class CreateWalletController {
	async createWallet(secretKey: string): Promise<void> {
		const secret_bytes = Uint8Array.from(bs58.decode(secretKey.trim()))
		const configDir = path.join(os.homedir(), '.larp')
		const walletPath = path.join(configDir, WALLET_FILE)

		// Create config directory if it doesn't exist
		if (!fs.existsSync(configDir)) {
			fs.mkdirSync(configDir, { recursive: true })
		}

		// Write file
		fs.writeFileSync(walletPath, `[${secret_bytes.toString()}]`)

		// Verify file
		const secret_bytes_loaded = JSON.parse(fs.readFileSync(walletPath, 'utf-8'))
		const secret_base58_loaded = bs58.encode(Uint8Array.from(secret_bytes_loaded))

		if (secretKey === secret_base58_loaded) {
			console.log(`${walletPath} created successfully!`)
		} else {
			throw new Error('Wallet verification failed')
		}
	}
}

export default class CreateWallet extends Command {
	static description = 'Create a new wallet'

	async run(): Promise<void> {
		const controller = new CreateWalletController()

		try {
			const secretKey = await CliUx.ux.prompt('Enter your secret key (base58)', { type: 'hide' })
			await controller.createWallet(secretKey)
			this.log('Wallet created successfully!')
		} catch (error) {
			this.error('Error creating wallet: ' + error.message)
		}
	}
}