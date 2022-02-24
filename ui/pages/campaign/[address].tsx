import type { GetStaticPaths, GetStaticProps, NextPage } from "next"
import Head from "next/head"
import { NextRouter, useRouter } from "next/router"
import { FunctionComponent, useEffect, useState } from "react"
import { useRecoilValue, useRecoilValueLoadable } from "recoil"

import {
  Alert,
  BalanceRefundJoinCard,
  Banner,
  Button,
  ButtonLink,
  CampaignAction,
  CampaignDetails,
  CampaignInfoCard,
  CenteredColumn,
  ContributeForm,
  ContributionGraph,
  GovernanceCard,
  Loader,
  ProposeFundPendingCard,
  ResponsiveDecoration,
  Suspense,
  WalletMessage,
} from "@/components"
import { baseUrl, daoUrlPrefix, title } from "@/config"
import { escrowAddressRegex, parseError } from "@/helpers"
import { useRefundJoinDAOForm, useWallet } from "@/hooks"
import {
  createDENSAddressMap,
  getCampaignState,
  getClient,
  getDENSAddress,
  getDENSNames,
  getFeaturedAddresses,
  getWalletTokenBalance,
  suggestToken,
  transformCampaign,
} from "@/services"
import {
  fetchCampaign,
  fetchCampaignActions,
  walletTokenBalance,
} from "@/state"
import { Status } from "@/types"

const campaigns404Path = "/campaigns?404"

interface CampaignStaticProps {
  campaign?: Campaign
}

export const Campaign: NextPage<CampaignStaticProps> = ({ campaign }) => {
  const router = useRouter()

  // If no campaign when there should be a campaign, navigate back to campaigns list.
  useEffect(() => {
    if (
      router.isReady &&
      // No props on fallback page, so don't redirect until page is actually in an invalid state.
      !router.isFallback &&
      !campaign
    ) {
      console.error("Invalid query address.")
      router.push(campaigns404Path)
      return
    }
  }, [router, campaign])

  return (
    <>
      <Head>
        {campaign ? (
          <>
            <title>
              {title} | {campaign.name}
            </title>
            <meta
              name="twitter:title"
              content={`${title} | ${campaign.name}`}
              key="twitter:title"
            />
            <meta
              property="og:title"
              content={`${title} | ${campaign.name}`}
              key="og:title"
            />

            <meta
              property="og:url"
              content={`${baseUrl + campaign.urlPath}`}
              key="og:url"
            />
          </>
        ) : (
          <title>DAO Up! | Loading...</title>
        )}

        {!!campaign?.imageUrl && (
          <meta
            name="twitter:image"
            content={campaign.imageUrl}
            key="twitter:image"
          />
        )}
        {/* OpenGraph does not support SVG images. */}
        {!!campaign?.imageUrl && !campaign.imageUrl.endsWith(".svg") && (
          <meta
            property="og:image"
            content={campaign.imageUrl}
            key="og:image"
          />
        )}
      </Head>

      <ResponsiveDecoration
        name="campaign_orange_blur.png"
        width={341}
        height={684}
        className="top-0 left-0 opacity-70"
      />

      <Suspense loader={{ overlay: true }}>
        <CampaignContent router={router} preLoadedCampaign={campaign} />
      </Suspense>
    </>
  )
}

interface CampaignContentProps {
  router: NextRouter
  preLoadedCampaign?: Campaign
}

const CampaignContent: FunctionComponent<CampaignContentProps> = ({
  router,
  preLoadedCampaign,
}) => {
  const campaignAddress = preLoadedCampaign?.address ?? ""

  const { keplr, connected } = useWallet()

  // Fetch latest campaign details in background and update so that page is as up to date as possible.
  const {
    state: latestCampaignState,
    contents: { campaign: latestCampaign },
  } = useRecoilValueLoadable(fetchCampaign(campaignAddress))
  // Use just-fetched campaign over pre-loaded campaign, defaulting to pre-loaded.
  const campaign =
    (latestCampaignState === "hasValue" && latestCampaign) || preLoadedCampaign

  // Funding token balance to add 'Join DAO' message to funded banner on top.
  const {
    state: fundingTokenBalanceState,
    contents: { balance: fundingTokenBalanceContents },
  } = useRecoilValueLoadable(
    walletTokenBalance(campaign?.fundingToken?.address)
  )
  // Load in background and swap 'visit' for 'join' link ASAP. No need to prevent page from displaying until this is ready.
  const fundingTokenBalance =
    fundingTokenBalanceState === "hasValue" ? fundingTokenBalanceContents : null

  // Display buttons to add tokens to wallet.
  const [showAddFundingToken, setShowAddFundingToken] = useState(false)
  const [showAddGovToken, setShowAddGovToken] = useState(false)

  // Display successful fund pending alert by setting the URL to the proposal.
  const [fundCampaignProposalUrl, setFundCampaignProposalUrl] = useState("")
  // Display successful contribution alert.
  const [showContributionSuccessAlert, setShowContributionSuccessAlert] =
    useState(false)
  // Display successful join DAO alert.
  const [showJoinDAOSuccessAlert, setShowJoinDAOSuccessAlert] = useState(false)

  const suggestFundingToken = async () =>
    keplr &&
    campaign?.fundingToken?.address &&
    setShowAddFundingToken(
      !(await suggestToken(keplr, campaign.fundingToken.address))
    )
  const suggestGovToken = async () =>
    keplr &&
    campaign?.govToken?.address &&
    setShowAddGovToken(!(await suggestToken(keplr, campaign.govToken.address)))

  // Handler for successful DAO join, show relevant alerts.
  const onRefundJoinDAOSuccess = async () => {
    if (status === Status.Funded) {
      // Hide contribution success message in case user joins the DAO from there.
      setShowContributionSuccessAlert(false)

      // Show success message.
      setShowJoinDAOSuccessAlert(true)

      // Attempt to add token to Keplr if receiving governance tokens.
      await suggestGovToken()
    }
  }
  // Refund / Join DAO Form for joining DAO from funded banner and last contributor's contribution alert.
  // The last contributor to the campaign (the one who causes the change from open to funded)
  // will receive a special message prompting them to join the DAO immediately.
  const { onSubmit: onSubmitRefundJoinDAO } = useRefundJoinDAOForm(
    campaign ?? null,
    fundingTokenBalance,
    onRefundJoinDAOSuccess
  )

  // If page not ready or is fallback, display loader.
  if (!router.isReady || router.isFallback) return <Loader overlay />
  // Display nothing (redirecting to campaigns list, so this is just a type check).
  if (!campaign) return null

  const {
    name,
    status,

    dao: { address: daoAddress, url: daoUrl },
  } = campaign

  return (
    <>
      {status === Status.Funded && (
        <Banner color="green">
          {name} has been successfully funded!{" "}
          {/* If user has funding tokens and the campaign is funded, make it easy for them to join. */}
          {fundingTokenBalance ? (
            <form onSubmit={onSubmitRefundJoinDAO} className="inline-block">
              <Button
                submitLabel="Click here to join the DAO."
                className="underline"
                bare
              />
            </form>
          ) : (
            <a
              href={daoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:no-underline"
            >
              Click here to visit the DAO.
            </a>
          )}
        </Banner>
      )}

      <CenteredColumn className="pt-10 pb-12 sm:pt-20 xl:w-8/12">
        <div className="flex flex-col justify-start items-center gap-8 lg:flex-row lg:justify-between lg:items-stretch">
          <div className="flex flex-col items-stretch gap-8 w-full lg:w-3/5 lg:shrink-0">
            <CampaignDetails {...campaign} />

            {!connected && <WalletMessage />}

            {status === Status.Pending ? (
              <ProposeFundPendingCard
                campaign={campaign}
                onSuccess={(proposalId: string) =>
                  // Show success message with proposal URL.
                  setFundCampaignProposalUrl(
                    `${daoUrlPrefix}${daoAddress}/proposals/${proposalId}`
                  )
                }
              />
            ) : status === Status.Open ? (
              <ContributeForm
                campaign={campaign}
                onSuccess={async () => {
                  // Show success message.
                  setShowContributionSuccessAlert(true)

                  // Attempt to add token to Keplr.
                  await suggestFundingToken()
                }}
              />
            ) : undefined}

            <CampaignInfoCard campaign={campaign} className="lg:hidden" />

            {connected && (
              <BalanceRefundJoinCard
                campaign={campaign}
                showAddGovToken={showAddGovToken}
                suggestGovToken={suggestGovToken}
                showAddFundingToken={showAddFundingToken}
                suggestFundingToken={suggestFundingToken}
                onSuccess={onRefundJoinDAOSuccess}
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

        <Suspense>
          <CampaignActionsContent campaignAddress={campaignAddress} />
        </Suspense>
      </CenteredColumn>

      {/* Fund pending success alert. */}
      <Alert
        visible={!!fundCampaignProposalUrl}
        hide={() => setFundCampaignProposalUrl("")}
        title="Proposal created!"
      >
        <p>
          This campaign will activate once the proposal is approved and executed
          on DAO DAO. Refresh this page after the proposal executes.
        </p>

        <ButtonLink href={fundCampaignProposalUrl} className="mt-5" cardOutline>
          View Proposal
        </ButtonLink>
      </Alert>

      {/* Contribution success alert. */}
      <Alert
        visible={showContributionSuccessAlert}
        hide={() => setShowContributionSuccessAlert(false)}
        title="Contribution successful!"
      >
        {status === Status.Funded ? (
          <>
            <p>
              The campaign is now funded and you can join the{" "}
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
              ! Join by clicking the button below.
            </p>

            <form onSubmit={onSubmitRefundJoinDAO}>
              <Button submitLabel="Join DAO" className="mt-5" cardOutline />
            </form>
          </>
        ) : (
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
        )}
      </Alert>

      {/* Join DAO success alert. */}
      <Alert
        visible={showJoinDAOSuccessAlert}
        hide={() => setShowJoinDAOSuccessAlert(false)}
        title="You've joined the DAO!"
      >
        <p>
          You will vote in the{" "}
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
          )}{" "}
          on DAO DAO going forward.
        </p>

        <ButtonLink href={daoUrl} className="mt-5" cardOutline>
          Visit the DAO
        </ButtonLink>
      </Alert>
    </>
  )
}

interface CampaignActionsContentProps {
  campaignAddress: string
}

const CampaignActionsContent: React.FC<CampaignActionsContentProps> = ({
  campaignAddress,
}) => {
  const { actions, error: campaignActionsError } = useRecoilValue(
    fetchCampaignActions(campaignAddress)
  )

  return campaignActionsError ? (
    <p className="text-orange my-4 w-full lg:w-3/5">{campaignActionsError}</p>
  ) : (
    <>
      {actions && actions.length > 1 && (
        <div className="flex-1 max-w-sm my-4">
          <ContributionGraph actions={actions} />
        </div>
      )}

      <div className="w-full lg:w-3/5 max-h-[80vh] overflow-y-auto visible-scrollbar">
        {actions?.length ? (
          actions.map((item, idx) => <CampaignAction key={idx} action={item} />)
        ) : (
          <p>None yet.</p>
        )}
      </div>
    </>
  )
}

// Fallback to loading screen if page has not yet been statically generated.
export const getStaticPaths: GetStaticPaths = () => ({
  paths: [],
  fallback: true,
})

const redirectToCampaigns = {
  redirect: {
    destination: campaigns404Path,
    permanent: false,
  },
}

export const getStaticProps: GetStaticProps<CampaignStaticProps> = async ({
  params: { address } = { address: undefined },
}) => {
  if (typeof address !== "string" || !address.trim()) return redirectToCampaigns

  try {
    const client = await getClient()
    if (!client) return redirectToCampaigns

    // If not valid contract address, perform name service lookup.
    const campaignAddress = escrowAddressRegex.test(address)
      ? address
      : await getDENSAddress(client, address)

    if (!campaignAddress) return redirectToCampaigns

    // Get campaign state.
    const state = await getCampaignState(client, campaignAddress)

    // Get gov token balances.
    const campaignGovTokenBalance = await getWalletTokenBalance(
      client,
      state.gov_token_addr,
      campaignAddress
    )
    const daoGovTokenBalance = await getWalletTokenBalance(
      client,
      state.gov_token_addr,
      state.dao_addr
    )

    // Get featured addresses.
    const featuredAddresses = await getFeaturedAddresses(client)

    // Get deNS address map.
    const densNames = await getDENSNames(client)
    const densAddresses = await Promise.all(
      densNames.map((name) => getDENSAddress(client, name))
    )
    const densAddressMap = createDENSAddressMap(densNames, densAddresses)

    // Transform data into campaign.
    const campaign = transformCampaign(
      campaignAddress,
      state,
      campaignGovTokenBalance,
      daoGovTokenBalance,
      featuredAddresses,
      densAddressMap
    )

    if (!campaign) {
      console.error(
        parseError("Transformed campaign is null.", {
          source: "Campaign.getStaticProps",
          campaign: campaignAddress,
          state,
          campaignGovTokenBalance,
          daoGovTokenBalance,
        })
      )
      return redirectToCampaigns
    }

    return {
      props: { campaign },
      // Regenerate the page at most once per second.
      // Should serve cached copy and update after a refresh.
      revalidate: 1,
    }
  } catch (err) {
    console.error(
      parseError(err, {
        source: "Campaign.getStaticProps",
        address,
      })
    )
    return redirectToCampaigns
  }
}

export default Campaign
