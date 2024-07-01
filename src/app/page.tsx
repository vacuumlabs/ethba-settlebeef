"use client"

import { useContext, useState } from "react"
import { Box, Button, Container, Paper, Stack, Tab, Tabs, TextField, Typography } from "@mui/material"
import Link from "next/link"
import { AboutTabContent } from "@/components/AboutTabContent"
import BeefList from "@/components/BeefList"
import { BEEF_SORT_OPTIONS, BeefSortDropdown } from "@/components/BeefSortDropdown"
import { SmartAccountClientContext } from "@/components/providers/SmartAccountClientContext"
import { ShowMyBeefs } from "@/components/ShowMyBeefs"
import { useGetInfiniteBeefs } from "@/hooks/queries"
import { useDebounce } from "@/hooks/useDebounce"

interface TabPanelProps {
  children?: React.ReactNode
  index: number
  value: number
}

function CustomTabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  )
}

function a11yProps(index: number) {
  return {
    id: `simple-tab-${index}`,
    "aria-controls": `simple-tabpanel-${index}`,
  }
}

const PAGE_SIZE = 10

export default function Home() {
  const { connectedAddress } = useContext(SmartAccountClientContext)

  const [searchTitleFilter, setSearchTitleFilter] = useState<string | undefined>()

  const debouncedSearchTitle = useDebounce(searchTitleFilter)

  const [sortOption, setSortOption] = useState(BEEF_SORT_OPTIONS[0]!)
  const {
    data: beefPages,
    isLoading: isLoadingBeefs,
    fetchNextPage,
    hasNextPage,
  } = useGetInfiniteBeefs(PAGE_SIZE, sortOption.sort, debouncedSearchTitle)

  const [tabIndex, setTabIndex] = useState(0)

  const beefsListData = beefPages?.pages.flat() ?? []

  const handleChangeTabIndex = (_: React.SyntheticEvent, newValue: number) => {
    setTabIndex(newValue)
  }

  return (
    <Container>
      <></>
      <Tabs value={tabIndex} onChange={handleChangeTabIndex} aria-label="Beef tabs" centered>
        <Tab
          label={
            <Typography variant="h5" px={2}>
              Beef List 🥩📝
            </Typography>
          }
          {...a11yProps(0)}
        />
        <Tab
          label={
            <Typography variant="h5" px={2}>
              My beef List 🥩📝
            </Typography>
          }
          {...a11yProps(1)}
        />
        <Tab
          label={
            <Typography variant="h5" px={2}>
              How to Beef 🥩📝
            </Typography>
          }
          {...a11yProps(1)}
        />
      </Tabs>
      <CustomTabPanel value={tabIndex} index={0}>
        <Paper elevation={2} sx={{ mb: 5 }}>
          <Stack p={4} gap={2}>
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="h3">Beef List 🥩📝</Typography>
              <Stack direction="row" gap={2} alignItems="center">
                <TextField
                  label="Search beefs"
                  value={searchTitleFilter}
                  onChange={(event) => setSearchTitleFilter(event.target.value)}
                />
                <BeefSortDropdown sortOption={sortOption} setSortOption={setSortOption} />
                <Link href="/beef/new" style={{ textDecoration: "none" }}>
                  <Button variant="contained" color="secondary">
                    Start beef
                  </Button>
                </Link>
              </Stack>
            </Stack>
            {isLoadingBeefs || beefPages === undefined ? (
              "Loading beef list"
            ) : beefsListData.length === 0 ? (
              "No beef!"
            ) : (
              <BeefList beefs={beefsListData} />
            )}
            <Button disabled={!hasNextPage} onClick={() => void fetchNextPage()}>
              More beef
            </Button>
          </Stack>
        </Paper>
      </CustomTabPanel>
      <CustomTabPanel value={tabIndex} index={1}>
        {/* My beefs */}
        {connectedAddress && (
          <ShowMyBeefs beefs={beefsListData} isLoadingBeefs={isLoadingBeefs} connectedAddress={connectedAddress} />
        )}
      </CustomTabPanel>
      <CustomTabPanel value={tabIndex} index={2}>
        {/* How to / About */}
        {<AboutTabContent />}
      </CustomTabPanel>
    </Container>
  )
}
