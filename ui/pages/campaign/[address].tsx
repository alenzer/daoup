import type { NextPage } from "next"
import { NextRouter, useRouter } from "next/router"
import { FunctionComponent, useEffect, useState } from "react"
import { useRecoilValue } from "recoil"

import {
  Alert,
  BalanceRefundCard,
  CampaignAction,
  CampaignDetails,
  CampaignInfoCard,
  CenteredColumn,
  ContributeForm,
  ContributionGraph,
  FundPendingCard,
  GovernanceCard,
  Loader,
  ResponsiveDecoration,
  Suspense,
  WalletMessage,
} from "@/components"
import { useWallet } from "@/hooks"
import { suggestToken } from "@/services"
import { fetchCampaign, fetchCampaignActions } from "@/state"
import { Status } from "@/types"

export const Campaign: NextPage = () => {
  const router = useRouter()
  // Redirect to campaigns page if invalid query string.
  useEffect(() => {
    if (router.isReady && typeof router.query.address !== "string") {
      console.error("Invalid query address.")
      router.push("/campaigns")
      return
    }
  }, [router])

  return (
    <>
      <ResponsiveDecoration
        name="campaign_orange_blur.png"
        width={341}
        height={684}
        className="top-0 left-0 opacity-70"
      />

      <Suspense loader={{ overlay: true }}>
        <CampaignContent router={router} />
      </Suspense>
    </>
  )
}

interface CampaignContentProps {
  router: NextRouter
}
const CampaignContent: FunctionComponent<CampaignContentProps> = ({
  router: { isReady, query, push: routerPush },
}) => {
  const campaignAddress =
    isReady && typeof query.address === "string" ? query.address : ""

  const { keplr, connected } = useWallet()

  const { campaign, error: campaignError } = useRecoilValue(
    fetchCampaign(campaignAddress)
  )

  const { actions, error: campaignActionsError } = useRecoilValue(
    fetchCampaignActions(campaignAddress)
  )

  // If no campaign, navigate to campaigns list.
  useEffect(() => {
    if (isReady && !campaign) routerPush("/campaigns")
  }, [isReady, campaign, routerPush])

  // Display buttons to add tokens to wallet.
  const [showAddFundingToken, setShowAddFundingToken] = useState(false)
  const [showAddGovToken, setShowAddGovToken] = useState(false)

  // Display successful contribution alert.
  const [showContributionSuccessAlert, setShowContributionSuccessAlert] =
    useState(false)

  // If page not ready, display loader.
  if (!isReady) return <Loader overlay />
  // Display nothing (redirecting to campaigns list, so this is just a type check).
  if (!campaign) return null

  const {
    name,
    status,

    dao: { url: daoUrl },

    fundingToken: { symbol: fundingTokenSymbol },
    govToken: { address: govTokenAddress, symbol: govTokenSymbol },
  } = campaign ?? {}

  const suggestFundingToken = async () =>
    keplr &&
    setShowAddFundingToken(
      !(await suggestToken(keplr, campaign.fundingToken.address))
    )
  const suggestGovToken = async () =>
    keplr && setShowAddGovToken(!(await suggestToken(keplr, govTokenAddress)))

  return (
    <>
      {status === Status.Funded && (
        <p className="bg-green text-dark text-center w-full px-12 py-2">
          {name} has been successfully funded!{" "}
          <a
            href={daoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:no-underline"
          >
            Click here to visit the DAO.
          </a>
        </p>
      )}

      <CenteredColumn className="pt-10 pb-12 sm:pt-20 xl:w-8/12">
        <div className="flex flex-col justify-start items-center gap-8 lg:flex-row lg:justify-between lg:items-stretch">
          <div className="flex flex-col items-stretch gap-8 w-full lg:w-3/5 lg:shrink-0">
            <CampaignDetails {...campaign} />

            {!connected && <WalletMessage />}

            {status === Status.Pending ? (
              <FundPendingCard campaign={campaign} />
            ) : status === Status.Open ? (
              <ContributeForm
                campaign={campaign}
                onFundSuccess={async () => {
                  // Attempt to add token to Keplr.
                  await suggestFundingToken()

                  // Show success message.
                  setShowContributionSuccessAlert(true)
                }}
              />
            ) : undefined}

            <CampaignInfoCard campaign={campaign} className="lg:hidden" />

            {connected && (
              <BalanceRefundCard
                campaign={campaign}
                showAddGovToken={showAddGovToken}
                suggestGovToken={suggestGovToken}
                showAddFundingToken={showAddFundingToken}
                suggestFundingToken={suggestFundingToken}
              />
            )}
          </div>

          <div className="flex flex-col self-stretch gap-8 flex-1">
            <CampaignInfoCard campaign={campaign} className="hidden lg:block" />

            {/* TODO: Show for funded campaigns by storing initial fund amount in contract state and use that instead (since govTokenCampaignBalance won't remain constant). */}
            {status === Status.Open && <GovernanceCard campaign={campaign} />}
          </div>
        </div>

        <h2 className="text-green text-xl mt-8 mb-2">Activity</h2>

        {!!campaignActionsError && (
          <p className="text-orange my-4 w-full lg:w-3/5">
            {campaignActionsError}
          </p>
        )}

        {actions && actions.length > 1 && (
          <div className="flex-1 max-w-sm my-4">
            <ContributionGraph actions={actions} />
          </div>
        )}

        <div className="w-full lg:w-3/5">
          {actions?.length ? (
            actions.map((item, idx) => (
              <CampaignAction key={idx} action={item} />
            ))
          ) : (
            <p>None yet.</p>
          )}
        </div>
      </CenteredColumn>

      <Alert
        visible={showContributionSuccessAlert}
        hide={() => setShowContributionSuccessAlert(false)}
        title="Contribution successful!"
      >
        <p>
          Once the campaign is fully funded, return to this page to join the{" "}
          {daoUrl ? (
            <a
              href={daoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:no-underline"
            >
              DAO
            </a>
          ) : (
            "DAO"
          )}
          .
        </p>
      </Alert>
    </>
  )
}

export default Campaign
