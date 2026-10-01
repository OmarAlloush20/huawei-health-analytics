const fs = require('fs');
const path = require('path');

const {
  createRunOncePlugin,
  withAppBuildGradle,
  withDangerousMod,
  withProjectBuildGradle,
} = require('expo/config-plugins');

const pkg = require('../package.json');

const HUAWEI_REPOSITORY = "maven { url 'https://developer.huawei.com/repo/' }";
const AGCONNECT_CLASSPATH = "classpath 'com.huawei.agconnect:agcp:1.9.1.304'";
const AGCONNECT_PLUGIN = "apply plugin: 'com.huawei.agconnect'";
const PRIVATE_CONFIG_PATH = path.join('config', 'huawei', 'agconnect-services.json');

function addLineAfter(contents, anchor, line) {
  if (contents.includes(line)) return contents;
  if (!contents.includes(anchor)) {
    throw new Error(`Huawei config plugin could not find Gradle anchor: ${anchor}`);
  }
  return contents.replace(anchor, `${anchor}\n    ${line}`);
}

function addHuaweiRepositories(contents) {
  if (contents.includes(HUAWEI_REPOSITORY)) return contents;

  let repositoryBlocksSeen = 0;
  const updated = contents.replace(/repositories \{\r?\n/g, (match) => {
    repositoryBlocksSeen += 1;
    if (repositoryBlocksSeen > 2) return match;
    return `${match}    ${HUAWEI_REPOSITORY}\n`;
  });

  if (repositoryBlocksSeen < 2) {
    throw new Error('Huawei config plugin expected buildscript and allprojects repository blocks.');
  }
  return updated;
}

function withHuaweiHealth(config) {
  const projectRoot = config._internal?.projectRoot ?? process.cwd();
  const sourcePath = path.join(projectRoot, PRIVATE_CONFIG_PATH);
  const hasAgConnectConfig = fs.existsSync(sourcePath);

  config = withProjectBuildGradle(config, (gradleConfig) => {
    if (gradleConfig.modResults.language !== 'groovy') {
      throw new Error('Huawei config plugin currently supports Groovy Android Gradle files only.');
    }

    let contents = addHuaweiRepositories(gradleConfig.modResults.contents);
    if (hasAgConnectConfig) {
      contents = addLineAfter(
        contents,
        "classpath('org.jetbrains.kotlin:kotlin-gradle-plugin')",
        AGCONNECT_CLASSPATH,
      );
    }
    gradleConfig.modResults.contents = contents;
    return gradleConfig;
  });

  config = withAppBuildGradle(config, (gradleConfig) => {
    if (gradleConfig.modResults.language !== 'groovy') {
      throw new Error('Huawei config plugin currently supports Groovy Android Gradle files only.');
    }

    if (hasAgConnectConfig) {
      gradleConfig.modResults.contents = addLineAfter(
        gradleConfig.modResults.contents,
        'apply plugin: "com.facebook.react"',
        AGCONNECT_PLUGIN,
      );
    }
    return gradleConfig;
  });

  return withDangerousMod(config, [
    'android',
    async (dangerousConfig) => {
      const targetPath = path.join(
        dangerousConfig.modRequest.platformProjectRoot,
        'app',
        'agconnect-services.json',
      );

      if (hasAgConnectConfig) {
        fs.copyFileSync(sourcePath, targetPath);
      } else if (fs.existsSync(targetPath)) {
        fs.rmSync(targetPath);
      }

      return dangerousConfig;
    },
  ]);
}

module.exports = createRunOncePlugin(withHuaweiHealth, 'with-huawei-health', pkg.version);
module.exports.PRIVATE_CONFIG_PATH = PRIVATE_CONFIG_PATH;
