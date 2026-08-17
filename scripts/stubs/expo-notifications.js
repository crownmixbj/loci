/**
 * expo-notifications and expo-device, stubbed for the verification bundles.
 *
 * Both reach for a native module at import time, which does not exist under
 * plain node. The suites assert on source text rather than on runtime behaviour
 * here, so the stub only has to be importable.
 */
module.exports = new Proxy(
  {
    isDevice: false,
    AndroidImportance: { HIGH: 4 },
    setNotificationHandler: () => {},
    setNotificationChannelAsync: async () => {},
    getPermissionsAsync: async () => ({ granted: false, canAskAgain: false }),
    requestPermissionsAsync: async () => ({ granted: false }),
    getExpoPushTokenAsync: async () => ({ data: '' }),
    getLastNotificationResponseAsync: async () => null,
    addNotificationResponseReceivedListener: () => ({ remove: () => {} }),
  },
  { get: (target, key) => (key in target ? target[key] : () => {}) },
);
