import { createShyftMcp } from './shyft';
import { createSolflareMcp } from './solflare';

export type ServerType = 'shyft' | 'solflare';

export function createServer(type: ServerType) {
    switch (type) {
        case 'shyft':
            return createShyftMcp();
        case 'solflare':
            return createSolflareMcp();
        default:
            throw new Error(`Unknown server type: ${type}`);
    }
} 