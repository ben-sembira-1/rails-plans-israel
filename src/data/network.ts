import raw from './network.json';
import { parseNetwork, type Network } from './schema.ts';

export const NETWORK: Network = parseNetwork(raw);
