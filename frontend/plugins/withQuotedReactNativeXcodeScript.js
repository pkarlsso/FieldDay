const { withXcodeProject } = require('@expo/config-plugins');

// React Native's generated iOS bundle phase executes the script path using
// backticks. A parent directory such as "ECE 49595" is then split by the
// shell. Execute the computed path as one quoted value instead.
module.exports = function withQuotedReactNativeXcodeScript(config) {
  return withXcodeProject(config, (projectConfig) => {
    const objects = projectConfig.modResults.hash.project.objects.PBXShellScriptBuildPhase || {};
    for (const phase of Object.values(objects)) {
      if (!phase || typeof phase !== 'object' || !String(phase.name).includes('Bundle React Native')) continue;
      if (typeof phase.shellScript === 'string' && phase.shellScript.includes('react-native-xcode.sh')) {
        const lines = phase.shellScript.split('\\n');
        const scriptLine = lines.findIndex((line) => line.includes('react-native-xcode.sh'));
        if (scriptLine !== -1 && lines[scriptLine].startsWith('`') && lines[scriptLine].endsWith('`')) {
          const command = lines[scriptLine].slice(1, -1);
          lines.splice(scriptLine, 1, 'RN_XCODE_SCRIPT=\\"$(' + command + ')\\"', '\\"$RN_XCODE_SCRIPT\\"');
          phase.shellScript = lines.join('\\n');
        }
      }
    }
    return projectConfig;
  });
};
