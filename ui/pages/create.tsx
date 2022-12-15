import type { NextPage } from "next";
import Head from "next/head";
import Image from "next/image";

import {
  Button,
  ButtonLink,
  CenteredColumn,
  FAQQuestion,
  FormInput,
  HomepageFeaturedCampaigns,
  ResponsiveDecoration,
  Suspense,
} from "@/components";
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

import { CommonError, convertDenomToMicroDenom, parseError } from "@/helpers";
import { useRefreshCampaign, useWallet } from "@/hooks";
import {
  feeManagerConfig,
  globalLoadingAtom,
  nativeWalletTokenBalance,
  signedCosmWasmClient,
  tokenBalanceId,
} from "@/state";

interface CampaignForm {
  daoAddress: string;
  fundingGoal: number;
  fundingTokenName: string;
  fundingTokenSymbol: string;
  name: string;
  description: string;
  website?: string;
  twitter?: string;
  discord?: string;
  profileImageURL?: string;
  descriptionImageURLs?: string;
  hidden: boolean;
}

const CreateCampaign: NextPage = () => {
  const client = useRecoilValue(signedCosmWasmClient);
  const { walletAddress } = useWallet();
  const setLoading = useSetRecoilState(globalLoadingAtom);
  const feeConfig = useRecoilValue(feeManagerConfig);

  const {
    handleSubmit,
    register,
    formState: { errors },
    watch,
    reset,
    setValue,
  } = useForm<CampaignForm>({
    mode: "onChange",
    defaultValues: {},
  });

  const [token, setToken] = useState("juno");
  const [error, setError] = useState("");

  const changeToken = (e: any) => {
    setToken(e.target.value);
  };
  const doContribution = useCallback(
    async (params: CampaignForm) => {
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

      const isToken = token.toLocaleLowerCase() == "juno" ? true : false;
      const tokenAddr = isToken ? aquaToken : "ujuno";

      const images =
        params.descriptionImageURLs == ""
          ? []
          : params.descriptionImageURLs?.split(",");
      try {
        const msg = {
          dao_address: params.daoAddress,
          fee_manager_address: feeManagerAddress,
          cw20_code_id: cw20CodeId,
          funding_goal: {
            is_token: isToken,
            addr: tokenAddr,
            amount: params.fundingGoal,
          },
          funding_token_name: params.fundingTokenName,
          funding_token_symbol: params.fundingTokenSymbol,
          campaign_info: {
            name: params.name,
            description: params.description,
            website: params.website != "" ?? undefined,
            twitter: params.twitter != "" ?? undefined,
            discord: params.discord != "" ?? undefined,
            profile_image_url: params.profileImageURL != "" ?? undefined,
            description_image_urls: images,
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
    [reset]
  );

  return (
    <>
      <Head>
        <title>{title}</title>
        <meta property="twitter:title" content={title} key="twitter:title" />
        <meta property="og:title" content={title} key="og:title" />
        <meta property="og:url" content={baseUrl} key="og:url" />
      </Head>

      <ResponsiveDecoration
        name="orange_blur.png"
        width={393}
        height={653}
        className="top-0 left-0 opacity-70"
      />
      <ResponsiveDecoration
        name="green_blur.png"
        width={322}
        height={640}
        className="top-40 right-0 opacity-80"
      />
      <ResponsiveDecoration
        name="circles.svg"
        width={487}
        height={571}
        className="top-80 right-0 opacity-40"
      />

      <CenteredColumn className="pt-5 text-center flex flex-col items-center">
        <h1 className="font-semibold text-4xl lg:text-5xl xl:text-6xl">
          Create Campaign
        </h1>

        <p className="my-10 mx-auto w-3/4 md:w-1/2 xl:w-2/5 text-md lg:text-xl xl:text-2xl">
          Input in order to create the campaign
        </p>

        <form
          onSubmit={handleSubmit(doContribution)}
          className="flex flex-col w-[50%] items-center"
        >
          <FormInput
            wrapperClassName="w-full"
            placeholder="Dao Address *"
            {...register("daoAddress")}
          />
          <FormInput
            wrapperClassName="w-full"
            type="number"
            placeholder="Funding Goal *"
            tail={
              <select onChange={changeToken}>
                <option>Juno</option>
                <option>Aqua</option>
              </select>
            }
            {...register("fundingGoal")}
          />
          <FormInput
            wrapperClassName="w-full"
            placeholder="Funding token name *"
            {...register("fundingTokenName")}
          />
          <FormInput
            wrapperClassName="w-full"
            placeholder="Funding token symbol *"
            {...register("fundingTokenSymbol")}
          />
          <FormInput
            wrapperClassName="w-full"
            placeholder="Campaign Name *"
            {...register("name")}
          />
          <FormInput
            wrapperClassName="w-full"
            placeholder="Campaign Description *"
            {...register("description")}
          />
          <FormInput
            wrapperClassName="w-full"
            placeholder="website"
            {...register("website")}
          />
          <FormInput
            wrapperClassName="w-full"
            placeholder="twitter"
            {...register("twitter")}
          />
          <FormInput
            wrapperClassName="w-full"
            placeholder="discord"
            {...register("discord")}
          />
          <FormInput
            wrapperClassName="w-full"
            placeholder="Profile Image URL"
            {...register("profileImageURL")}
          />
          <FormInput
            wrapperClassName="w-full"
            placeholder="Description Image URLs"
            {...register("descriptionImageURLs")}
          />
          <FormInput
            wrapperClassName="w-full"
            type="checkbox"
            placeholder="hidden"
            accent="Hide/Show"
            {...register("hidden")}
          />
          <Button
            className="sm:h-[50px] w-[50%]"
            disabled={false}
            submitLabel="Create this campaign"
          />
        </form>
      </CenteredColumn>
    </>
  );
};

export default CreateCampaign;
