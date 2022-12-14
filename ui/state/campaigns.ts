import { QueryContractsByCodeResponse } from "cosmjs-types/cosmwasm/wasm/v1/query"
import { atom, atomFamily, selector, selectorFamily, waitForAll } from "recoil"

import { addressesHaltCutoff, escrowContractCodeIds } from "@/config"
import { CommonError, extractPageInfo, parseError } from "@/helpers"
import {
  campaignsFromResponses,
  contractInstantiationBlockHeight,
  createDENSAddressMap,
  filterCampaigns,
  getCampaignState,
  getCW20TokenInfo,
  getDENSAddress,
  getDENSNames,
  getDenyListAddresses,
  getFeaturedAddresses,
  transformCampaign,
} from "@/services"
import { cosmWasmClient, cosmWasmQueryClient, cw20TokenBalance } from "@/state"
import { localStorageEffectJSON } from "@/state/effects"

export const campaignStateId = atomFamily<number, string | undefined>({
  key: "campaignStateId",
  default: 0,
})

export const campaignState = selectorFamily<CampaignStateResponse, string>({
  key: "campaignState",
  get:
    (address) =>
    async ({ get }) => {
      // Allow us to manually refresh campaign state.
      get(campaignStateId(address))

      if (!address) return { state: null, error: CommonError.InvalidAddress }

      const client = get(cosmWasmClient)
      if (!client) return { state: null, error: CommonError.GetClientFailed }

      try {
        return {
          state: await getCampaignState(client, address),
          error: null,
        }
      } catch (error) {
        console.error(error)
        return {
          state: null,
          error: parseError(error, {
            source: "campaignState",
            campaign: address,
          }),
        }
      }
    },
})

export const fetchCampaign = selectorFamily<
  CampaignResponse,
  // Pass full to get all data.
  { address: string; full?: boolean }
>({
  key: "fetchCampaign",
  get:
    ({ address, full = true }) =>
    async ({ get }) => {
      // Get campaign creation.
      const createdBlockHeight = full
        ? get(campaignCreationBlockHeight(address))
        : null

      // Get campaign state.
      const { state, error: campaignStateError } = get(campaignState(address))
      if (campaignStateError || state === null)
        return { campaign: null, error: campaignStateError ?? "Unknown error." }

      // Get gov token balances.
      const {
        balance: campaignGovTokenBalance,
        error: campaignGovTokenBalanceError,
      } = get(
        cw20TokenBalance({
          tokenAddress: state.gov_token_addr,
          walletAddress: address,
        })
      )
      if (campaignGovTokenBalanceError || campaignGovTokenBalance === null)
        return {
          campaign: null,
          error: campaignGovTokenBalanceError ?? "Unknown error.",
        }

      const { balance: daoGovTokenBalance, error: daoGovTokenBalanceError } =
        get(
          cw20TokenBalance({
            tokenAddress: state.gov_token_addr,
            walletAddress: state.dao_addr,
          })
        )
      if (daoGovTokenBalanceError || daoGovTokenBalance === null)
        return {
          campaign: null,
          error: daoGovTokenBalanceError ?? "Unknown error.",
        }

      // Get featured addresses.
      const { addresses: featuredAddresses } = get(featuredCampaignAddressList)

      // Get deNS address map.
      const densAddressMap = get(fetchDENSAddressMap)

      // Transform data into campaign.
      const campaign = transformCampaign(
        address,
        createdBlockHeight,
        state,
        campaignGovTokenBalance,
        daoGovTokenBalance,
        featuredAddresses,
        densAddressMap
      )

      if (!campaign) {
        console.error(
          parseError(
            "Transformed campaign is null.",
            {
              source: "fetchCampaign",
              campaign: address,
              campaignGovTokenBalance,
              daoGovTokenBalance,
            },
            {
              extra: { state },
            }
          )
        )
      }

      return {
        campaign,
        error: campaign === null ? "Unknown error." : null,
      }
    },
})

export const cw20TokenInfo = selectorFamily<TokenInfoSelectorResponse, string>({
  key: "cw20TokenInfo",
  get:
    (address) =>
    async ({ get }) => {
      if (!address) return { info: null, error: CommonError.InvalidAddress }

      const client = get(cosmWasmClient)
      if (!client) return { info: null, error: CommonError.GetClientFailed }

      try {
        return {
          info: await getCW20TokenInfo(client, address),
          error: null,
        }
      } catch (error) {
        console.error(error)
        return {
          info: null,
          error: parseError(error, {
            source: "cw20TokenInfo",
            token: address,
          }),
        }
      }
    },
})

export const escrowContractAddresses = selectorFamily<
  QueryContractsByCodeResponse | undefined,
  { codeId: number; startAtKey?: number[] }
>({
  key: "escrowContractAddresses",
  get:
    ({ codeId, startAtKey }) =>
    async ({ get }) => {
      const queryClient = get(cosmWasmQueryClient)
      if (!queryClient) return

      try {
        return await queryClient.wasm.listContractsByCodeId(
          codeId,
          startAtKey && new Uint8Array(startAtKey)
        )
      } catch (error) {
        console.error(
          parseError(error, {
            source: "escrowContractAddresses",
            codeId,
          })
        )
      }
    },
})

// Pass null to get all addresses.
export const pagedEscrowContractAddresses = selectorFamily<
  CampaignAddressListResponse,
  PageInfo | null
>({
  key: "pagedEscrowContractAddresses",
  get:
    (page) =>
    async ({ get }) => {
      const addresses: string[] = []

      // Don't attempt to get paged contracts if no client.
      const queryClient = get(cosmWasmQueryClient)
      if (!queryClient) return { addresses, error: CommonError.GetClientFailed }

      const { addresses: addressDenyList } = get(campaignDenyList)

      let codeIdIndex = 0
      let startAtKey: number[] | undefined = undefined
      do {
        const response = get(
          escrowContractAddresses({
            codeId: escrowContractCodeIds[codeIdIndex],
            startAtKey: startAtKey && Array.from(startAtKey),
          })
        ) as QueryContractsByCodeResponse | undefined

        // If no response, move to next codeId.
        if (!response) {
          startAtKey = undefined
          codeIdIndex++
          continue
        }

        const contracts = response.contracts.filter(
          (a) => !addressDenyList.includes(a)
        )
        addresses.push(...contracts)
        startAtKey = Array.from(response.pagination?.nextKey ?? [])

        // If exhausted all addresses for this code ID, move on.
        if (!startAtKey.length) {
          codeIdIndex++
        }
      } while (
        // Keep going as long as there is another page key or the code ID is still valid.
        (!!startAtKey?.length || codeIdIndex < escrowContractCodeIds.length) &&
        // Keep going if not at pagination limit.
        (!page || addresses.length - 1 < page.endIndex)
      )

      return {
        addresses: page
          ? addresses
              .slice(0, addressesHaltCutoff)
              .slice(page.startIndex, page.endIndex)
          : addresses,
        error: null,
      }
    },
})

export const campaignDenyList = selector<CampaignAddressListResponse>({
  key: "campaignDenyList",
  get: async ({ get }) => {
    const client = get(cosmWasmClient)
    if (!client) return { addresses: [], error: CommonError.GetClientFailed }

    try {
      return {
        addresses: await getDenyListAddresses(client),
        error: null,
      }
    } catch (error) {
      console.error(error)
      return {
        addresses: [],
        error: parseError(error, {
          source: "campaignDenyList",
        }),
      }
    }
  },
})

export const featuredCampaignAddressList =
  selector<CampaignAddressListResponse>({
    key: "featuredCampaignAddressList",
    get: async ({ get }) => {
      const client = get(cosmWasmClient)
      if (!client) return { addresses: [], error: CommonError.GetClientFailed }

      try {
        return {
          addresses: await getFeaturedAddresses(client),
          error: null,
        }
      } catch (error) {
        console.error(error)
        return {
          addresses: [],
          error: parseError(error, {
            source: "featuredCampaignAddressList",
          }),
        }
      }
    },
  })

export const featuredCampaigns = selector<CampaignsResponse>({
  key: "featuredCampaigns",
  get: async ({ get }) => {
    const { addresses, error: addressesError } = get(
      featuredCampaignAddressList
    )
    if (addressesError !== null)
      return { campaigns: null, hasMore: false, error: addressesError }

    const campaignResponses = get(
      waitForAll(
        addresses.map((address) =>
          fetchCampaign({
            address,
            full: false,
          })
        )
      )
    )
    const campaigns = campaignsFromResponses(
      campaignResponses,
      true,
      true,
      true
    )

    return { campaigns, hasMore: false, error: null }
  },
})

export const filteredCampaigns = selectorFamily<
  CampaignsResponse,
  {
    filter: string
    includeHidden?: boolean
    includePending?: boolean
    page: number
    size: number
  }
>({
  key: "filteredCampaigns",
  get:
    ({ filter, includeHidden = true, includePending = true, page, size }) =>
    async ({ get }) => {
      // Prevent infinite loop and return no data.
      if (size <= 0) return { campaigns: [], hasMore: true, error: null }

      const allCampaigns: Campaign[] = []
      const pageInfo = extractPageInfo(page, size)

      let addressPage = 1
      let addressesLeft = true
      do {
        const addressPageInfo = extractPageInfo(addressPage, size)

        const { addresses, error: addressesError } = get(
          pagedEscrowContractAddresses(addressPageInfo)
        )
        if (addressesError)
          return { campaigns: null, hasMore: false, error: addressesError }

        // If we got the asked-for page size, we might still have addresses left.
        addressesLeft = addresses.length === size

        const campaignResponses = get(
          waitForAll(
            addresses.map((address) =>
              fetchCampaign({
                address,
                full: false,
              })
            )
          )
        )

        let relevantCampaigns = campaignsFromResponses(
          campaignResponses,
          includeHidden,
          includePending
        )
        relevantCampaigns = await filterCampaigns(relevantCampaigns, filter)
        allCampaigns.push(...relevantCampaigns)

        addressPage++

        // Stop once 2 more addresses have been loaded after endIndex, since end is an index (+1 to get count) AND we want to see if there are any addresses left (+1 to check existence of address on next page).
      } while (allCampaigns.length < pageInfo.endIndex + 2 && addressesLeft)

      return {
        campaigns: allCampaigns.slice(pageInfo.startIndex, pageInfo.endIndex),
        // More pages if more campaigns exist beyond this page's end.
        hasMore: allCampaigns.length > pageInfo.endIndex,
        error: null,
      }
    },
})

export const allCampaigns = selector<CampaignsResponse>({
  key: "allCampaigns",
  get: async ({ get }) => {
    const { addresses, error: addressesError } = get(
      pagedEscrowContractAddresses(null)
    )
    if (addressesError)
      return { campaigns: [], hasMore: false, error: addressesError }

    const campaignResponses = get(
      waitForAll(
        addresses.map((address) =>
          fetchCampaign({
            address,
            full: false,
          })
        )
      )
    )
    const campaigns = campaignsFromResponses(campaignResponses, true, true)

    return { campaigns, hasMore: false, error: null }
  },
})

export const favoriteCampaignAddressesKey = "favoriteCampaignAddresses"
// Change keplrKeystoreId to trigger Keplr refresh/connect.
// Set to -1 to disable connection.
export const favoriteCampaignAddressesAtom = atom({
  key: favoriteCampaignAddressesKey,
  default: [] as string[],
  effects: [localStorageEffectJSON(favoriteCampaignAddressesKey)],
})

export const favoriteCampaigns = selector<CampaignsResponse>({
  key: "favoriteCampaigns",
  get: async ({ get }) => {
    const addresses = get(favoriteCampaignAddressesAtom)
    const campaignResponses = get(
      waitForAll(
        addresses.map((address) =>
          fetchCampaign({
            address,
            full: false,
          })
        )
      )
    )
    const campaigns = campaignsFromResponses(
      campaignResponses,
      true,
      true,
      true
    )

    return { campaigns, hasMore: false, error: null }
  },
})

export const densCampaignAddress = selectorFamily<string | null, string>({
  key: "densCampaignAddress",
  get:
    (name) =>
    async ({ get }) => {
      const client = get(cosmWasmClient)
      if (!client) return null

      return await getDENSAddress(client, name)
    },
})

// Map from campaign address to name.
export const fetchDENSAddressMap = selector<DENSAddressMap>({
  key: "fetchDENSAddressMap",
  get: async ({ get }) => {
    const client = get(cosmWasmClient)
    if (!client) return {}

    const names = await getDENSNames(client)
    const addresses = get(
      waitForAll(names.map((name) => densCampaignAddress(name)))
    )

    return createDENSAddressMap(names, addresses)
  },
})

export const campaignCreationBlockHeight = selectorFamily<
  number | null,
  string
>({
  key: "campaignCreationBlockHeight",
  get:
    (address: string) =>
    async ({ get }) => {
      const client = get(cosmWasmClient)
      if (!client) {
        return null
      }

      return await contractInstantiationBlockHeight(client, address)
    },
})
