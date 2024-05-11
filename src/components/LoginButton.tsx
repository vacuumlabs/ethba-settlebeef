"use client";

import { Button, Skeleton, Stack, Typography } from "@mui/material";
import { useLogin, useLogout, usePrivy } from "@privy-io/react-auth";
import { useContext } from "react";
import { SmartAccountClientContext } from "./providers/SmartAccountClientContext";
import { formatEther } from "viem";
import { useBalance, useEnsName } from "@/hooks/queries";
import { QueryGuard } from "@/hooks/QueryGuard";

const LoginButton = () => {
  const { authenticated, ready } = usePrivy();
  const { connectedAddress, setClient } = useContext(SmartAccountClientContext);
  const ensNameQuery = useEnsName(connectedAddress);

  const { login } = useLogin();

  const { logout } = useLogout({
    onSuccess: () => {
      setClient(undefined);
    },
  });

  const { data: balance, isLoading } = useBalance();

  return authenticated ? (
    <Stack direction="row" alignItems="center" gap={3}>
      {ready ? (
        <Stack direction="row" gap={3}>
          {isLoading || balance == null ? (
            <Skeleton variant="circular" />
          ) : (
            <Typography component="span" variant="body2">
              {formatEther(BigInt(balance.value.toString()))} ETH
            </Typography>
          )}
          <QueryGuard {...ensNameQuery}>
            {(ensName) => (
              <Typography component="span" variant="body2">
                {ensName != null ? ensName : connectedAddress}
              </Typography>
            )}
          </QueryGuard>
        </Stack>
      ) : (
        <Skeleton variant="circular" />
      )}
      <Button variant="contained" color="primary" onClick={logout}>
        Logout
      </Button>
    </Stack>
  ) : (
    <Button variant="contained" color="primary" onClick={login}>
      Login
    </Button>
  );
};

export default LoginButton;
