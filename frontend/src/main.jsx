import React from 'react';
import { createRoot } from 'react-dom/client';
import { Auth0Provider } from '@auth0/auth0-react';
import App from './App.jsx';
import './styles.css';

export const authConfig = {
  domain: import.meta.env.VITE_AUTH0_DOMAIN || 'dev-igd77oddewxpkhl0.us.auth0.com',
  clientId: import.meta.env.VITE_AUTH0_CLIENT_ID || 'DT5QIElpIs9Au5OeogD0sq9GvxgkBVEq',
  audience: import.meta.env.VITE_AUTH0_AUDIENCE || 'https://simulado-arqobj-api',
};

createRoot(document.getElementById('root')).render(
  <Auth0Provider
    domain={authConfig.domain}
    clientId={authConfig.clientId}
    authorizationParams={{
      audience: authConfig.audience,
      redirect_uri: window.location.origin,
      scope: 'openid profile email',
    }}
    onRedirectCallback={() => window.history.replaceState({}, document.title, '/')}
  >
    <App />
  </Auth0Provider>,
);
