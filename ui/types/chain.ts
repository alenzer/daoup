import { Coin } from "@cosmjs/amino";

import { CampaignStatus } from "@/types";

declare global {
  interface FundToken {
    is_token: boolean;
    addr: string;
    amount: string;
  }
  type TokenInfoResponse = {
    decimals: number;
    name: string;
    symbol: string;
    total_supply: number;
  };

  interface CampaignDumpStateResponse {
    campaign_info: CampaignInfo;
    creator: string;
    dao_addr: string;
    fee_manager_addr?: string; // v3
    funding_goal: FundToken;
    funding_token_addr: string;
    funding_token_info: TokenInfoResponse;
    funds_raised: FundToken;
    gov_token_addr: string;
    gov_token_info?: TokenInfoResponse;
    status: CampaignDumpStateStatus;
    version?: string;
  }

  // See CampaignVersionedStatus for more fine-grained types.
  type CampaignDumpStateStatus = Record<
    CampaignStatus,
    | {
        initial_gov_token_balance?: string;
        token_price?: string;
      }
    | undefined
  >;

  interface AddressPriorityListItem {
    addr: string;
    priority: number;
  }

  interface AddressPriorityListResponse {
    members: AddressPriorityListItem[];
  }

  interface FeeManagerGetConfigResponse {
    config: {
      fee: string;
      fee_receiver: string;
      public_listing_fee: Coin;
      public_listing_fee_receiver: string;
    };
  }

  interface FeeManagerConfigResponse {
    fee: number;
    publicListingFee: {
      token: PayToken;
      coin: Coin;
    };
  }
}

interface CampaignInfo {
  description: string;
  description_image_urls?: string[];
  discord?: string | null;
  hidden: boolean;
  image_url?: string | null;
  name: string;
  profile_image_url?: string | null;
  twitter?: string | null;
  website?: string | null;
}
