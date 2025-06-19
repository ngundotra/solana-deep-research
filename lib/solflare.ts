import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createMcpHandler } from "@vercel/mcp-adapter";
import { z } from "zod";
import axios from "axios";

// Types
interface SolflareMint {
    address: string;
    name?: string;
    symbol?: string;
    decimals?: number;
    logoURI?: string;
    [key: string]: any;
}

interface SolflareSearchResponse {
    content: SolflareMint[];
}

interface SolflareMintResponse {
    content: SolflareMint[];
}

// Constants and configuration
const SOLFLARE_UTL_BASE = "https://token-list-api.solana.cloud/v1";

// Utility functions
const getSolflareHeaders = () => ({
    accept: "application/json"
});

const solflareGet = async (path: string, params?: Record<string, any>) => {
    try {
        const response = await axios.get(`${SOLFLARE_UTL_BASE}${path}`, {
            headers: getSolflareHeaders(),
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

const solflarePost = async (path: string, params?: Record<string, any>, data?: Record<string, any>) => {
    try {
        const response = await axios.post(`${SOLFLARE_UTL_BASE}${path}`, data, {
            headers: getSolflareHeaders(),
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

export function createSolflareMcp() {
    return createMcpHandler(
        async (server: McpServer) => {
            server.registerTool(
                'search',
                {
                    description: 'Searches for Solana token by name or symbol',
                    inputSchema: {
                        query: z.string().describe('Token name or symbol to search for')
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
                    console.log("Searching for token:", query);
                    try {
                        const data = await solflareGet("/search", {
                            query,
                            chainId: 101,
                            start: 0,
                            limit: 20
                        }) as SolflareSearchResponse;

                        const ids = (data.content || []).map(mint => ({
                            id: mint.address,
                            title: `${mint.name || ''} ${mint.address}`,
                            text: "",
                            metadata: mint
                        }));

                        return {
                            structuredContent: {
                                ids
                            }
                        };
                    } catch (error) {
                        console.error("Search error:", error);
                        return {
                            structuredContent: {
                                ids: []
                            }
                        };
                    }
                }
            );

            server.registerTool(
                'fetch',
                {
                    description: 'Returns the information for a given token',
                    inputSchema: {
                        id: z.string().describe('Token address to fetch details for')
                    },
                    outputSchema: {
                        info: z.record(z.any())
                    },
                    annotations: {}
                },
                async ({ id }) => {
                    console.log("Fetching information for token:", id);
                    try {
                        const data = await solflarePost("/mints",
                            { chainId: 101 },
                            { addresses: [id] }
                        ) as SolflareMintResponse;

                        if (data.content?.[0]) {
                            const mint = data.content[0];
                            const simplified = {
                                address: mint.address,
                                name: mint.name,
                                symbol: mint.symbol,
                                decimals: mint.decimals,
                                logoURI: mint.logoURI
                            };

                            return {
                                structuredContent: {
                                    info: simplified
                                }
                            };
                        }

                        return {
                            structuredContent: {
                                info: {}
                            }
                        };
                    } catch (error) {
                        console.error("Fetch error:", error);
                        return {
                            structuredContent: {
                                info: {}
                            }
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