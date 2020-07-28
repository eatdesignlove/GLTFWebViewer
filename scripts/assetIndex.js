const path = require("path");
const glob = require("glob");
const fs = require("fs-extra");

const typeRegex = new RegExp(`/glTF-([a-zA-Z0-9]+)/`);

const assetIndex = glob.sync("./public/assets/**/*.{gltf,glb}").map(fp => {
  const typeMatch = typeRegex.exec(fp);
  const type = ((typeMatch && typeMatch[1]) || "unpacked").toLowerCase();

  const metaFilePath = path.join(path.dirname(fp), "../meta.json");
  let meta = {};
  try {
    meta = fs.readJSONSync(metaFilePath);
  } catch (e) {
    // Ignore
  }

  return {
    filePath: path.relative("./public/", fp).replace(/\\/gi, "/"),
    name: meta.name || path.basename(fp, path.extname(fp)),
    description: type,
    creator: meta.creator,
    creatorUrl: meta.creatorUrl,
  };
});

module.exports = assetIndex;
