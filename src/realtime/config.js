export const REALTIME_CONFIG = Object.freeze({
  enabled: true,
  projectId: 'axiom-accounts-aacd5',
  databaseURL: 'https://axiom-accounts-aacd5-default-rtdb.asia-southeast1.firebasedatabase.app',
  namespace: 'multiplayerV1',
});
export function validateRealtimeConfig(config = REALTIME_CONFIG) {
  if (!config.enabled) throw new Error('Online rooms are getting ready. Every solo game is available in the meantime.');
  if (config.projectId !== REALTIME_CONFIG.projectId || config.namespace !== 'multiplayerV1' || config.databaseURL !== REALTIME_CONFIG.databaseURL) throw new Error('Online rooms are configured for an unsupported database.');
  return config;
}
