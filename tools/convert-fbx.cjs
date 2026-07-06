const fs = require('fs');
const path = require('path');

const assimpFactory = require('C:/tmp/pubg-assimp/node_modules/assimpjs');

async function main() {
  const input = process.argv[2];
  const output = process.argv[3];
  if (!input || !output) throw new Error('Usage: node convert-fbx.cjs input.fbx output.glb');

  const assimp = await assimpFactory();
  const files = new assimp.FileList();
  files.AddFile(path.basename(input), fs.readFileSync(input));
  const result = assimp.ConvertFileList(files, 'glb2');
  if (!result.IsSuccess() || result.FileCount() === 0) {
    throw new Error(`Assimp conversion failed: ${result.GetErrorCode()}`);
  }
  const converted = result.GetFile(0);
  fs.writeFileSync(output, Buffer.from(converted.GetContent()));
  console.log(`${converted.GetPath()} -> ${output} (${fs.statSync(output).size} bytes)`);
}

main().catch(error => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
