import { LocalAccountSigner } from "@alchemy/aa-core";
import {
  LinkedAccountWithMetadata,
  PrivyClient,
  WalletWithMetadata,
} from "@privy-io/server-auth";
import { sql } from "@vercel/postgres";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { Address, getContract } from "viem";
import { lightAccountFactoryAbi } from "@/abi/lightAccountFactory";
import { LIGHT_ACCOUNT_FACTORY_ADDRESS } from "@/constants";
import { activeChain, publicClient } from "@/utils/chain";
import { createSmartAccountClient } from "@/utils/userOperation";

export type GetGeneratedSmartAccountAddressResponse = {
  address: Address | undefined;
};

export const GET = async (
  _: NextRequest,
): Promise<NextResponse<GetGeneratedSmartAccountAddressResponse>> => {
  const address = await getSmartAccountAddress();

  return NextResponse.json({ address });
};

const privy = new PrivyClient(
  process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
  process.env.PRIVY_APP_SECRET!,
);

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

const getSmartAccountAddress = async () => {
  const authToken = cookies().get("privy-token")?.value;

  if (authToken === undefined) {
    console.error("Auth token not found");
    return undefined;
  }

  const claims = await privy.verifyAuthToken(authToken);
  const user = await privy.getUser(claims.userId);

  const walletAddress = user.linkedAccounts.find(isWalletWithMetadata)
    ?.address as Address;

  if (walletAddress === undefined) {
    console.error(`User ${user.id} does not have an embedded wallet`);
    return undefined;
  }

  const xHandle = user.twitter?.username ?? undefined;
  const email = user.email?.address;
  const farcasterID = user.farcaster?.fid?.toString();

  if (
    xHandle === undefined &&
    email === undefined &&
    farcasterID === undefined
  ) {
    console.error(
      `User ${user.id} does not have a X / Twitter or Email or Farcaster connected`,
    );

    return undefined;
  }

  const { rows } = await sql<UserDetailsResponseType>`
    SELECT smart_account_address,
           temporary_private_key,
           OWNER
    FROM user_details
    WHERE chain_id = ${activeChain.id}
      AND (x_handle = ${xHandle}
           AND x_handle IS NOT NULL)
      OR (email = ${email}
          AND email IS NOT NULL)
      OR (farcaster_id = ${farcasterID}
          AND farcaster_id IS NOT NULL);
    `;

  if (rows[0]) {
    const { smart_account_address, temporary_private_key, owner } = rows[0];

    if (owner) {
      // User is already the owner of the account
      return smart_account_address;
    } else {
      // Transfer the ownership of the account to user
      const signer = LocalAccountSigner.privateKeyToAccountSigner(
        temporary_private_key!,
      );

      const smartAccountClient = await createSmartAccountClient(
        signer,
        smart_account_address,
      );

      const transferData =
        smartAccountClient.account.encodeTransferOwnership(walletAddress);

      await smartAccountClient.sendUserOperation({
        uo: {
          target: smart_account_address,
          data: transferData,
        },
      });

      await sql`
      UPDATE user_details 
      SET owner = ${walletAddress}, temporary_private_key = NULL 
      WHERE (x_handle = ${xHandle} AND x_handle IS NOT NULL) OR (email = ${email} AND email IS NOT NULL) OR (farcaster_id = ${farcasterID} AND farcaster_id IS NOT NULL);
      `;

      return smart_account_address;
    }
  } else {
    // No wallet is pre-generated. We can just create a default one from the embedded wallet's address
    const accountAddress = await getLightAccountAddress([walletAddress, 0n]);

    await sql`INSERT INTO user_details (x_handle, email, farcaster_id, smart_account_address, owner, chain_id) 
      values (${xHandle}, ${email}, ${farcasterID}, ${accountAddress}, ${walletAddress}, ${activeChain.id})`;

    return accountAddress;
  }
};

const isWalletWithMetadata = (
  account: LinkedAccountWithMetadata,
): account is WalletWithMetadata =>
  account.type === "wallet" && account.walletClientType === "privy";
