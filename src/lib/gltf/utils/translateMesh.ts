/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-explicit-any */
import pc from "playcanvas";
import createDebug from "debug";
import { Mesh, Accessor } from "../types";
import { GlTfParser } from "../GlTfParser";
import { getAccessorData } from "./getAccessorData";
import { getPrimitiveType } from "./getPrimitiveType";

// TODO: Fix these when they have proper types
const pcMorphTarget = (pc as any).MorphTarget;
const pcMorph = (pc as any).Morph;

const pcMesh = pc.Mesh;
type pcMesh = pc.Mesh & {
  materialIndex?: number;
  morph?: typeof pcMorph;
};

const debug = createDebug("translateMesh");

const calculateIndices = (numVertices: number) => {
  const dummyIndices = new Uint16Array(numVertices);
  for (let i = 0; i < numVertices; i += 1) {
    dummyIndices[i] = i;
  }
  return dummyIndices;
};

// Specification:
//   https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#mesh
export function translateMesh(data: Mesh, resources: GlTfParser) {
  const { gltf } = resources;
  const meshes: pcMesh[] = [];

  const gltfAccessors = gltf.accessors!;
  const gltfBufferViews = gltf.bufferViews!;

  if (!gltfAccessors || !gltfBufferViews) {
    console.warn("Missing accessors and/or buffer views");
    return;
  }

  // const isQuantized =
  //   gltf.extensionsRequired?.includes("KHR_mesh_quantization") ?? false;

  data.primitives.forEach(primitive => {
    const { attributes } = primitive;

    let positions = null;
    let normals = null;
    let tangents = null;
    let texCoord0 = null;
    let texCoord1 = null;
    let colors = null;
    let joints = null;
    let weights = null;
    let indices = null;

    debug("primitive extensions", primitive.extensions);

    // Start by looking for compressed vertex data for this primitive
    if (primitive.extensions) {
      const extensions = primitive.extensions;
      const extDraco = extensions["KHR_draco_mesh_compression"];
      if (extDraco) {
        const bufferView = gltfBufferViews[extDraco.bufferView];
        const arrayBuffer = resources.buffers[bufferView.buffer];
        const byteOffset = bufferView["byteOffset"] ? bufferView.byteOffset : 0;
        const uint8Buffer = new Int8Array(
          arrayBuffer,
          byteOffset,
          bufferView.byteLength,
        );

        const decoderModule = resources.decoderModule;
        const buffer = new decoderModule.DecoderBuffer();
        buffer.Init(uint8Buffer, uint8Buffer.length);

        const decoder = new decoderModule.Decoder();
        const geometryType = decoder.GetEncodedGeometryType(buffer);

        let outputGeometry: any;
        let status: any;

        switch (geometryType) {
          case decoderModule.INVALID_GEOMETRY_TYPE:
            console.error("Invalid geometry type");
            break;
          case decoderModule.POINT_CLOUD:
            outputGeometry = new decoderModule.PointCloud();
            status = decoder.DecodeBufferToPointCloud(buffer, outputGeometry);
            break;
          case decoderModule.TRIANGULAR_MESH:
            outputGeometry = new decoderModule.Mesh();
            status = decoder.DecodeBufferToMesh(buffer, outputGeometry);
            break;
        }

        debug("draco status", status.ok());

        if (!status.ok() || outputGeometry.ptr === 0) {
          const errorMsg = status.error_msg();
          console.error(errorMsg);
        }

        const numPoints = outputGeometry.num_points();
        const numFaces = outputGeometry.num_faces();

        if (extDraco.attributes) {
          const extractAttribute = (uniqueId: string) => {
            const attribute = decoder.GetAttributeByUniqueId(
              outputGeometry,
              uniqueId,
            );

            const attributeData = new decoderModule.DracoFloat32Array();
            decoder.GetAttributeFloatForAllPoints(
              outputGeometry,
              attribute,
              attributeData,
            );

            const numValues = numPoints * attribute.num_components();
            const values = new Float32Array(numValues);

            for (let i = 0; i < numValues; i += 1) {
              values[i] = attributeData.GetValue(i);
            }

            decoderModule.destroy(attributeData);
            return values;
          };

          const dracoAttribs = extDraco.attributes;
          if (typeof dracoAttribs.POSITION !== "undefined") {
            positions = extractAttribute(dracoAttribs.POSITION);
          }

          if (typeof dracoAttribs.NORMAL !== "undefined") {
            normals = extractAttribute(dracoAttribs.NORMAL);
          }

          if (typeof dracoAttribs.TANGENT !== "undefined") {
            tangents = extractAttribute(dracoAttribs.TANGENT);
          }

          if (typeof dracoAttribs.TEXCOORD_0 !== "undefined") {
            texCoord0 = extractAttribute(dracoAttribs.TEXCOORD_0);
          }

          if (typeof dracoAttribs.TEXCOORD_1 !== "undefined") {
            texCoord1 = extractAttribute(dracoAttribs.TEXCOORD_1);
          }

          if (typeof dracoAttribs.COLOR_0 !== "undefined") {
            colors = extractAttribute(dracoAttribs.COLOR_0);
          }

          if (typeof dracoAttribs.JOINTS_0 !== "undefined") {
            joints = extractAttribute(dracoAttribs.JOINTS_0);
          }

          if (typeof dracoAttribs.WEIGHTS_0 !== "undefined") {
            weights = extractAttribute(dracoAttribs.WEIGHTS_0);
          }
        }

        if (geometryType === decoderModule.TRIANGULAR_MESH) {
          const face = new decoderModule.DracoInt32Array();
          indices =
            numPoints > 65535
              ? new Uint32Array(numFaces * 3)
              : new Uint16Array(numFaces * 3);
          for (let i = 0; i < numFaces; i += 1) {
            decoder.GetFaceFromMesh(outputGeometry, i, face);
            indices[i * 3] = face.GetValue(0);
            indices[i * 3 + 1] = face.GetValue(1);
            indices[i * 3 + 2] = face.GetValue(2);
          }
          decoderModule.destroy(face);
        }

        decoderModule.destroy(outputGeometry);
        decoderModule.destroy(decoder);
        decoderModule.destroy(buffer);
      }
    }

    // Grab typed arrays for all vertex data
    let accessor: Accessor;
    if (typeof attributes.POSITION !== "undefined" && positions === null) {
      accessor = gltfAccessors[primitive.attributes.POSITION];
      positions = getAccessorData(gltf, accessor, resources.buffers);
    }

    if (typeof attributes.NORMAL !== "undefined" && normals === null) {
      accessor = gltfAccessors[primitive.attributes.NORMAL];
      normals = getAccessorData(gltf, accessor, resources.buffers);
    }

    if (typeof attributes.TANGENT !== "undefined" && tangents === null) {
      accessor = gltfAccessors[primitive.attributes.TANGENT];
      tangents = getAccessorData(gltf, accessor, resources.buffers);
    }

    if (typeof attributes.TEXCOORD_0 !== "undefined" && texCoord0 === null) {
      accessor = gltfAccessors[primitive.attributes.TEXCOORD_0];
      texCoord0 = getAccessorData(gltf, accessor, resources.buffers);
    }

    if (typeof attributes.TEXCOORD_1 !== "undefined" && texCoord1 === null) {
      accessor = gltfAccessors[primitive.attributes.TEXCOORD_1];
      texCoord1 = getAccessorData(gltf, accessor, resources.buffers);
    }

    if (typeof attributes.COLOR_0 !== "undefined" && colors === null) {
      accessor = gltfAccessors[primitive.attributes.COLOR_0];
      colors = getAccessorData(gltf, accessor, resources.buffers);
    }

    if (typeof attributes.JOINTS_0 !== "undefined" && joints === null) {
      accessor = gltfAccessors[primitive.attributes.JOINTS_0];
      joints = getAccessorData(gltf, accessor, resources.buffers);
    }

    if (typeof attributes.WEIGHTS_0 !== "undefined" && weights === null) {
      accessor = gltfAccessors[primitive.attributes.WEIGHTS_0];
      weights = getAccessorData(gltf, accessor, resources.buffers);
    }

    if (typeof primitive.indices !== "undefined" && indices === null) {
      accessor = gltfAccessors[primitive.indices];
      indices = getAccessorData(gltf, accessor, resources.buffers);
    }

    const numVertices = positions ? positions.length / 3 : 0;

    if (positions !== null && normals === null) {
      // pc.calculateNormals needs indices so generate some if none are present
      normals = pc.calculateNormals(
        positions as any,
        (indices === null ? calculateIndices(numVertices) : indices) as any,
      );
    }

    const vertexDesc = [];
    if (positions !== null) {
      vertexDesc.push({
        semantic: pc.SEMANTIC_POSITION,
        components: 3,
        type: pc.TYPE_FLOAT32,
      });
    }

    if (normals !== null) {
      vertexDesc.push({
        semantic: pc.SEMANTIC_NORMAL,
        components: 3,
        type: pc.TYPE_FLOAT32,
      });
    }

    if (tangents !== null) {
      vertexDesc.push({
        semantic: pc.SEMANTIC_TANGENT,
        components: 4,
        type: pc.TYPE_FLOAT32,
      });
    }

    if (texCoord0 !== null) {
      vertexDesc.push({
        semantic: pc.SEMANTIC_TEXCOORD0,
        components: 2,
        type: pc.TYPE_FLOAT32,
      });
    }

    if (texCoord1 !== null) {
      vertexDesc.push({
        semantic: pc.SEMANTIC_TEXCOORD1,
        components: 2,
        type: pc.TYPE_FLOAT32,
      });
    }

    if (colors !== null) {
      vertexDesc.push({
        semantic: pc.SEMANTIC_COLOR,
        components: 4,
        type: pc.TYPE_UINT8,
        normalize: true,
      });
    }

    if (joints !== null) {
      vertexDesc.push({
        semantic: pc.SEMANTIC_BLENDINDICES,
        components: 4,
        type: pc.TYPE_UINT8,
      });
    }

    if (weights !== null) {
      vertexDesc.push({
        semantic: pc.SEMANTIC_BLENDWEIGHT,
        components: 4,
        type: pc.TYPE_FLOAT32,
      });
    }

    const vertexFormat = new pc.VertexFormat(resources.device, vertexDesc);
    const vertexBuffer = new pc.VertexBuffer(
      resources.device,
      vertexFormat,
      numVertices,
      pc.BUFFER_STATIC,
    );
    const vertexData = vertexBuffer.lock();

    const vertexDataF32 = new Float32Array(vertexData);
    const vertexDataU8 = new Uint8Array(vertexData);

    const getAttribute = (semantic: string) => {
      const elements = (vertexFormat as any).elements;
      for (let i = 0; i < elements.length; i += 1) {
        if (elements[i].name === semantic) {
          return elements[i];
        }
      }
      return null;
    };

    let dstIndex, srcIndex;
    let attr, dstOffset, dstStride;

    if (positions !== null) {
      attr = getAttribute(pc.SEMANTIC_POSITION);
      dstOffset = attr.offset / 4;
      dstStride = attr.stride / 4;

      for (let i = 0; i < numVertices; i += 1) {
        dstIndex = dstOffset + i * dstStride;
        srcIndex = i * 3;
        vertexDataF32[dstIndex] = positions[srcIndex];
        vertexDataF32[dstIndex + 1] = positions[srcIndex + 1];
        vertexDataF32[dstIndex + 2] = positions[srcIndex + 2];
      }
    }

    if (normals !== null) {
      attr = getAttribute(pc.SEMANTIC_NORMAL);
      dstOffset = attr.offset / 4;
      dstStride = attr.stride / 4;

      for (let i = 0; i < numVertices; i += 1) {
        dstIndex = dstOffset + i * dstStride;
        srcIndex = i * 3;
        vertexDataF32[dstIndex] = normals[srcIndex];
        vertexDataF32[dstIndex + 1] = normals[srcIndex + 1];
        vertexDataF32[dstIndex + 2] = normals[srcIndex + 2];
      }
    }

    if (tangents !== null) {
      attr = getAttribute(pc.SEMANTIC_TANGENT);
      dstOffset = attr.offset / 4;
      dstStride = attr.stride / 4;

      for (let i = 0; i < numVertices; i += 1) {
        dstIndex = dstOffset + i * dstStride;
        srcIndex = i * 4;
        vertexDataF32[dstIndex] = tangents[srcIndex];
        vertexDataF32[dstIndex + 1] = tangents[srcIndex + 1];
        vertexDataF32[dstIndex + 2] = tangents[srcIndex + 2];
        vertexDataF32[dstIndex + 3] = tangents[srcIndex + 3];
      }
    }

    if (texCoord0 !== null) {
      attr = getAttribute(pc.SEMANTIC_TEXCOORD0);
      dstOffset = attr.offset / 4;
      dstStride = attr.stride / 4;

      for (let i = 0; i < numVertices; i += 1) {
        dstIndex = dstOffset + i * dstStride;
        srcIndex = i * 2;
        vertexDataF32[dstIndex] = texCoord0[srcIndex];
        vertexDataF32[dstIndex + 1] = texCoord0[srcIndex + 1];
      }
    }

    if (texCoord1 !== null) {
      attr = getAttribute(pc.SEMANTIC_TEXCOORD1);
      dstOffset = attr.offset / 4;
      dstStride = attr.stride / 4;

      for (let i = 0; i < numVertices; i += 1) {
        dstIndex = dstOffset + i * dstStride;
        srcIndex = i * 2;
        vertexDataF32[dstIndex] = texCoord1[srcIndex];
        vertexDataF32[dstIndex + 1] = texCoord1[srcIndex + 1];
      }
    }

    if (colors !== null) {
      attr = getAttribute(pc.SEMANTIC_COLOR);
      dstOffset = attr.offset;
      dstStride = attr.stride;

      accessor = gltfAccessors[primitive.attributes.COLOR_0];

      for (let i = 0; i < numVertices; i += 1) {
        dstIndex = dstOffset + i * dstStride;
        srcIndex = accessor.type === "VEC4" ? i * 4 : i * 3;
        const r = colors[srcIndex];
        const g = colors[srcIndex + 1];
        const b = colors[srcIndex + 2];
        const a = colors[srcIndex + 3];
        vertexDataU8[dstIndex] = Math.round(pc.math.clamp(r, 0, 1) * 255);
        vertexDataU8[dstIndex + 1] = Math.round(pc.math.clamp(g, 0, 1) * 255);
        vertexDataU8[dstIndex + 2] = Math.round(pc.math.clamp(b, 0, 1) * 255);
        vertexDataU8[dstIndex + 3] =
          accessor.type === "VEC4"
            ? Math.round(pc.math.clamp(a, 0, 1) * 255)
            : 255;
      }
    }

    if (joints !== null) {
      attr = getAttribute(pc.SEMANTIC_BLENDINDICES);
      dstOffset = attr.offset;
      dstStride = attr.stride;

      for (let i = 0; i < numVertices; i += 1) {
        dstIndex = dstOffset + i * dstStride;
        srcIndex = i * 4;
        vertexDataU8[dstIndex] = joints[srcIndex];
        vertexDataU8[dstIndex + 1] = joints[srcIndex + 1];
        vertexDataU8[dstIndex + 2] = joints[srcIndex + 2];
        vertexDataU8[dstIndex + 3] = joints[srcIndex + 3];
      }
    }

    if (weights !== null) {
      attr = getAttribute(pc.SEMANTIC_BLENDWEIGHT);
      dstOffset = attr.offset / 4;
      dstStride = attr.stride / 4;

      for (let i = 0; i < numVertices; i += 1) {
        dstIndex = dstOffset + i * dstStride;
        srcIndex = i * 4;
        vertexDataF32[dstIndex] = weights[srcIndex];
        vertexDataF32[dstIndex + 1] = weights[srcIndex + 1];
        vertexDataF32[dstIndex + 2] = weights[srcIndex + 2];
        vertexDataF32[dstIndex + 3] = weights[srcIndex + 3];
      }
    }

    vertexBuffer.unlock();

    const mesh = new pc.Mesh() as pcMesh;
    mesh.vertexBuffer = vertexBuffer;

    // TODO: Improve typing
    const firstPrimitive: any = mesh.primitive[0];
    firstPrimitive.type = getPrimitiveType(primitive);
    firstPrimitive.base = 0;
    firstPrimitive.indexed = indices !== null;

    if (indices !== null) {
      let indexFormat;
      if (indices instanceof Uint8Array) {
        indexFormat = pc.INDEXFORMAT_UINT8;
      } else if (indices instanceof Uint16Array) {
        indexFormat = pc.INDEXFORMAT_UINT16;
      } else {
        indexFormat = pc.INDEXFORMAT_UINT32;
      }
      const numIndices = indices.length;
      const indexBuffer = new pc.IndexBuffer(
        resources.device,
        indexFormat,
        numIndices,
        pc.BUFFER_STATIC,
        indices,
      );
      mesh.indexBuffer[0] = indexBuffer;
      firstPrimitive.count = indices.length;
    } else {
      firstPrimitive.count = numVertices;
    }

    mesh.materialIndex = primitive.material;

    accessor = gltfAccessors[primitive.attributes.POSITION];
    const min = accessor.min ?? [0, 0, 0];
    const max = accessor.max ?? [0, 0, 0];
    const aabb = new pc.BoundingBox(
      new pc.Vec3(
        (max[0] + min[0]) / 2,
        (max[1] + min[1]) / 2,
        (max[2] + min[2]) / 2,
      ),
      new pc.Vec3(
        (max[0] - min[0]) / 2,
        (max[1] - min[1]) / 2,
        (max[2] - min[2]) / 2,
      ),
    );
    mesh.aabb = aabb;

    if (primitive.targets) {
      const targets = primitive.targets.map(
        target =>
          new pcMorphTarget({
            deltaPositions: target.POSITION
              ? getAccessorData(
                  gltf,
                  gltfAccessors[target.POSITION],
                  resources.buffers,
                )
              : null,
            deltaNormals: target.NORMAL
              ? getAccessorData(
                  gltf,
                  gltfAccessors[target.NORMAL],
                  resources.buffers,
                )
              : null,
            deltaTangents: target.TANGENT
              ? getAccessorData(
                  gltf,
                  gltfAccessors[target.TANGENT],
                  resources.buffers,
                )
              : null,
          }),
      );
      mesh.morph = new pcMorph(targets);
    }

    meshes.push(mesh);
  });

  return meshes;
}
