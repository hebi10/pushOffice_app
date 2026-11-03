const { withGradleProperties, withProjectBuildGradle, withMainActivity } = require('@expo/config-plugins');

const KOTLIN_VERSION = '2.4.0';
const KSP_VERSION = '2.3.10';
const START = '// @generated begin push-office-kotlin';
const END = '// @generated end push-office-kotlin';

function configureGradleProperties(entries) {
  return [
    ...entries.filter((entry) => entry.key !== 'android.minSdkVersion' && entry.key !== 'android.kotlinVersion'),
    { type: 'property', key: 'android.minSdkVersion', value: '26' },
    { type: 'property', key: 'android.kotlinVersion', value: KOTLIN_VERSION },
  ];
}

function configureRootGradle(contents) {
  let source = contents.replace(/\/\/ @generated begin push-office-kotlin[\s\S]*?\/\/ @generated end push-office-kotlin\r?\n?/g, '');
  const kotlinClasspath = /classpath\(\s*(['"])org\.jetbrains\.kotlin:kotlin-gradle-plugin(?::.*?)?\1\s*\)/;
  if (!kotlinClasspath.test(source)) throw new Error('Cannot locate Kotlin Gradle plugin classpath in root build.gradle.');
  // Expo's catalog override alone does not version the root plugin classpath; RN otherwise supplies 2.1.20.
  source = source.replace(kotlinClasspath, `classpath("org.jetbrains.kotlin:kotlin-gradle-plugin:\${project.findProperty('android.kotlinVersion') ?: '${KOTLIN_VERSION}'}")`);
  const expoRoot = /^([ \t]*)apply plugin: ["']expo-root-project["']/m;
  if (!expoRoot.test(source)) throw new Error('Cannot locate expo-root-project in root build.gradle.');
  return source.replace(expoRoot, `${START}\n// Expo SDK54's lookup predates Kotlin 2.4; provide the supported KSP metadata explicitly.\next.kspVersion = '${KSP_VERSION}'\n${END}\n$&`);
}

/** Keep ACTION_VIEW recoverable through Activity recreation before React/JS listeners are ready. */
function configureMainActivity(contents) {
  const source = contents.replace(/  \/\/ @generated begin push-office-intent[\s\S]*?  \/\/ @generated end push-office-intent\r?\n?/g, '');
  if (/fun\s+onNewIntent\s*\(/.test(source)) throw new Error('Push Office found an existing onNewIntent override; merge setIntent before its delegation explicitly.');
  const activity = /class MainActivity\s*:\s*ReactActivity\(\)\s*\{/;
  if (!activity.test(source)) throw new Error('Cannot locate expected MainActivity Kotlin template.');
  return source.replace(activity, `$&
  // @generated begin push-office-intent
  override fun onNewIntent(intent: android.content.Intent) {
    // RN getInitialURL reads Activity.intent; events alone can be lost before the React context exists.
    setIntent(intent)
    super.onNewIntent(intent)
  }
  // @generated end push-office-intent`);
}

/** Persist native API floor and the compiler required by ML Kit GenAI beta5 after every prebuild. */
module.exports = function withLocalAssistant(config) {
  config = withGradleProperties(config, (mod) => {
    mod.modResults = configureGradleProperties(mod.modResults);
    return mod;
  });
  config = withProjectBuildGradle(config, (mod) => {
    if (mod.modResults.language !== 'groovy') throw new Error('Push Office expects Expo SDK54 Groovy build.gradle.');
    mod.modResults.contents = configureRootGradle(mod.modResults.contents);
    return mod;
  });
  return withMainActivity(config, (mod) => {
    if (mod.modResults.language !== 'kt') throw new Error('Push Office expects Expo SDK54 Kotlin MainActivity.');
    mod.modResults.contents = configureMainActivity(mod.modResults.contents);
    return mod;
  });
};
module.exports.configureGradleProperties = configureGradleProperties;
module.exports.configureRootGradle = configureRootGradle;

module.exports.configureMainActivity = configureMainActivity;
