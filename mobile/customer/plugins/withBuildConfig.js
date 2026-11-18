const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Patches react-native-maps/android/build.gradle to add:
 *   buildFeatures { buildConfig = true }
 * Required for Android Gradle Plugin 9.x compatibility.
 */
module.exports = function withBuildConfig(config) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const mapsGradle = path.join(
        config.modRequest.projectRoot,
        'node_modules/react-native-maps/android/build.gradle'
      );

      if (!fs.existsSync(mapsGradle)) {
        console.warn('[withBuildConfig] react-native-maps build.gradle not found, skipping patch.');
        return config;
      }

      let contents = fs.readFileSync(mapsGradle, 'utf8');

      // Already patched — skip
      if (contents.includes('buildConfig = true')) {
        return config;
      }

      // Insert buildFeatures block right after the opening `android {`
      contents = contents.replace(
        /android\s*\{/,
        'android {\n    buildFeatures {\n        buildConfig = true\n    }\n'
      );

      fs.writeFileSync(mapsGradle, contents, 'utf8');
      console.log('[withBuildConfig] Patched react-native-maps build.gradle ✓');

      return config;
    },
  ]);
};
