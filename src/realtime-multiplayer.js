import { auth } from './auth.js';
import { REALTIME_CONFIG } from './realtime/config.js';
import { createRealtimeTransport } from './realtime/transport.js';
import { mountRoomInterface } from './realtime/controller.js';

export function mountMultiplayer(container, { navigate, path = '/multiplayer', search = '', transportFactory, client = auth, config = REALTIME_CONFIG } = {}) {
  if (!document.getElementById('axiom-realtime-css')) {
    const sheet = document.createElement('link'); sheet.id = 'axiom-realtime-css'; sheet.rel = 'stylesheet'; sheet.href = new URL('./realtime/styles.css', import.meta.url).href; document.head.append(sheet);
  }
  return mountRoomInterface(container, { navigate, path, search, client, transportFactory: transportFactory || (() => createRealtimeTransport({ client, config })) });
}
