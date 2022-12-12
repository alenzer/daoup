import { SigningCosmWasmClient } from "@cosmjs/cosmwasm-stargate"
import { Decimal } from "@cosmjs/math"
import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing"
import { readFileSync } from "fs"

const CROWDFUND_PATH = "../cw20_dao_crowdfund.wasm"
const FEEMANAGER_PATH = "../fee_manager.wasm"

// Get the wallet seed phrase from the environment variable.
const JUNO_SEED = process.env.JUNO_SEED

async function getClient() {
  const signer = await DirectSecp256k1HdWallet.fromMnemonic(JUNO_SEED, {
    prefix: "juno",
  })

  const rpc = "https://rpc.juno-1.deuslabs.fi"
  const client = await SigningCosmWasmClient.connectWithSigner(rpc, signer, {
    gasPrice: {
      amount: Decimal.fromUserInput("0.0025", 100),
      denom: "ujuno",
    },
  })

  // const rpc = "https://rpc.uni.juno.deuslabs.fi"
  // const client = await SigningCosmWasmClient.connectWithSigner(rpc, signer, {
  //   gasPrice: {
  //     amount: Decimal.fromUserInput("0.025", 100), //Decimal.fromUserInput("0.0025", 100),
  //     denom: "ujunox",
  //   },
  // })
  return { signer, client }
}

const AQUA_TOKEN =
  "juno17tk7s9mg2a6uupfljrhf492e7hzhkd89cvzerglyj8xguvzukksq9d75ts"
const TREASURY = "juno12v06zrrhw0vs83t83svsddgl4ndfmk9c327gsu"
let CROWDFUND_CONTRACT = ""
let FEEMANAGER_CONTRACT = ""
// const AQUA_TOKEN =
//   "juno1hnftys64ectjfynm6qjk9my8jd3f6l9dq9utcd3dy8ehwrsx9q4q7n9uxt" //mainnet
// const TREASURY = "juno1jpsktf82sj02ez4j2c5c8jayurn8muqwkqdx2m" //mainnet
// let VESTING_CONTRACT =
//   "juno1804qz457akjcret7akpgk04zskqz5kggljgne97sggwnm88mc9gsk0esgd"

run()

async function run() {
  if (FEEMANAGER_CONTRACT == "") {
    console.log("Deploying FeeManager Contract")
    const feemanagerCodeId = 1542; //await upload(FEEMANAGER_PATH)
    console.log("instantiating FeeManager contract")

    FEEMANAGER_CONTRACT = await instantiate(feemanagerCodeId, {
      fee: "10",
      fee_receiver: "juno12v06zrrhw0vs83t83svsddgl4ndfmk9c327gsu",

      public_listing_fee: { denom: "ujunox", amount: "100" },
      public_listing_fee_receiver:
        "juno12v06zrrhw0vs83t83svsddgl4ndfmk9c327gsu",
    })
    console.log(FEEMANAGER_CONTRACT)
  }
  if (CROWDFUND_CONTRACT == "") {
    console.log("Deploying CrowdFund Contract")
    const crowdfundCodeId = await upload(CROWDFUND_PATH)
    console.log("instantiating CrowdFund contract")

    CROWDFUND_CONTRACT = await instantiate(crowdfundCodeId, {
      token_addr: AQUA_TOKEN,
      treasury: TREASURY,
    })
    console.log(CROWDFUND_CONTRACT)
  }

  // console.log("configuring");
  // await config();

  // console.log("reading contract")
  // const { signer, client } = await getClient()

  // let result = await client.queryContractSmart(CROWDFUND_CONTRACT, {
  //   get_config: {},
  // })
  // console.log(result)
}

async function config() {
  console.log("vesting_contract:" + CROWDFUND_CONTRACT)

  const { signer, client } = await getClient()
  const address = (await signer.getAccounts())[0].address
}

async function upload(contractPath) {
  try {
    const { signer, client } = await getClient()
    const address = (await signer.getAccounts())[0].address
    const wasm = readFileSync(contractPath)

    const result = await client.upload(address, wasm, "auto")
    console.log(result)
    return result.codeId
  } catch (error) {
    console.error("Error:" + error)
    process.exit(1)
  }
}

async function instantiate(codeId, instantiateMsg) {
  try {
    const { signer, client } = await getClient()
    const address = (await signer.getAccounts())[0].address

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
    )
    console.log(result)
    return result.contractAddress
  } catch (error) {
    console.error(error)
    process.exit(1)
  }
}
