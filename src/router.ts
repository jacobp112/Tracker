import { useEffect, useState } from 'react';

/**
 * Minimal hash router. The app is local-first and served as static files, so a
 * hash route needs no server rewrite rules and survives being opened from disk.
 * Not worth a routing dependency at this size.
 */
export type Route =
  | { name: 'overview' }
  | { name: 'performance' }
  | { name: 'study' }
  | { name: 'add-course' }
  | { name: 'course'; courseId: string }
  | { name: 'exams' }
  | { name: 'add-exam' }
  | { name: 'settings' }
  | { name: 'quick-add' }
  | { name: 'dev-tokens' }
  | { name: 'dev-components' }
  | { name: 'auth'; signup: boolean };

export function parseHash(hash: string): Route {
  const path = hash.replace(/^#\/?/, '');
  const [head, tail] = path.split('/');

  switch (head) {
    case 'course':
      return tail ? { name: 'course', courseId: tail } : { name: 'study' };
    case 'study':
      return tail === 'add' ? { name: 'add-course' } : { name: 'study' };
    case 'exams':
      return tail === 'add' ? { name: 'add-exam' } : { name: 'exams' };
    case 'performance':
      return { name: 'performance' };
    case 'settings':
      return { name: 'settings' };
    case 'add':
      return { name: 'quick-add' };
    case 'dev':
      return tail === 'components' ? { name: 'dev-components' } : { name: 'dev-tokens' };
    case 'auth':
      return { name: 'auth', signup: tail === 'signup' };
    default:
      return { name: 'overview' };
  }
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));

  useEffect(() => {
    const onChange = () => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  return route;
}

export function navigate(to: string): void {
  window.location.hash = to;
}
