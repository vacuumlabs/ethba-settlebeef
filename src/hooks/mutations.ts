import { SmartAccountClientContext } from "@/components/providers/SmartAccountClientContext";
import { beefAbi } from "@/abi/beef";
import type { Address } from "@/types";
import { NewBeefFormValues } from "@/app/beef/new/page";
import { SLAUGHTERHOUSE_ADDRESS } from "@/config";
import { ArbiterAccount } from "@/types";
import { getUserGeneratedAddress } from "@/utils/generateUserAddress";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useContext } from "react";
import { encodeFunctionData, isAddress } from "viem";
import { slaughterhouseAbi } from "@/abi/slaughterhouse";
import { parseIsoDateToTimestamp } from "@/utils/general";
import { queryKeys } from "./queryKeys";
import { sendBeefRequestEmail } from "@/server/actions/sendBeefRequestEmail";

export const useArbiterAttend = (beefId: Address) => {
  const { sendTransaction } = useContext(SmartAccountClientContext);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const txHash = await sendTransaction({
        to: beefId,
        data: encodeFunctionData({
          abi: beefAbi,
          functionName: "arbiterAttend",
          args: [],
        }),
      });

      return txHash;
    },
    onSuccess() {
      void queryClient.invalidateQueries({ queryKey: [queryKeys.balance] });
    },
  });
};

export const useSettleBeef = (beefId: Address) => {
  const { sendTransaction } = useContext(SmartAccountClientContext);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (verdict: boolean) => {
      const txHash = await sendTransaction({
        to: beefId,
        data: encodeFunctionData({
          abi: beefAbi,
          functionName: "settleBeef",
          args: [verdict],
        }),
      });

      return txHash;
    },
    onSuccess() {
      void queryClient.invalidateQueries({ queryKey: [queryKeys.balance] });
    },
  });
};

export const useJoinBeef = (beefId: Address, value: bigint) => {
  const { sendTransaction } = useContext(SmartAccountClientContext);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const txHash = await sendTransaction({
        to: beefId,
        value,
        data: encodeFunctionData({
          abi: beefAbi,
          functionName: "joinBeef",
          args: [],
        }),
      });

      return txHash;
    },
    onSuccess() {
      void queryClient.invalidateQueries({ queryKey: [queryKeys.balance] });
    },
  });
};

export const useAddBeef = () => {
  const { sendTransaction, connectedAddress } = useContext(
    SmartAccountClientContext
  );
  const queryClient = useQueryClient();

  const addBeef = async ({
    arbiters,
    title,
    description,
    wager,
    settleStart,
    joinDeadline,
    foe,
  }: NewBeefFormValues) => {
    if (!connectedAddress) {
      throw new Error("Wallet not connected");
    }
    if (!foe || !isAddress(foe) || !wager) {
      throw new Error("Invalid request");
    }

    arbiters.forEach((arbiter) => {
      if (arbiter.type === ArbiterAccount.EMAIL) {
        sendBeefRequestEmail(arbiter.value);
      }
    });

    const addressPromises = arbiters.map(({ type, value }) =>
      type === ArbiterAccount.ADDRESS
        ? (value as Address)
        : getUserGeneratedAddress([
            {
              address: value,
              type: "email" as const,
            },
          ])
    );

    const arbitersAddresses = await Promise.all(addressPromises);

    return sendTransaction({
      to: SLAUGHTERHOUSE_ADDRESS,
      value: wager,
      data: encodeFunctionData({
        abi: slaughterhouseAbi,
        functionName: "packageBeef",
        args: [
          {
            owner: connectedAddress,
            wager,
            foe,
            settleStart: parseIsoDateToTimestamp(settleStart),
            joinDeadline: parseIsoDateToTimestamp(joinDeadline),
            title,
            description,
            arbiters: arbitersAddresses,
          },
        ],
      }),
    });
  };

  return useMutation({
    mutationFn: addBeef,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [queryKeys.balance] });
    },
  });
};

export const useWithdrawRaw = (beefId: Address) => {
  const { sendTransaction } = useContext(SmartAccountClientContext);

  return useMutation({
    mutationFn: async () => {
      const txHash = await sendTransaction({
        to: beefId,
        data: encodeFunctionData({
          abi: beefAbi,
          functionName: "withdrawRaw",
          args: [],
        }),
      });

      return txHash;
    },
    onSuccess() {
      // FIXME:invalidate QueryClient
    },
  });
};

export const useWithdrawRotten = (beefId: Address) => {
  const { sendTransaction } = useContext(SmartAccountClientContext);

  return useMutation({
    mutationFn: async () => {
      const txHash = await sendTransaction({
        to: beefId,
        data: encodeFunctionData({
          abi: beefAbi,
          functionName: "withdrawRotten",
          args: [],
        }),
      });

      return txHash;
    },
    onSuccess() {
      // FIXME:invalidate QueryClient
    },
  });
};

export const useServeBeef = (beefId: Address) => {
  const { sendTransaction } = useContext(SmartAccountClientContext);

  return useMutation({
    mutationFn: async () => {
      const txHash = await sendTransaction({
        to: beefId,
        data: encodeFunctionData({
          abi: beefAbi,
          functionName: "serveBeef",
          args: [],
        }),
      });

      return txHash;
    },
    onSuccess() {
      // FIXME:invalidate QueryClient
    },
  });
};
