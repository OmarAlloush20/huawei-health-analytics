const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const rootGradlePath = path.join(projectRoot, 'android', 'build.gradle');
const appGradlePath = path.join(projectRoot, 'android', 'app', 'build.gradle');
const privateConfigPath = path.join(
  projectRoot,
  'config',
  'huawei',
  'agconnect-services.json',
);
const generatedConfigPath = path.join(projectRoot, 'android', 'app', 'agconnect-services.json');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const rootGradle = fs.readFileSync(rootGradlePath, 'utf8');
const appGradle = fs.readFileSync(appGradlePath, 'utf8');
const repositoryMatches = rootGradle.match(/https:\/\/developer\.huawei\.com\/repo\//g) ?? [];
const hasPrivateConfig = fs.existsSync(privateConfigPath);

assert(repositoryMatches.length === 2, 'Expected Huawei Maven in both root repository blocks.');

if (hasPrivateConfig) {
  assert(rootGradle.includes('com.huawei.agconnect:agcp:1.9.1.304'), 'AGConnect classpath missing.');
  assert(appGradle.includes("apply plugin: 'com.huawei.agconnect'"), 'AGConnect app plugin missing.');
  assert(fs.existsSync(generatedConfigPath), 'AGConnect config was not copied to android/app.');
} else {
  assert(!rootGradle.includes('com.huawei.agconnect:agcp:'), 'AGConnect classpath must stay disabled without config.');
  assert(!appGradle.includes("apply plugin: 'com.huawei.agconnect'"), 'AGConnect plugin must stay disabled without config.');
  assert(!fs.existsSync(generatedConfigPath), 'Generated AGConnect config must be absent without private source.');
}

console.log(
  `Huawei Prebuild verification passed (${hasPrivateConfig ? 'AGConnect enabled' : 'safe unconfigured mode'}).`,
);
