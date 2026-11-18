const { withGradleProperties } = require('@expo/config-plugins');

/**
 * Adds android.buildFeatures.buildConfig=true to gradle.properties.
 * Required for react-native-maps compatibility with Android Gradle Plugin 9.x.
 */
module.exports = function withBuildConfig(config) {
  return withGradleProperties(config, (config) => {
    // Remove existing entry if present to avoid duplicates
    config.modResults = config.modResults.filter(
      (item) => !(item.type === 'property' && item.key === 'android.buildFeatures.buildConfig')
    );
    config.modResults.push({
      type: 'property',
      key: 'android.buildFeatures.buildConfig',
      value: 'true',
    });
    return config;
  });
};
