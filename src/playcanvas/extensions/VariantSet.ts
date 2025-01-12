import * as pc from "@animech-public/playcanvas";
import Debug from "debug";
import { hasNoUndefinedValues } from "../../utilities";
import {
  Variant,
  VariantNode,
  VariantNodeProperties,
  LevelVariantSet,
  VariantSet,
} from "../../variants";
import { ExtensionParser } from "./ExtensionParser";
import { ExtensionRegistry } from "./ExtensionRegistry";

const debug = Debug("VariantSet");

type SceneExtensionData = {
  levelVariantSets: number[];
};

type RootData = {
  extensions?: {
    EPIC_level_variant_sets?: {
      levelVariantSets: LevelVariantSetData[];
    };
  };
};

type SceneVariantSetDataMap = {
  scene: pc.Entity;
  data: LevelVariantSetData[];
};

type LevelVariantSetData = {
  name: string;
  variantSets: VariantSetData[];
};

type VariantSetData = {
  name: string;
  variants: {
    name: string;
    active: boolean;
    thumbnail?: number;
    nodes: {
      node: number;
      properties: VariantNodePropertiesData;
    }[];
  }[];
};

type VariantMaterialData = {
  index: number;
  material: number;
};

type VariantNodePropertiesData = {
  visible?: boolean;
  materials?: VariantMaterialData[];
  mesh?: number;
};

export class VariantSetExtensionParser implements ExtensionParser {
  private _variantSets: SceneVariantSetDataMap[] = [];

  public get name() {
    return "EPIC_level_variant_sets";
  }

  public getVariantSetsForScene(
    scene: pc.Entity,
    container: pc.ContainerResource,
  ): LevelVariantSet[] {
    const { textures, nodes: nodeEntities } = container;

    return this._variantSets
      .filter(set => set.scene === scene)
      .reduce<LevelVariantSetData[]>((sets, set) => [...sets, ...set.data], [])
      .map<LevelVariantSet>(({ name, variantSets: sets }) => ({
        name,
        variantSets: sets.map<VariantSet>(set => ({
          ...set,
          variants: set.variants.map<Variant>(
            ({ name, active, thumbnail, nodes }) =>
              new Variant(
                name,
                thumbnail !== undefined
                  ? (textures[thumbnail]?.resource as
                      | pc.Texture
                      | undefined)?.getSource().src
                  : undefined,
                active,
                nodes.map<VariantNode>(({ node, properties }) => ({
                  node: nodeEntities[node],
                  properties: this._parseVariantNodeProperties(
                    properties,
                    container,
                  ),
                })),
              ),
          ),
        })),
      }));
  }

  public register(registry: ExtensionRegistry) {
    registry.scene.add(this.name, {
      postParse: this._scenePostParse.bind(this),
    });
  }

  public unregister(registry: ExtensionRegistry) {
    registry.scene.remove(this.name);
  }

  public postParse() {
    // Ignore
  }

  private _scenePostParse(
    scene: pc.Entity,
    extensionData: SceneExtensionData,
    rootData: RootData,
  ) {
    debug("Parse variant sets", scene, extensionData);

    const levelVariantSets = extensionData.levelVariantSets.map(
      set =>
        rootData.extensions?.EPIC_level_variant_sets?.levelVariantSets[set],
    );

    if (!hasNoUndefinedValues(levelVariantSets)) {
      return;
    }

    debug("Found variant sets", levelVariantSets);

    this._variantSets.push({
      scene,
      data: levelVariantSets,
    });
  }

  private _parseVariantNodeProperties(
    { visible, materials, mesh }: VariantNodePropertiesData,
    container: pc.ContainerResource,
  ): VariantNodeProperties {
    return {
      visible,
      materialMapping: materials?.reduce((result, data) => {
        const material = container.materials[data.material];
        if (material) {
          return {
            ...result,
            [data.index]: material.id,
          };
        } else {
          return result;
        }
      }, {}),
      modelAssetID:
        mesh !== undefined && mesh !== -1
          ? container.models[mesh]?.id
          : mesh === -1
          ? null
          : undefined,
    };
  }
}
