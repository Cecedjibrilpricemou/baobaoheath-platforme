const hote = typeof window !== 'undefined' && window.location.hostname
  ? window.location.hostname
  : 'localhost';

export const environment = {
  production: false,
  apiUrl: `http://${hote}:3137/api/v1`,
};
