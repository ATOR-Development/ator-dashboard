<template>
  <v-container class="my-relays-page h-100">
    <v-row class="h-100">
      <v-col cols="12" class="h-100">
        <v-table v-if="!pending && myRelays">
          <thead>
            <tr>
              <th class="font-weight-black basic-text">Relay Fingerprint</th>
              <th class="font-weight-black basic-text">Status</th>
              <th class="font-weight-black basic-text">Consensus Weight</th>
              <th class="font-weight-black basic-text">Observed Bandwidth</th>
              <th class="font-weight-black basic-text">Active</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="fingerprint in myRelays.claimable" :key="fingerprint">
              <td><code>{{ fingerprint }}</code></td>
              <td>Claimable</td>
              <td></td>
              <td></td>
              <td></td>
              <td>
                <v-btn
                  @click="claim(fingerprint)"
                  class="primary-background"
                  size="small"
                  :loading="loading"
                >Claim</v-btn>
              </td>
            </tr>
            <tr v-for="relay in myRelays.verified" :key="relay.fingerprint">
              <td><code>{{ relay.fingerprint }}</code></td>
              <td>Verified</td>
              <td class="text-end">{{ (relay as ValidatedRelay).consensus_weight }}</td>
              <td>{{
                (relay as ValidatedRelay).observed_bandwidth
                  ? ((relay as ValidatedRelay).observed_bandwidth / Math.pow(1024, 2)).toFixed(3) + ' MiB/s'
                  : ''
              }}</td>
              <td><v-icon>{{ (relay as ValidatedRelay).running ? 'mdi-check' : 'mdi-close' }}</v-icon></td>
              <td>
                <v-btn
                  @click="openRenounceDialog(relay.fingerprint)"
                  class="danger-background"
                  size="small"
                  :loading="loading"
                >Renounce</v-btn>
              </td>
            </tr>
            <tr v-if="noRelays">
              <td>No pending claimable or verified relays!</td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td colspan="6">
                <span class="text-caption">
                  Last Updated: {{ myRelays.timestamp?.toUTCString() }}
                </span>
              </td>
            </tr>
          </tfoot>
        </v-table>
        <div v-else class="center-loading-splash">
          <LoadingBreeze :dots="7" size="large" />
        </div>
      </v-col>
    </v-row>

    <v-dialog v-model="isRenounceDialogOpen">
      <v-card>
        <v-card-title>Renounce Relay</v-card-title>
        <v-card-text>
          <p>
            Are you sure you would like to renounce relay
            <code>{{ renounceFingerprint }}</code>?
          </p>
          <p>
            Type <strong>{{ renouncePhrase }}</strong> below to confirm.
          </p>
          <v-text-field v-model="userTypedRenouncePhrase" />
        </v-card-text>
        <v-card-actions>
          <v-btn
            class="danger-background"
            @click="cancelRenounce"
          >Cancel</v-btn>
          <v-spacer />
          <v-btn
            class="primary-background"
            @click="renounce(renounceFingerprint)"
            :loading="loading"
            :disabled="userTypedRenouncePhrase !== renouncePhrase"
          >Renounce</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup lang="ts">
import { useRelayRegistry } from '~~/composables'
import { ValidatedRelay } from '~~/composables/metrics'

definePageMeta({ middleware: 'auth' })
useHead({ title: 'My Relays' })

const loading = ref<boolean>(false)

const {
  pending,
  data: myRelays,
  refresh
} = useLazyAsyncData('my-relays', async () => {
  const registry = await useRelayRegistry()
  const signer = await useSigner()
  const relayMetrics = await useRelayMetrics()
  const latestRelayMetrics = relayMetrics.metrics['relay/metrics'].latest

  if (signer && latestRelayMetrics) {
    try {
      const claimable = await registry.claimable(signer.address)
      const verifiedRelays = await registry.verified(signer.address)
      const { stats, timestamp } = latestRelayMetrics
      
      const verified = verifiedRelays
        .map(
          fp => {
            const myMetrics =
              stats.find(({ relay }) => fp === relay.fingerprint)

            return myMetrics
              ? myMetrics.relay
              : { fingerprint: fp }
          }
        )

      return { claimable, verified, timestamp }
    } catch (error) {
      console.log('error reading relay registry contract', error)
    }
  }

  return null
})

const noRelays = computed(() => {
  if (myRelays.value) {
    return myRelays.value.claimable.length === 0
      && myRelays.value.verified.length === 0
  }

  return true
})

const claim = debounce(async (fingerprint: string) => {
  loading.value = true

  const registry = await useRelayRegistry()

  try {
    const success = await registry.claim(fingerprint)

    // TODO -> inform user of success, contract state update may be delayed

    if (success) {
      await refresh()  
    } else {
      console.error('Unknown error interacting with registry contract')
    }
  } catch (error) {
    console.error(error)
  }

  loading.value = false
})

const renounceFingerprint = ref<string | null>(null)
const isRenounceDialogOpen = ref<boolean>(false)
const baseRenouncePhrase = 'I am renouncing fingerprint'
const renouncePhrase = ref<string>(baseRenouncePhrase)
const userTypedRenouncePhrase = ref<string>('')
const openRenounceDialog = debounce((fingerprint: string) => {
  renounceFingerprint.value = fingerprint
  renouncePhrase.value = `${baseRenouncePhrase} ${fingerprint}`
  isRenounceDialogOpen.value = true
})

const cancelRenounce = () => {
  isRenounceDialogOpen.value = false
}

const renounce = debounce(async (fingerprint: string) => {
  loading.value = true

  const registry = await useRelayRegistry()

  try {
    const success = await registry.renounce(fingerprint)

    // TODO -> inform user of success, contract state update may be delayed

    if (success) {
      await refresh()
      isRenounceDialogOpen.value = false
    } else {
      console.error('Unknown error interacting with registry contract')
    }
  } catch (error) {
    console.error(error)
  }

  loading.value = false
})
</script>
