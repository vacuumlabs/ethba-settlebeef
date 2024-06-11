import { Address } from "viem";
import { base, baseSepolia } from "viem/chains";
import { activeChain } from "@/utils/chain";

type ChainAddressMap = Record<typeof activeChain.id, Address>;

const slaughterhouseAddresses: ChainAddressMap = {
  [baseSepolia.id]: "0x680C811Af29ab31d79e5eDb1b81A862fCF7d28DD",
  [base.id]: "0xc16809833E080A640F98d65c0561b156DC3348ad",
};

const wethAddresses: ChainAddressMap = {
  [baseSepolia.id]: "0x24fe7807089e321395172633aA9c4bBa4Ac4a357",
  [base.id]: "0x4200000000000000000000000000000000000006",
};

const wsethAddresses: ChainAddressMap = {
  [baseSepolia.id]: "0xeAc0CE2994032302f72c078b678c09CcA515AD49",
  [base.id]: "0xc1CBa3fCea344f92D9239c08C0568f6F2F0ee452",
};

const uniswapRouterAddresses: ChainAddressMap = {
  [baseSepolia.id]: "0x6682375ebc1df04676c0c5050934272368e6e883",
  [base.id]: "0x4752ba5dbc23f44d87826276bf6fd6b1c372ad24",
};

export const SLAUGHTERHOUSE_ADDRESS = slaughterhouseAddresses[activeChain.id];
export const WETH_ADDRESS = wethAddresses[activeChain.id];
export const WSTETH_ADDRESS = wsethAddresses[activeChain.id];
export const UNISWAP_ROUTER_ADDRESS = uniswapRouterAddresses[activeChain.id];

export const LIGHT_ACCOUNT_FACTORY_ADDRESS =
  "0x00004EC70002a32400f8ae005A26081065620D20";
