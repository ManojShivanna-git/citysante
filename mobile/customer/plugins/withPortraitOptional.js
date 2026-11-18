const { withAndroidManifest } = require('@expo/config-plugins');

/**
 * Marks android.hardware.screen.portrait as optional (required="false").
 * Prevents Google Play from restricting app availability on non-portrait devices.
 */
module.exports = function withPortraitOptional(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;

    // Remove any existing portrait feature declaration
    if (manifest['uses-feature']) {
      manifest['uses-feature'] = manifest['uses-feature'].filter(
        (f) => f.$?.['android:name'] !== 'android.hardware.screen.portrait'
      );
    } else {
      manifest['uses-feature'] = [];
    }

    // Add it back as optional
    manifest['uses-feature'].push({
      $: {
        'android:name': 'android.hardware.screen.portrait',
        'android:required': 'false',
      },
    });

    return config;
  });
};
