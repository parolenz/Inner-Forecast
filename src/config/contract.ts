import type { Address } from 'viem'

const deployedAddress =
  '0x652530C0D2626588b640d07897cd49F85a043BDB'

const configuredAddress =
  import.meta.env.VITE_INNER_FORECAST_CONTRACT_ADDRESS

const zeroAddress =
  '0x0000000000000000000000000000000000000000'

const activeAddress =
  configuredAddress || deployedAddress

export const isContractConfigured =
  /^0x[a-fA-F0-9]{40}$/.test(activeAddress) &&
  activeAddress.toLowerCase() !== zeroAddress

export const INNER_FORECAST_ADDRESS = (
  isContractConfigured
    ? activeAddress
    : zeroAddress
) as Address

export const innerForecastAbi = [
  {
    type: 'function',
    name: 'report',
    inputs: [
      {
        name: 'condition',
        type: 'uint8',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'statsOf',
    inputs: [
      {
        name: 'user',
        type: 'address',
      },
    ],
    outputs: [
      {
        name: 'stats',
        type: 'tuple',
        components: [
          {
            name: 'totalReports',
            type: 'uint64',
          },
          {
            name: 'streak',
            type: 'uint64',
          },
          {
            name: 'lastActiveDay',
            type: 'uint64',
          },
          {
            name: 'todayCount',
            type: 'uint8',
          },
          {
            name: 'lastCondition',
            type: 'uint8',
          },
          {
            name: 'lastReportedAt',
            type: 'uint64',
          },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'conditionCountOf',
    inputs: [
      {
        name: 'user',
        type: 'address',
      },
      {
        name: 'condition',
        type: 'uint8',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'uint64',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'globalReports',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint64',
      },
    ],
    stateMutability: 'view',
  },
] as const
