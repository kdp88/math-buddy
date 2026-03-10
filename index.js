import { registerRootComponent } from 'expo';

import App from './App';

// troika-three-text (used by @react-three/drei Text) calls document.createElement
// in production React Native bundles where document doesn't exist.
if (typeof document === 'undefined') {
  global.document = {
    createElement:    (tag) => {
      const el = { tagName: tag, style: {}, width: 0, height: 0, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false };
      el.getContext = () => new Proxy({ canvas: el }, { get: (t, k) => k in t ? t[k] : () => null });
      return el;
    },
    createElementNS:  ()    => ({ style: {} }),
    querySelector:    ()    => null,
    querySelectorAll: ()    => [],
    getElementById:   ()    => null,
    body: { appendChild: () => {}, removeChild: () => {} },
  };
}

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
