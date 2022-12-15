import { SigningCosmWasmClient } from "@cosmjs/cosmwasm-stargate";
import { Decimal } from "@cosmjs/math";
import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
import { readFileSync } from "fs";

const CROWDFUND_PATH = "../cw20_dao_crowdfund.wasm";
const FEEMANAGER_PATH = "../fee_manager.wasm";

// Get the wallet seed phrase from the environment variable.
const JUNO_SEED = process.env.JUNO_SEED;

async function getClient() {
  const signer = await DirectSecp256k1HdWallet.fromMnemonic(JUNO_SEED, {
    prefix: "juno",
  });

  const rpc = "https://rpc-juno.itastakers.com:443";
  const client = await SigningCosmWasmClient.connectWithSigner(rpc, signer, {
    gasPrice: {
      amount: Decimal.fromUserInput("0.0025", 100),
      denom: "ujuno",
    },
  });

  // const rpc = "https://rpc.uni.juno.deuslabs.fi"
  // const client = await SigningCosmWasmClient.connectWithSigner(rpc, signer, {
  //   gasPrice: {
  //     amount: Decimal.fromUserInput("0.025", 100), //Decimal.fromUserInput("0.0025", 100),
  //     denom: "ujunox",
  //   },
  // })
  return { signer, client };
}

const AQUA_TOKEN =
  "juno1yyfuedz3wd6prhgma2njdgachc5rp3gjudmk0ey92r0fll055y9sddpasl";
let CROWDFUND_CONTRACT =
  "juno1ppufqmkthpe3emwdwm029c9gf6zc4v32evyxjsmaw4ceavaqdp3q3wlttc";
let FEEMANAGER_CONTRACT =
  "juno150kv85agxsg7gpq7an7pwwwj54akr933nnvy458ke8naevv4ngssplyqgq";

run();

async function run() {
  if (FEEMANAGER_CONTRACT == "") {
    console.log("Deploying FeeManager Contract");
    const feemanagerCodeId = 1542; //await upload(FEEMANAGER_PATH)
    console.log("instantiating FeeManager contract");

    FEEMANAGER_CONTRACT = await instantiate(feemanagerCodeId, {
      fee: "0.1",
      fee_receiver: "juno12v06zrrhw0vs83t83svsddgl4ndfmk9c327gsu",

      public_listing_fee: { denom: "ujuno", amount: "100" },
      public_listing_fee_receiver:
        "juno12v06zrrhw0vs83t83svsddgl4ndfmk9c327gsu",
    });
    console.log(FEEMANAGER_CONTRACT);
  }
  if (CROWDFUND_CONTRACT == "") {
    console.log("Deploying CrowdFund Contract");
    const crowdfundCodeId = 1546; // await upload(CROWDFUND_PATH);
    console.log("instantiating CrowdFund contract");

    CROWDFUND_CONTRACT = await instantiate(crowdfundCodeId, {
      dao_address:
        "juno1mqkpdfcng8xkh8nlm59awucam3qc3lqgjxmgfszzjsw9kjgut37qdj0hpk",
      fee_manager_address: FEEMANAGER_CONTRACT,
      cw20_code_id: 37,
      funding_goal: {
        is_token: true,
        addr: AQUA_TOKEN,
        amount: "1000",
      },
      funding_token_name: "Bong Launch",
      funding_token_symbol: "LBONG",
      campaign_info: {
        name: "Bong DAO",
        description: "We're raising money to buy a bong!",
        // website: None,
        // twitter: None,
        // discord: None,
        // profile_image_url: None,
        description_image_urls: ["https://moonphase.is/image.svg"],
        hidden: true,
      },
    });
    console.log(CROWDFUND_CONTRACT);
  }

  console.log("configuring");
  await config();

  // console.log("reading contract");
  // const { signer, client } = await getClient();

  // let result = await client.queryContractSmart(
  //   "juno1mqkpdfcng8xkh8nlm59awucam3qc3lqgjxmgfszzjsw9kjgut37qdj0hpk",
  //   {
  //     get_config: {},
  //   }
  // );
  // console.log(result);
}

async function config() {
  console.log("Updating Fee Manger");

  const { signer, client } = await getClient();
  const address = (await signer.getAccounts())[0].address;

  try {
    const res = await client.execute(
      address,
      FEEMANAGER_CONTRACT,
      {
        update: {
          config: {
            fee: "0.1",
            fee_receiver: "juno12v06zrrhw0vs83t83svsddgl4ndfmk9c327gsu",

            public_listing_fee: { denom: "ujuno", amount: "100" },
            public_listing_fee_receiver:
              "juno12v06zrrhw0vs83t83svsddgl4ndfmk9c327gsu",
          },
        },
      },
      "auto",
      "update feemanger"
    );
    console.log(res);
  } catch (e) {
    console.log(e);
  }
}

async function upload(contractPath) {
  try {
    const { signer, client } = await getClient();
    const address = (await signer.getAccounts())[0].address;
    const wasm = readFileSync(contractPath);

    const result = await client.upload(address, wasm, "auto");
    console.log(result);
    return result.codeId;
  } catch (error) {
    console.error("Error:" + error);
    process.exit(1);
  }
}

async function instantiate(codeId, instantiateMsg) {
  try {
    const { signer, client } = await getClient();
    const address = (await signer.getAccounts())[0].address;

    const result = await client.instantiate(
      address,
      codeId,
      instantiateMsg,
      "Instantiate",
      "auto"
      // {
      //   memo: "",
      //   admin,
      // }
    );
    console.log(result);
    return result.contractAddress;
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}
