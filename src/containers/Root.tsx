import React, { useState } from "react";
import clsx from "clsx";
import CssBaseline from "@material-ui/core/CssBaseline";
import { ThemeProvider, makeStyles } from "@material-ui/core/styles";
import { theme as customTheme } from "../theme";
import { Sidebar } from "../components/Sidebar";
import { FpsMonitor } from "../components/FpsMonitor";
import { RootStoreProvider } from "../stores";
import { Viewer } from "./Viewer";
import { SidebarToggle } from "../components/SidebarToggle";

const urlParams = new URLSearchParams(window.location.search);
const showUI = !urlParams.get("hideUI");

const sidebarWidth = 300;
const useStyles = makeStyles(theme => ({
  "@global": {
    html: {
      height: "100%",
    },
    body: {
      height: "100%",
      margin: "0",
      overflow: "hidden",
    },
    "#root": {
      height: "100%",
    },
  },
  root: {
    display: "flex",
    height: "100%",
  },
  viewport: {
    position: "relative",
    flexGrow: 1,
    height: "100%",
    backgroundColor: theme.palette.background.default,
    transition: theme.transitions.create("margin", {
      easing: theme.transitions.easing.easeOut,
      duration: theme.transitions.duration.enteringScreen,
    }),
  },
  viewportFullscreen: {
    marginRight: -sidebarWidth,
    transition: theme.transitions.create("margin", {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.leavingScreen,
    }),
  },
}));

const RootLayout: React.FC = () => {
  const classes = useStyles();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  return (
    <div className={classes.root}>
      <CssBaseline />
      <main
        className={clsx(classes.viewport, {
          [classes.viewportFullscreen]: !isSidebarOpen,
        })}
      >
        <Viewer />
        {showUI && (
          <SidebarToggle isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
        )}
      </main>
      {showUI && (
        <Sidebar
          width={sidebarWidth}
          isOpen={isSidebarOpen}
          setIsOpen={setIsSidebarOpen}
        />
      )}
      {showUI && <FpsMonitor bottom="8px" left="8px" />}
    </div>
  );
};

export const Root: React.FC = () => {
  return (
    <RootStoreProvider>
      <ThemeProvider theme={customTheme}>
        <RootLayout />
      </ThemeProvider>
    </RootStoreProvider>
  );
};
