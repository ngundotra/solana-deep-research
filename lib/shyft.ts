import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createMcpHandler } from "@vercel/mcp-adapter";
import { z } from "zod";
import axios from "axios";

// Types
interface ShyftPool {
    pubkey: string;
    [key: string]: any;
}

interface DexInfo {
    pools: ShyftPool[];
}

interface ShyftResponse {
    result: {
        dexes: {
            [key: string]: DexInfo;
        };
    };
}

interface LiquidityDetails {
    result: {
        address: string;
        dex: string;
        liquidity: {
            tokenA: any;
            tokenB: any;
        };
    };
}

// Constants and configuration
const SHYFT_API_KEY = process.env.SHYFT_API_KEY;
const SHYFT_URL = "https://defi.shyft.to";

if (!SHYFT_API_KEY) {
    throw new Error("SHYFT_API_KEY not set in environment variables");
}

// Utility functions
const getShyftHeaders = () => ({
    accept: "application/json",
    "x-api-key": SHYFT_API_KEY
});

const shyftGet = async (path: string, params?: Record<string, any>) => {
    try {
        const response = await axios.get(`${SHYFT_URL}${path}`, {
            headers: getShyftHeaders(),
            params
        });
        return response.data;
    } catch (error) {
        if (axios.isAxiosError(error)) {
            console.error(`HTTP error: ${error.message}, status: ${error.response?.status}, response: ${JSON.stringify(error.response?.data).slice(0, 200)}`);
        }
        throw error;
    }
};

export function createShyftMcp() {
    return createMcpHandler(
        async (server: McpServer) => {
            server.registerTool(
                'search',
                {
                    description: 'Searches for Solana liquidity pools by token pubkey',
                    inputSchema: {
                        query: z.string().describe('Token public key to search for')
                    },
                    outputSchema: {
                        ids: z.array(z.object({
                            id: z.string(),
                            title: z.string(),
                            text: z.string(),
                            metadata: z.record(z.any())
                        }))
                    },
                    annotations: {}
                },
                async ({ query }) => {
                    console.log("Searching for pools with token:", query);
                    try {
                        const data = await shyftGet("/v0/pools/get_by_token", {
                            token: query,
                            page: 1,
                            per_page: 10
                        }) as ShyftResponse;

                        const ids = Object.entries(data.result?.dexes || {})
                            .filter(([dex]) => !["openbookV2", "fluxbeam"].includes(dex))
                            .flatMap(([dex, dexInfo]) =>
                                (dexInfo.pools || []).map(pool => ({
                                    id: pool.pubkey,
                                    title: `${dex} ${pool.pubkey}`,
                                    text: "",
                                    metadata: {
                                        dex,
                                        ...pool
                                    }
                                }))
                            );

                        return {
                            structuredContent: {
                                ids
                            },
                        };
                    } catch (error) {
                        console.error("Search error:", error);
                        return {
                            structuredContent: {
                                ids: []
                            },
                        };
                    }
                }
            );

            server.registerTool(
                'fetch',
                {
                    description: 'Returns the amount of each token in the liquidity pool',
                    inputSchema: {
                        id: z.string().describe('Pool address to fetch details for')
                    },
                    outputSchema: {
                        info: z.record(z.any())
                    },
                    annotations: {}
                },
                async ({ id }) => {
                    console.log("Fetching information for pool:", id);
                    try {
                        const data = await shyftGet("/v0/pools/get_liquidity_details", {
                            address: id
                        }) as LiquidityDetails;

                        const { result } = data;
                        const simplified = {
                            address: result.address,
                            dex: result.dex,
                            tokenA: result.liquidity.tokenA,
                            tokenB: result.liquidity.tokenB
                        };

                        return {
                            structuredContent: {
                                info: simplified
                            },
                        };
                    } catch (error) {
                        console.error("Fetch error:", error);
                        return {
                            structuredContent: {
                                info: {}
                            },
                        };
                    }
                }
            );
        },
        {
            capabilities: {},
        },
        {
            basePath: "",
            redisUrl: process.env.REDIS_URL,
            maxDuration: 60,
            verboseLogs: true,
        }
    );
}