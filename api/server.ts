import * as dotenv from 'dotenv';
import { createServer } from '../lib';

dotenv.config();

// Get server type from command line arguments
const serverType = (process.env.SERVER_TYPE as 'shyft' | 'solflare') || 'shyft';
console.log(`Creating ${serverType} MCP`);

function handler(req: Request) {
    return createServer(serverType)(req);
}

export { handler as GET };
export { handler as POST };
export { handler as DELETE };