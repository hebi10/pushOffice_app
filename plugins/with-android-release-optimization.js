const {
  AndroidConfig,
  CodeGenerator,
  withAppBuildGradle,
  withGradleProperties,
  withSettingsGradle,
} = require('@expo/config-plugins');

const R8_VERSION = '9.1.29';

function configureAppBuildGradle(contents) {
  const defaultProguardFile = /^\s*proguardFiles getDefaultProguardFile\("proguard-android(?:-optimize)?\.txt"\), "proguard-rules\.pro"$/m;
  if (!defaultProguardFile.test(contents)) {
    throw new Error('Push Office cannot locate the Expo SDK54 release ProGuard configuration.');
  }

  return contents.replace(defaultProguardFile, (line) =>
    line.replace('proguard-android.txt', 'proguard-android-optimize.txt')
  );
}

function configureSettingsGradle(contents) {
  // The R8 bundled with Expo SDK54's AGP predates the Kotlin 2.4 metadata used by the local assistant.
  const r8Classpath = `  buildscript {
    repositories {
      maven {
        url = uri('https://storage.googleapis.com/r8-releases/raw')
        content { includeVersion('com.android.tools', 'r8', '${R8_VERSION}') }
      }
    }
    dependencies {
      classpath('com.android.tools:r8:${R8_VERSION}')
    }
  }`;

  return CodeGenerator.mergeContents({
    src: contents,
    newSrc: r8Classpath,
    tag: 'push-office-r8',
    anchor: /^pluginManagement\s*\{$/,
    offset: 1,
    comment: '//',
  }).contents;
}

module.exports = function withAndroidReleaseOptimization(config) {
  config = withGradleProperties(config, (mod) => {
    const { updateAndroidBuildProperty } = AndroidConfig.BuildProperties;
    updateAndroidBuildProperty(mod.modResults, 'android.enableMinifyInReleaseBuilds', 'true');
    updateAndroidBuildProperty(mod.modResults, 'android.enableShrinkResourcesInReleaseBuilds', 'true');
    return mod;
  });
  config = withAppBuildGradle(config, (mod) => {
    mod.modResults.contents = configureAppBuildGradle(mod.modResults.contents);
    return mod;
  });
  return withSettingsGradle(config, (mod) => {
    mod.modResults.contents = configureSettingsGradle(mod.modResults.contents);
    return mod;
  });
};

module.exports.configureAppBuildGradle = configureAppBuildGradle;
module.exports.configureSettingsGradle = configureSettingsGradle;
