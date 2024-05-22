"use client";

import React, { useContext } from "react";
import {
  useBeef,
  useEnsNames,
  useGetArbiterStatuses,
} from "../../../hooks/queries";
import {
  Box,
  Chip,
  Container,
  Paper,
  Skeleton,
  Stack,
  Step,
  StepConnector,
  StepIconProps,
  StepLabel,
  Stepper,
  Typography,
  stepConnectorClasses,
  styled,
} from "@mui/material";
import { redirect } from "next/navigation";
import { Address, formatEther, isAddressEqual, zeroAddress } from "viem";
import { getAddressOrEnsName } from "@/utils";
import { SmartAccountClientContext } from "@/components/providers/SmartAccountClientContext";
import BeefControls from "@/components/BeefControls";
import { Countdown } from "@/components/Countdown";
import { calculateColorFromStreetCredit } from "@/utils/colors";

type BeefDetailPageProps = {
  params: {
    id: string;
  };
};

const BeefStepConnector = styled(StepConnector)(({ theme }) => ({
  [`&.${stepConnectorClasses.alternativeLabel}`]: {
    top: 30,
    left: "calc(-50% + 30px)",
    right: "calc(50% + 30px)",
  },
  [`&.${stepConnectorClasses.active}`]: {
    [`& .${stepConnectorClasses.line}`]: {
      borderColor: theme.palette.primary.main,
    },
  },
  [`&.${stepConnectorClasses.completed}`]: {
    [`& .${stepConnectorClasses.line}`]: {
      borderColor: "#784af4",
    },
  },
  [`& .${stepConnectorClasses.line}`]: {
    borderColor:
      theme.palette.mode === "dark"
        ? theme.palette.grey[800]
        : theme.palette.grey[400],
    borderTopWidth: 3,
    borderRadius: 1,
  },
}));

function StepIcon(props: StepIconProps) {
  const { icon, completed } = props;
  return (
    <Box
      sx={(theme) => ({
        bgcolor: completed
          ? theme.palette.primary.main
          : theme.palette.grey[100],
        width: 60,
        height: 60,
        borderRadius: "100%",
        alignContent: "center",
        textAlign: "center",
      })}
    >
      <Typography
        variant="h4"
        sx={{
          justifyContent: "center",
          color: "white",
          textShadow:
            "-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000;",
        }}
      >
        {icon}
      </Typography>
    </Box>
  );
}

const STEPS = [
  { icon: "🥩", text: "Beef creation" },
  { icon: "🧑‍⚖️", text: "Arbiters attendance" },
  { icon: "🤺", text: "Challenger joining" },
  { icon: "👨‍🍳", text: "Beef cooking" },
  { icon: "🧑‍⚖️", text: "Beef settling" },
  { icon: "🍽️", text: "Beef ready to serve" },
  { icon: "😋", text: "Beef served" },
] as const;

const BeefDetailPage = ({ params }: BeefDetailPageProps) => {
  const { connectedAddress } = useContext(SmartAccountClientContext);
  const { id } = params;
  const beef = useBeef(id as Address);

  const arbiterStatuses = useGetArbiterStatuses(
    beef?.address ?? zeroAddress,
    beef?.arbiters ?? [],
  );

  const { isLoading: ensNamesLoading, data: ensNames } = useEnsNames([
    beef?.owner,
    beef?.challenger,
    ...(beef?.arbiters ?? []),
  ]);

  if (beef === undefined) {
    redirect("/not-found");
  }

  if (beef === null || ensNamesLoading) {
    return (
      <Container sx={{ pb: 6 }}>
        <Skeleton height={600} />
      </Container>
    );
  }

  const {
    title,
    description,
    owner,
    challenger,
    wager,
    joinDeadline: joinDeadlineTimestamp,
    arbiters,
    resultYes,
    resultNo,
    attendCount,
    isCooking,
    settleStart: settleStartTimestamp,
    staking,
    beefGone,
    refetch,
  } = beef;

  const isUserArbiter = arbiters.some((arbiter) =>
    isAddressEqual(arbiter, connectedAddress ?? zeroAddress),
  );
  const isUserChallenger = isAddressEqual(
    challenger,
    connectedAddress ?? zeroAddress,
  );
  const isUserOwner = isAddressEqual(owner, connectedAddress ?? zeroAddress);

  const joinDeadline = new Date(Number(joinDeadlineTimestamp) * 1000);
  const settleStart = new Date(Number(settleStartTimestamp) * 1000);

  // FIXME: this assumes constant settlingDuration of 30 days!
  const settleDuration = BigInt(60 * 60 * 24 * 30);
  const settleDeadline = new Date(
    Number((settleStartTimestamp + settleDuration) * 1000n),
  );

  const getBeefState = () => {
    const now = new Date();

    if (attendCount < arbiters.length) {
      if (now < joinDeadline) {
        return {
          step: 1,
          steps: STEPS,
          deadline: joinDeadline,
        };
      } else {
        return {
          steps: [
            { icon: "🥩", text: "Beef creation" },
            { icon: "🤦", text: "Arbiters didn't attend" },
            { icon: "🤢", text: "Beef raw forever" },
          ],
          step: beefGone ? 3 : 2,
          isRotten: true,
          deadline: joinDeadline, // TODO: verify
        };
      }
    } else {
      if (isCooking) {
        if (now < settleStart) {
          return {
            steps: STEPS,
            step: 3,
            deadline: settleStart,
          };
        } else {
          const majorityReached =
            resultYes > arbiters.length / 2 || resultNo > arbiters.length / 2;

          if (majorityReached) {
            return {
              steps: STEPS,
              step: beefGone ? 7 : 5,
            };
          } else if (now > settleDeadline) {
            return {
              steps: [
                { icon: "🥩", text: "Beef creation" },
                { icon: "🧑‍⚖️", text: "Arbiters attendance" },
                { icon: "🤺", text: "Challenger joining" },
                { icon: "👨‍🍳", text: "Beef cooking" },
                { icon: "🤦", text: "Beef wasn't settled" },
                { icon: "🤢", text: "Beef rotten" },
              ],
              step: 4,
              isRotten: true,
            };
          } else {
            return {
              steps: STEPS,
              step: 4,
              deadline: settleDeadline,
            };
          }
        }
      } else {
        return {
          steps: [
            { icon: "🥩", text: "Beef creation" },
            { icon: "🧑‍⚖️", text: "Arbiters attendance" },
            { icon: "🤦", text: "Challenger didn't join" },
            { icon: "🤢", text: "Beef raw forever" },
          ],
          step: beefGone ? 4 : 3,
          isRotten: true,
          deadline: joinDeadline,
        };
      }
    }
  };

  const dateCases: Record<string, Date> = {
    "Challenger joining": joinDeadline,
    "Beef cooking": settleStart,
    "Beef settling": settleDeadline,
  };

  const { steps, step, isRotten, deadline } = getBeefState();

  return (
    <Container sx={{ pt: 4, pb: 6 }}>
      <Paper elevation={2} square>
        <Stack p={4} spacing={2} alignItems={"center"}>
          <Stack
            sx={{
              flexDirection: "row",
              justifyContent: "space-between",
              width: "100%",
            }}
          >
            <Typography variant="h2">🔥 {title}</Typography>
            <Stack alignItems="flex-end" gap={2}>
              <Typography variant="h4">
                💸&nbsp;{formatEther(wager)}&nbsp;Ξ
              </Typography>
              {staking && (
                <Chip
                  sx={{ backgroundColor: "primary.main" }}
                  label={
                    <Typography fontWeight={500} color="white">
                      {"Steaked 🥩📈"}
                    </Typography>
                  }
                />
              )}
            </Stack>
          </Stack>
          <Typography variant="h5">{description}</Typography>
          <Typography variant="h3" whiteSpace="pre-line" pb={4}>
            {getAddressOrEnsName(owner, ensNames?.at(0))} 🥊 vs 🥊{" "}
            {getAddressOrEnsName(challenger, ensNames?.at(1))}
          </Typography>

          <Stepper
            activeStep={step}
            alternativeLabel
            sx={{ width: "100%" }}
            connector={<BeefStepConnector />}
          >
            {steps.map((label, index) => {
              const stepDate = dateCases[label.text]?.toDateString();

              return (
                <Step key={label.text}>
                  <StepLabel
                    StepIconComponent={() => {
                      return StepIcon({
                        completed: step > index,
                        icon: label.icon,
                      });
                    }}
                  >
                    <Stack>
                      <Typography>{label.text}</Typography>
                      {stepDate && !isRotten && (
                        <Stack>
                          <Typography variant="body2">Deadline</Typography>
                          <Typography variant="body2">{stepDate}</Typography>
                        </Stack>
                      )}
                      {index === step && deadline !== undefined && (
                        <Typography sx={{ fontWeight: 600 }}>
                          <Countdown deadline={deadline} />
                        </Typography>
                      )}
                    </Stack>
                  </StepLabel>
                </Step>
              );
            })}
          </Stepper>

          <Stack gap={1} alignItems={"stretch"} pt={6}>
            <Typography variant="h4" mb={1} alignSelf={"center"}>
              Arbiters
            </Typography>
            {step >= 4 && (
              <Typography
                variant="h6"
                whiteSpace="pre-line"
                alignSelf={"center"}
              >
                {resultYes.toString()} vote{resultYes > 1n ? "s" : ""} for ⚔️{" "}
                {resultNo.toString()} vote{resultNo > 1n ? "s " : " "}
                against
              </Typography>
            )}
            {/* TODO: We can fetch more complex info about arbiters (e.g. their social credit) and display it here */}
            {arbiters.map((arbiter, index) => (
              <Stack
                direction={"row"}
                key={arbiter}
                gap={1}
                justifyContent={"space-between"}
                alignItems="center"
              >
                <Chip
                  label={
                    <Typography color="white" variant="subtitle1">
                      {arbiterStatuses
                        ? Number(arbiterStatuses[index]!.streetCredit)
                        : "-"}
                    </Typography>
                  }
                  sx={{
                    backgroundColor: calculateColorFromStreetCredit(
                      arbiterStatuses?.[index]!.streetCredit,
                    ),
                  }}
                />
                <Typography variant="subtitle2">
                  {getAddressOrEnsName(arbiter, ensNames?.at(2 + index), false)}
                </Typography>
                {/* TODO: show attended/settled status */}
                {arbiterStatuses && (
                  <Typography>
                    {step < 4
                      ? arbiterStatuses[index]!.hasAttended
                        ? "✅"
                        : "⌛"
                      : arbiterStatuses[index]!.hasSettled === 1n
                        ? "👍🏽"
                        : arbiterStatuses[index]!.hasSettled === 2n
                          ? "👎🏽"
                          : "⌛"}
                  </Typography>
                )}
              </Stack>
            ))}
          </Stack>
          <BeefControls
            {...{
              id: id as Address,
              beef,
              isUserArbiter,
              isUserChallenger,
              isUserOwner,
              refetch,
            }}
          />
        </Stack>
      </Paper>
    </Container>
  );
};

export default BeefDetailPage;
