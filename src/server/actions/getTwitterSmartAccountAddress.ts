"use server";

import { cookies } from "next/headers";
import { Address, getContract } from "viem";
import { sql } from "@vercel/postgres";
import { LocalAccountSigner } from "@alchemy/aa-core";
import { createLightAccountAlchemyClient } from "@alchemy/aa-alchemy";
import {
  LinkedAccountWithMetadata,
  PrivyClient,
  WalletWithMetadata,
} from "@privy-io/server-auth";
import { activeChainAlchemy, publicClient } from "@/utils/chain";
import { lightAccountFactoryAbi } from "@/abi/lightAccountFactory";

const privy = new PrivyClient(
  process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
  process.env.PRIVY_APP_SECRET!,
);

const LIGHT_ACCOUNT_FACTORY_ADDRESS =
  "0x00004EC70002a32400f8ae005A26081065620D20";

const getLightAccountAddress = getContract({
  client: publicClient,
  address: LIGHT_ACCOUNT_FACTORY_ADDRESS,
  abi: lightAccountFactoryAbi,
}).read.getAddress;

export type UserDetailsResponseType = {
  smart_account_address: Address;
  owner?: Address;
  temporary_private_key?: Address;
};

export const getTwitterSmartAccountAddress = async () => {
  const authToken = cookies().get("privy-token")?.value;

  if (authToken === undefined) throw new Error("");

  const claims = await privy.verifyAuthToken(authToken);
  const user = await privy.getUser(claims.userId);

  const walletAddress = user.linkedAccounts.find(isWalletWithMetadata)
    ?.address as Address;

  if (walletAddress === undefined) {
    throw new Error(`User ${user.id} does not have an embedded wallet`);
  }

  const handle = user.twitter?.username;

  if (!handle) {
    throw new Error("User does not have a twitter connected");
  }

  const { rows } =
    await sql`SELECT smart_account_address, temporary_private_key, owner FROM user_details WHERE handle = ${handle} `;

  if (rows.length > 0) {
    const { smart_account_address, temporary_private_key, owner } =
      rows[0]! as UserDetailsResponseType;

    if (owner) {
      // User is already the owner of the account
      return smart_account_address;
    } else {
      // Transfer the ownership of the account to user
      const signer = LocalAccountSigner.privateKeyToAccountSigner(
        temporary_private_key!,
      );

      const smartAccountClient = await createLightAccountAlchemyClient({
        signer,
        accountAddress: smart_account_address,
        chain: activeChainAlchemy,
        apiKey: process.env.NEXT_PUBLIC_ALCHEMY_API_KEY,
        gasManagerConfig: {
          policyId: process.env.NEXT_PUBLIC_GAS_POLICY_ID!,
        },
      });

      const transferData =
        smartAccountClient.account.encodeTransferOwnership(walletAddress);

      await smartAccountClient.sendTransaction({
        to: smart_account_address,
        data: transferData,
        chain: activeChainAlchemy,
      });

      await sql`UPDATE user_details SET owner = ${walletAddress}, temporary_private_key = NULL WHERE handle = ${handle}`;

      return smart_account_address;
    }
  } else {
    // No wallet is pre-generated. We can just create a default one from the embedded wallet's address
    const accountAddress = await getLightAccountAddress([walletAddress, 0n]);

    await sql`INSERT INTO user_details (handle, smart_account_address, owner) 
      values (${handle}, ${accountAddress}, ${walletAddress})`;

    return accountAddress;
  }
};

const isWalletWithMetadata = (
  account: LinkedAccountWithMetadata,
): account is WalletWithMetadata =>
  account.type === "wallet" && account.walletClientType === "privy";