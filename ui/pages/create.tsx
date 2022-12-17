import type { NextPage } from "next";

import { CenteredColumn, EditCampaignForm } from "@/components";
import {
  aquaToken,
  baseUrl,
  currentEscrowContractCodeId,
  cw20CodeId,
  feeManagerAddress,
  title,
} from "@/config";
import { useForm } from "react-hook-form";
import { useCallback, useState } from "react";
import { numberPattern } from "helpers/form";
import { convertMicroDenomToDenom } from "helpers/number";
import { getSigningClient } from "services/chain";

import { coins } from "@cosmjs/stargate";
import { useRecoilValue, useSetRecoilState } from "recoil";

import { useWallet } from "@/hooks";
import {
  feeManagerConfig,
  globalLoadingAtom,
  signedCosmWasmClient,
} from "@/state";
import { defaultNewCampaign } from "services/campaigns";

const CreateCampaign: NextPage = () => {
  const client = useRecoilValue(signedCosmWasmClient);
  const { walletAddress } = useWallet();
  const setLoading = useSetRecoilState(globalLoadingAtom);
  const feeConfig = useRecoilValue(feeManagerConfig);

  const defaultValues = defaultNewCampaign();
  const [error, setError] = useState("");

  const createCampaign = useCallback(
    async (params: NewCampaignInfo) => {
      if (!client) {
        setError("Failed to get signing client.");
        return false;
      }
      if (!walletAddress) {
        setError("Wallet not connected.");
        return false;
      }
      if (!feeConfig?.publicListingFee.coin) {
        setError("Failed to get the FeeManger Config.");
        return false;
      }

      setLoading(true);
      console.log(params);
      const isToken =
        params.payTokenDenom.toLocaleLowerCase() == "aqua" ? true : false;
      const tokenAddr = isToken ? aquaToken : params.payTokenDenom;

      try {
        const msg = {
          dao_address: params.daoAddress,
          fee_manager_address: feeManagerAddress,
          cw20_code_id: cw20CodeId,
          funding_goal: {
            is_token: isToken,
            addr: tokenAddr,
            amount: params.goal.toString(),
          },
          funding_token_name: params.tokenName,
          funding_token_symbol: params.tokenSymbol,
          campaign_info: {
            name: params.name,
            description: params.description,
            website: params.website != "" ? params.website : undefined,
            twitter: params.twitter != "" ? params.twitter : undefined,
            discord: params.discord != "" ? params.discord : undefined,
            profile_image_url: params.profileImageUrl != "" ? params.profileImageUrl: undefined,
            description_image_urls: params.descriptionImageUrls,
            hidden: params.hidden,
          },
        };
        console.log(msg);

        let res = await client.instantiate(
          walletAddress,
          currentEscrowContractCodeId,
          msg,
          "Create the Campaign",
          "auto",
          {
            funds: params.hidden ? [] : [feeConfig?.publicListingFee.coin],
          }
        );
        console.log(res);
        return true;
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    },
    [client, feeConfig, walletAddress]
  );

  return (
    <CenteredColumn>
      <EditCampaignForm
        title={
          <p className="flex-1 min-w-full md:min-w-0">Create a new Campaign</p>
        }
        submitLabel="Create"
        // error={editCampaignError}
        creating={true}
        defaultValues={defaultValues}
        onSubmit={createCampaign}
      />
    </CenteredColumn>
  );
};

export default CreateCampaign;
