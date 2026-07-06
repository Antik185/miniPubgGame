const fs = require('fs');

const buffer = fs.readFileSync(process.argv[2]);
if (buffer.toString('utf8', 0, 4) !== 'glTF') throw new Error('Not a binary glTF');
const jsonLength = buffer.readUInt32LE(12);
const json = JSON.parse(buffer.toString('utf8', 20, 20 + jsonLength).replace(/\0+$/, ''));
const nodes = (json.nodes || []).map(node => node.name).filter(Boolean);
const skins = (json.skins || []).map(skin => ({ name: skin.name, joints: skin.joints?.length }));
const hierarchy = (json.nodes || []).map((node, index) => ({
  index,
  name: node.name,
  translation: node.translation,
  children: node.children,
})).filter(node => node.name?.startsWith('Man_') || node.name?.includes('Bip'));
console.log(JSON.stringify({
  nodes: nodes.slice(0, 240),
  skins,
  hierarchy,
  skinJoints: (json.skins || []).map(skin => (skin.joints || []).map(index => json.nodes[index]?.name)),
  animations: (json.animations || []).map(animation => animation.name),
  materials: (json.materials || []).map(material => material.name),
  images: (json.images || []).map(image => image.name || image.uri || image.mimeType),
}, null, 2));
