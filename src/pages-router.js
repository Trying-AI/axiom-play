// Used only by the generated static Pages export, never by the localhost app.
export function currentRoute(location = globalThis.location) {
  const route = location.hash.startsWith('#/') ? location.hash.slice(1) : '/';
  const query = route.indexOf('?');
  const pathname = (query < 0 ? route : route.slice(0, query)).replace(/\/$/, '') || '/';
  return { pathname, search: query < 0 ? '' : route.slice(query) };
}

export function routeHref(route) {
  const path = route.startsWith('#/') ? route.slice(1) : route;
  if (!/^\/(?!\/)/.test(path)) throw new Error('Expected an app route starting with one slash.');
  return `#${path}`;
}
