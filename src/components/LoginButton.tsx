"use client"

import { useContext } from "react"
import { Avatar, Name } from "@coinbase/onchainkit/identity"
import { Button, Skeleton, Stack, SvgIcon, Typography } from "@mui/material"
import { useLogin, useLogout, usePrivy } from "@privy-io/react-auth"
import { enqueueSnackbar } from "notistack"
import { useDisconnect } from "wagmi"
import { CopyIcon } from "@/components/CopyIcon"
import { useBalance } from "@/hooks/queries"
import { copyTextToClipboard, formatBigint } from "@/utils/general"
import { SmartAccountClientContext } from "./providers/SmartAccountClientContext"

const LoginButton = () => {
  const { authenticated, ready } = usePrivy()
  const { connectedAddress, setClient } = useContext(SmartAccountClientContext)
  const { disconnect } = useDisconnect()

  const { login } = useLogin()

  const { logout } = useLogout({
    onSuccess: () => {
      setClient(undefined)
      // Manually disconnect wagmi to clean up state in wagmi hooks
      disconnect()
    },
  })

  const { data: balance, isLoading } = useBalance()

  if (!authenticated) {
    return (
      <Button variant="contained" color="primary" onClick={login}>
        Login
      </Button>
    )
  }

  const handleCopyAddress = async () => {
    if (connectedAddress === undefined) return

    const isSuccess = await copyTextToClipboard(connectedAddress)

    if (isSuccess) {
      enqueueSnackbar("Address copied", {
        variant: "success",
        preventDuplicate: true,
      })
    } else {
      enqueueSnackbar("Error copying address", {
        variant: "error",
        preventDuplicate: true,
      })
    }
  }

  return (
    <Stack direction="row" alignItems="center" gap={3}>
      {ready ? (
        <Stack direction="row" alignItems="center" gap={3}>
          {isLoading ? (
            <Skeleton height={15} width={200} />
          ) : (
            <Typography component="span">{formatBigint(balance, 5)}&nbsp;Ξ</Typography>
          )}
          {connectedAddress && (
            <Stack direction="row" alignItems="center" gap={0.5}>
              <Name address={connectedAddress} />
              <Avatar
                address={connectedAddress}
                loadingComponent={<span>&nbsp;</span>}
                defaultComponent={<span>&nbsp;</span>}
              />
              <Button
                onClick={handleCopyAddress}
                aria-label="copy"
                variant="contained"
                size="small"
                startIcon={
                  <SvgIcon width={18} height={18}>
                    <CopyIcon />
                  </SvgIcon>
                }
              >
                <Typography variant="button" fontSize={12}>
                  Copy Address
                </Typography>
              </Button>
            </Stack>
          )}
        </Stack>
      ) : (
        <Skeleton variant="circular" />
      )}
      <Button variant="contained" color="primary" onClick={logout}>
        Logout
      </Button>
    </Stack>
  )
}

export default LoginButton
