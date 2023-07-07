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

export type MetricsEntityType = 'validation/stats' | 'relay/metrics'

type ResolveMetricsEntityType<
  MET extends MetricsEntityType
> = MET extends 'validation/stats'
  ? ValidationStats
  : MET extends 'relay/metrics'
    ? VerificationResultDto[]
    : never

class MetricsEntityCache<MET extends MetricsEntityType> {
  public stats: {
    stats: ResolveMetricsEntityType<MET>,
    timestamp: Date
  }[] = []

  push(stats: ResolveMetricsEntityType<MET>, timestamp: Date) {
    this.stats.push({ stats, timestamp })
    this.stats.sort((a, b) => {
      if (a.timestamp > b.timestamp) { return -1 }
      if (a.timestamp < b.timestamp) { return 1 }
      return 0
    })
  }

  get latest() {
    return this.stats.some(s => !!s) ? this.stats[0] : null
  }
}

export class RelayMetrics {
  metricsDeployer!: string
  gateway!: string

  metrics: { [MET in MetricsEntityType]: MetricsEntityCache<MET> } = {
    'relay/metrics': new MetricsEntityCache<'relay/metrics'>,
    'validation/stats': new MetricsEntityCache<'validation/stats'>
  }

  constructor(
    gateway: string,
    metricsDeployer: string
  ) {
    this.gateway = gateway
    this.metricsDeployer = metricsDeployer
  }

  async refresh() {
    await this.refreshMetricsEntity('validation/stats')
    await this.refreshMetricsEntity('relay/metrics')
  }

  private async fetchTxData(txid: string): Promise<any> {
    const cachedData = await getTransactionData(txid)

    if (cachedData) {
      return cachedData
    }

    const fetchedData = await $fetch(`${this.gateway}/${txid}`)
    await saveTransactionData(txid, fetchedData)

    return fetchedData
  }

  private async refreshMetricsEntity(
    metricsEntityType: MetricsEntityType,
    limit = 5
  ) {
    const refresh = async (metricsEntityType: MetricsEntityType) => {
      const txs: ArdbTransaction[] = await ardb
        .search('transactions')
        .from(this.metricsDeployer)
        .tags([
          { name: 'Protocol', values: 'ator' },
          { name: 'Entity-Type', values: metricsEntityType }
        ])
        .sort('HEIGHT_DESC')
        .limit(limit)
        .find() as ArdbTransaction[]
      
      if (txs.length < 1) {
        console.error(`Could not find any tx for ${metricsEntityType}`)
      }
      
      for (let i = 0; i < txs.length; i++) {
        const tx = txs[i]
        const stats = await this.fetchTxData(tx.id)
        const timestamp = parseInt(
          tx.tags.find(tag => tag.name === 'Content-Timestamp')?.value || ''
        )

        if (!Number.isNaN(timestamp)) {
          this.metrics[metricsEntityType].push(stats, new Date(timestamp))
        } else {
          console.error(
            `Invalid Content-Timestamp for tx ${metricsEntityType} ${tx.id}`
          )
        }
      }
    }

    switch (metricsEntityType) {
      case 'relay/metrics':
      case 'validation/stats':
        await refresh(metricsEntityType)
        break
      default:
        throw new Error('Invalid MetricsEntityType')
    }
  }
}

export const useRelayMetrics = async () => {
  const { arweave } = useAppConfig()
  const runtimeConfig = useRuntimeConfig()
  const metrics = new RelayMetrics(
    arweave.gateway,
    runtimeConfig.public.metricsDeployer
  )

  await metrics.refresh()

  return metrics
}
