import { App } from './App.tsx';
import { NETWORK } from './data/network.ts';

export function Root() {
  return <App network={NETWORK} />;
}
