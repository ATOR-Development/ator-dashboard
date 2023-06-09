import Arweave from 'arweave'
import ArDB from 'ardb'
import ArdbTransaction from 'ardb/lib/models/transaction'
import { useTxCache } from './txCache'

const arweave = new Arweave({
  protocol: 'https',
  host: 'arweave.net',
  port: '443'
})
const ardb = new ArDB(arweave)

const { getTransactionData, saveTransactionData } = useTxCache()

export interface ValidationStats {
  consensus_weight: number
  consensus_weight_fraction: number
  observed_bandwidth: number
  verification: {
    failed: number
    running: number
    unclaimed: number
    verified: number
  }
  verified_and_running: {
    consensus_weight: number
    consensus_weight_fraction: number
    observed_bandwidth: number
  }
}

export type RelayVerificationResult =
    | 'OK'
    | 'AlreadyVerified'
    | 'NotRegistered'
    | 'Failed'
export interface ValidatedRelay {
  fingerprint: string
  ator_address: string
  consensus_weight: number
  consensus_weight_fraction: number
  observed_bandwidth: number
  running: boolean
}
export interface VerificationResultDto {
  result: RelayVerificationResult
  relay: ValidatedRelay
}

export class RelayMetrics {
  metricsDeployer!: string
  gateway!: string
  validationStats: ValidationStats | null = null
  validationStatsTimestamp: Date | null = null
  relayMetrics: VerificationResultDto[] = []
  relayMetricsTimestamp: Date | null = null

  constructor(
    gateway: string,
    metricsDeployer: string
  ) {
    this.gateway = gateway
    this.metricsDeployer = metricsDeployer
  }

  async refresh() {
    await this.refreshValidationStats()
    await this.refreshRelayMetrics()
  }

  private async refreshValidationStats() {
    const tx: ArdbTransaction | null = await ardb
      .search('transactions')
      .from(this.metricsDeployer)
      .tags([
        { name: 'Protocol', values: 'ator' },
        { name: 'Entity-Type', values: 'validation/stats' }
      ])
      .sort('HEIGHT_DESC')
      .findOne() as ArdbTransaction | null
  
    if (tx) {
      try {
        let validationStats = await getTransactionData(tx.id)

        if (!validationStats) {
          validationStats = await $fetch<ValidationStats>(`${this.gateway}/${tx.id}`)
          await saveTransactionData(tx.id, validationStats)
        }
  
        this.validationStats = validationStats
      } catch (error) {
        console.error('Could not fetch validation/stats tx', error)
      }

      const timestamp = parseInt(tx.tags.find(tag => tag.name === 'Content-Timestamp')?.value || '')
      if (!Number.isNaN(timestamp)) {
        this.validationStatsTimestamp = new Date(timestamp)
      }
    } else {
      console.error('Could not find validation/stats tx')
    }
  }

  private async refreshRelayMetrics() {
    const tx: ArdbTransaction | null = await ardb
      .search('transactions')
      .from(this.metricsDeployer)
      .tags([
        { name: 'Protocol', values: 'ator' },
        { name: 'Entity-Type', values: 'relay/metrics' }
      ])
      .sort('HEIGHT_DESC')
      .findOne() as ArdbTransaction | null

    if (tx) {
      try {
        let relayMetrics = await getTransactionData(tx.id)

        if (!relayMetrics) {
          relayMetrics = await $fetch<VerificationResultDto[]>(`${this.gateway}/${tx.id}`)
          await saveTransactionData(tx.id, relayMetrics)
        }
  
        this.relayMetrics = relayMetrics
      } catch (error) {
        console.error('Could not fetch relay/metrics tx', error)
      }

      const timestamp = parseInt(tx.tags.find(tag => tag.name === 'Content-Timestamp')?.value || '')
      if (!Number.isNaN(timestamp)) {
        this.relayMetricsTimestamp = new Date(timestamp)
      }
    } else {
      console.error('Could not find relay/metrics tx')
    }
  }
}

export const useRelayMetrics = async () => {
  const { arweave } = useAppConfig()
  const runtimeConfig = useRuntimeConfig()
  const metrics = new RelayMetrics(arweave.gateway, runtimeConfig.public.metricsDeployer)

  await metrics.refresh()

  return metrics
}
