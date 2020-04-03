const { override } = require("customize-cra");
const { addReactRefresh } = require("customize-cra-react-refresh");
// const { alias } = require("react-app-rewire-alias");
const DynamicCdnWebpackPlugin = require("dynamic-cdn-webpack-plugin");
const WriteJsonPlugin = require("write-json-webpack-plugin");
const webpack = require("webpack");
const merge = require("webpack-merge");
const gltfFiles = require("./scripts/gltfFiles");
const sceneFiles = require("./scripts/sceneFiles");

module.exports = {
  jest: config => {
    config.testEnvironment = "jest-environment-jsdom-sixteen";
    config.testEnvironmentOptions = { resources: "usable" };
    return config;
  },
  webpack: override(config => {
    const refresh = addReactRefresh({ disableRefreshCheck: true })(config);

    // alias({
    //   playcanvas: "../../playcanvas/engine",
    // })(config);

    return merge(refresh, {
      // externals: {
      //   playcanvas: "playcanvas",
      // },
      plugins: [
        new webpack.DefinePlugin({
          GLTF_FILES: JSON.stringify(gltfFiles),
          SCENE_FILES: JSON.stringify(sceneFiles),
          "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV),
        }),
        new DynamicCdnWebpackPlugin(),
        new WriteJsonPlugin({
          object: gltfFiles,
          path: "assets",
          filename: "index.json",
          pretty: true,
        }),
      ],
    });
  }),
};
