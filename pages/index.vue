<template>
  <div class="index-page">
    <v-container>
      <v-row>
        <v-col
          v-for="{ key, label, value, icon } in topCards"
          :key="key"
          cols="12"
          sm="6"
          md="6"
          lg="6"
          xl="6"
          xxl="3"
        >
          <v-card class="v-card-ator">
            <v-container>
              <v-row align="center">
                <v-col cols="7">
                  <div class="text-subitle-2 basic-text">
                    {{ label }}
                  </div>
                  <div v-if="!value" class="mt-3">
                    <LoadingBreeze :dots="11" />
                  </div>
                  <div v-else class="text-h5 font-weight-black basic-text">
                    {{ value }}
                  </div>
                </v-col>
                <v-col cols="5" class="text-right">
                  <v-icon :icon="icon" class="icon-ator"></v-icon>
                </v-col>
              </v-row>
            </v-container>
          </v-card>
        </v-col>
      </v-row>
      <v-row v-if="stats && stats.validation && stats.validation.latest">
        <v-col cols="12">
          <span class="text-caption">
            Last Updated: {{ stats.validation.latest.timestamp.toUTCString() }}
          </span>
        </v-col>
      </v-row>
      <v-row>
        <svg :width="width" :height="height">
          <!-- <path fill="none" stroke="rgb(3,190,197)" stroke-width="1.5" :d="validationStatsOverTime.observedBandwidth.line()" />
          <g>

          </g> -->
        </svg>
      </v-row>
    </v-container>
  </div>
</template>

<script setup lang="ts">
import * as d3 from 'd3'
import { useRelayRegistry } from '~~/composables'

useHead({ title: 'Dashboard' })

const { data: stats } = useLazyAsyncData('ator-stats', async () => {
  const registry = await useRelayRegistry()
  const relays = await registry.verified()
  const relayMetrics = await useRelayMetrics()
  
  const { metrics: { 'validation/stats': validation } } = relayMetrics
  const verified = Object.keys(relays)
  const users = verified
    // reduce to relay owner addresses
    .map(fp => relays[fp])
    // ensure user address list is unique
    .filter((addr, i, addrs) => addrs.indexOf(addr) === i)

  return { relays, users, verified, validation }
})

const width = 400
const height = 100

// const validationStatsOverTime = computed(() => {
//   const validationStats = stats.value && stats.value.validation
//     ? stats.value.validation.stats
//     : []

//   const observedBandwidthData = validationStats.map(vs => { return { timestamp: vs.timestamp, observedBandwidth: vs.stats.verified_and_running.observed_bandwidth } })
//   const observedBandwidthX = d3.scaleTime()
//     .domain([
//       observedBandwidthData[0].timestamp,
//       observedBandwidthData[observedBandwidthData.length - 1].timestamp
//     ])
//     .rangeRound([0, width])
//   const observedBandwidthY = d3.scaleLinear()
//     .domain([
//       observedBandwidthData[0].observedBandwidth,
//       observedBandwidthData[observedBandwidthData.length - 1].observedBandwidth
//     ])
//     .rangeRound([height, 0])
//   const observedBandwidthLine = d3.line((d, i) => observedBandwidthX(i), observedBandwidthY)
  
//   const observedBandwidth = {
//     x: observedBandwidthX,
//     y: observedBandwidthY,
//     line: observedBandwidthLine(observedBandwidthData)
//   }

//   return { observedBandwidth }
// })

const topCards = computed(() => {
  const { latest } = stats.value && stats.value.validation.latest
    ? stats.value.validation
    : { latest: null }
  const totalUsers = stats.value?.users?.length || ''
  const verifiedRelays = stats.value?.verified?.length || ''
  const activeRelays =
    stats.value?.validation.latest?.stats.verification.running || ''
  const observedBandwidth = latest
    ? (
        latest.stats.verified_and_running.observed_bandwidth
        / Math.pow(1024, 2)
      ).toFixed(3) + ' MiB/s'
    : ''

  return [
    {
      key: 'total-users',
      label: 'Total Users',
      value: totalUsers,
      icon: 'mdi-crowd'
    },
    {
      key: 'verified-relays',
      label: 'Verified Relays',
      value: verifiedRelays,
      icon: 'mdi-lifebuoy'
    },
    {
      key: 'active-relays',
      label: 'Active Relays',
      value: activeRelays,
      icon: 'mdi-transit-connection'
    },
    {
      key: 'observed-bandwidth',
      label: 'Observed Bandwidth',
      value: observedBandwidth,
      icon: 'mdi-speedometer'
    }
  ]
})
</script>
