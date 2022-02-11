import cn from "classnames"
import type { NextPage } from "next"
import { useRouter } from "next/router"
import { FC, useCallback, useEffect, useState } from "react"
import { useRecoilValueLoadable } from "recoil"

import {
  AllCampaignsCard,
  Button,
  CenteredColumn,
  Input,
  Loader,
  ResponsiveDecoration,
  Select,
  Suspense,
} from "../components"
import { addFilter, filterExists, removeFilter } from "../helpers/filter"
import { filteredCampaigns } from "../state/campaigns"
import { Status } from "../types"

const minPage = 1
const pageSize = 20

let alreadyLoadedFromQuery = false

const Campaigns: NextPage = () => {
  const { query, isReady, push: routerPush } = useRouter()
  const [filter, setFilter] = useState("")
  const [activeFilter, setActiveFilter] = useState("")

  // Load filter from query string.
  useEffect(() => {
    if (alreadyLoadedFromQuery || !isReady || typeof query?.q !== "string")
      return

    const decoded = decodeURIComponent(query.q)
    setFilter(decoded)
    setActiveFilter(decoded)

    // Only load once.
    alreadyLoadedFromQuery = true
  }, [query, isReady, setFilter, setActiveFilter])

  // Save filter to query string.
  useEffect(() => {
    if (!isReady) return

    routerPush(
      {
        pathname: "/campaigns",
        query: { q: encodeURIComponent(activeFilter) },
        hash: window.location.hash,
      },
      undefined,
      { shallow: true }
    )
  }, [query, isReady, activeFilter, routerPush])

  // Debounce filter input: wait until filter stops changing before refiltering campaigns.
  useEffect(() => {
    const timer = setTimeout(() => setActiveFilter(filter.trim()), 350)
    return () => clearTimeout(timer)
  }, [filter, setActiveFilter])

  return (
    <>
      <ResponsiveDecoration
        name="campaigns_orange_blur.png"
        width={406}
        height={626}
        className="top-0 right-0 opacity-70"
      />

      <CenteredColumn className="pt-5 pb-10">
        <div className="flex flex-column justify-start items-start sm:flex-row sm:items-center">
          <h1 className="font-semibold text-4xl">All Campaigns</h1>

          <div className="flex flex-wrap flex-row justify-start items-center ml-10 sm:ml-0">
            <Select
              className="ml-10 w-40"
              label="Status"
              items={Object.entries(Status).map(([label, value]) => ({
                label,
                onClick: (on) =>
                  on
                    ? setFilter((filter) => addFilter(filter, "status", value))
                    : setFilter((filter) =>
                        removeFilter(filter, "status", value)
                      ),
                selected: filterExists(filter, "status", value),
              }))}
            />
          </div>
        </div>

        <Input
          containerClassName="mt-4 mb-6"
          className="w-full"
          type="text"
          placeholder="Search all campaigns..."
          value={filter}
          onChange={({ target: { value } }) => setFilter(value)}
        />

        <Suspense>
          <CampaignsContent filter={activeFilter} />
        </Suspense>
      </CenteredColumn>
    </>
  )
}

interface PaginationProps {
  canGoBack: boolean
  canGoForward: boolean
  goBack: () => void
  goForward: () => void
  className?: string
}
const Pagination: FC<PaginationProps> = ({
  canGoBack,
  canGoForward,
  goBack,
  goForward,
  className,
}) => (
  <div className={cn("flex flex-row justify-between items-center", className)}>
    <Button onClick={goBack} disabled={!canGoBack}>
      Back
    </Button>
    <Button onClick={goForward} disabled={!canGoForward}>
      Next
    </Button>
  </div>
)

interface CampaignsContentProps {
  filter: string
}

const CampaignsContent: FC<CampaignsContentProps> = ({ filter }) => {
  const [page, setPage] = useState(() => {
    // Load page number from hash.
    let pageFromHash = Number(window.location.hash.slice(1)) || minPage
    if (pageFromHash < minPage) pageFromHash = minPage
    return pageFromHash
  })
  const goBack = useCallback(
    () => setPage((p) => Math.max(minPage, p - 1)),
    [setPage]
  )
  const goForward = useCallback(() => setPage((p) => p + 1), [setPage])

  const { state, contents } = useRecoilValueLoadable(
    filteredCampaigns({ filter, page, size: pageSize })
  )
  const filtering = state === "loading"
  const {
    campaigns,
    hasMore: canGoForward,
    error,
  } = (contents ?? {
    campaigns: [],
    hasMore: false,
    error: null,
  }) as CampaignsResponse

  // Pagination state
  const canGoBack = page > minPage

  // Update hash with page number.
  useEffect(() => {
    if (page < minPage) setPage(minPage)
    else if (typeof page === "number") window.location.hash = "#" + page
  }, [page, setPage])

  // If loads no campaigns and not on first page, go back to first page.
  useEffect(() => {
    if (state === "hasValue" && page !== minPage && campaigns?.length === 0)
      setPage(minPage)
  }, [state, campaigns, page, setPage])

  // Show loader if actively filtering data.
  if (filtering) return <Loader />

  return (
    <>
      {(canGoBack || canGoForward) && (
        <Pagination
          className="-mt-2 mb-6"
          canGoBack={canGoBack}
          canGoForward={canGoForward}
          goBack={goBack}
          goForward={goForward}
        />
      )}

      {campaigns?.length === 0 && (
        <p className="text-orange">No campaigns found.</p>
      )}
      {!!error && <p className="text-orange">{error}</p>}

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        {campaigns?.map((campaign) => (
          <AllCampaignsCard key={campaign.address} campaign={campaign} />
        ))}
      </div>

      {(canGoBack || canGoForward) && (
        <Pagination
          className="my-6"
          canGoBack={canGoBack}
          canGoForward={canGoForward}
          goBack={goBack}
          goForward={goForward}
        />
      )}
    </>
  )
}

export default Campaigns
