import React, { useState, useEffect } from "react";
import { makeStyles } from "@material-ui/core/styles";
import { CircularProgress } from "@material-ui/core";
import { observer } from "mobx-react-lite";
import {
  GltfContent,
  SidebarContainer,
  VariantSet as VariantSetComponent,
  NavList,
  NavListItem,
  ErrorMessage,
} from "../components";
import { useStores } from "../stores";
import { VariantSet } from "../variants";

const useStyles = makeStyles(theme => ({
  loading: {
    paddingTop: theme.spacing(8),
    textAlign: "center",
  },
  content: {
    padding: theme.spacing(2, 3),
  },
}));

export type GltfProps = {
  isLoading?: boolean;
  isError?: boolean;
};

export const Gltf: React.FC<GltfProps> = observer(({ isLoading, isError }) => {
  const classes = useStyles();
  const { gltfStore } = useStores();
  const {
    gltfs,
    gltf: selectedGltf,
    variantSetId: selectedVariantSetId,
    variantSetManager,
    sceneHierarchy,
    showVariantSet,
    setGltf,
  } = gltfStore;
  const [view, setView] = useState<
    "gltf-list" | "gltf-content" | "variant-set" | "none"
  >("gltf-list");
  const [variantSets, setVariantSets] = useState<VariantSet[]>([]);

  const variantSet =
    selectedVariantSetId !== undefined
      ? variantSets[selectedVariantSetId]
      : undefined;

  useEffect(() => {
    if (variantSetManager) {
      setVariantSets(variantSetManager.variantSets);
    }

    return () => {
      setVariantSets([]);
    };
  }, [variantSetManager]);

  useEffect(() => {
    setView(
      selectedGltf
        ? variantSet
          ? "variant-set"
          : "gltf-content"
        : gltfs.length === 0
        ? "none"
        : "gltf-list",
    );
  }, [selectedGltf, variantSet, gltfs]);

  if (isLoading) {
    return (
      <SidebarContainer>
        <div className={classes.loading}>
          <CircularProgress />
        </div>
      </SidebarContainer>
    );
  }

  if (isError) {
    return <SidebarContainer></SidebarContainer>;
  }

  switch (view) {
    case "none":
      return (
        <SidebarContainer>
          <ErrorMessage type="empty" overline="Empty" title="No scenes">
            Drag and drop a glTF file to start.
          </ErrorMessage>
        </SidebarContainer>
      );
    case "gltf-list":
      return (
        <SidebarContainer title="Select scene">
          <div className={classes.content}>
            <NavList>
              {gltfs.map(gltf => (
                <NavListItem
                  key={gltf.filePath}
                  onClick={() => {
                    setGltf(gltf);
                    setView("gltf-content");
                  }}
                  selected={
                    selectedGltf && gltf.filePath === selectedGltf.filePath
                  }
                >
                  {gltf.name}
                </NavListItem>
              ))}
            </NavList>
          </div>
        </SidebarContainer>
      );
    case "gltf-content":
      if (!selectedGltf) {
        return null;
      }
      return (
        <SidebarContainer
          title={selectedGltf?.name}
          onNavigateBack={
            gltfs.length > 1 ? () => setView("gltf-list") : undefined
          }
        >
          {sceneHierarchy ? (
            <GltfContent
              gltf={selectedGltf}
              variantSets={variantSets}
              onVariantSetSelect={showVariantSet}
            />
          ) : (
            <div className={classes.loading}>
              <CircularProgress />
            </div>
          )}
        </SidebarContainer>
      );
    case "variant-set":
      if (selectedVariantSetId === undefined || !variantSetManager) {
        return null;
      }
      return (
        <SidebarContainer
          title={variantSet?.name}
          onNavigateBack={() => showVariantSet(undefined)}
        >
          <div className={classes.content}>
            <VariantSetComponent
              id={selectedVariantSetId}
              manager={variantSetManager}
            />
          </div>
        </SidebarContainer>
      );
  }
});
