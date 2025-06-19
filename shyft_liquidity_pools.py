import requests
from fastmcp import FastMCP
import os
from dotenv import load_dotenv

mcp = FastMCP(
    name="Shyft Liquidity Pools",
    instructions="""
    This server provides data lookup tools for Solana liquidity pools.
    """
)

load_dotenv()
SHYFT_API_KEY = os.environ.get("SHYFT_API_KEY")
if not SHYFT_API_KEY:
    raise RuntimeError("SHYFT_API_KEY not set in environment variables. Please check your .env file.")

SHYFT_URL = "https://defi.shyft.to"

# Abstracted headers and request logic
def get_shyft_headers():
    return {
        "accept": "application/json",
        "x-api-key": SHYFT_API_KEY
    }

def shyft_get(path, params=None):
    url = f"{SHYFT_URL}{path}"
    try:
        response = requests.get(url, headers=get_shyft_headers(), params=params, allow_redirects=True)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.HTTPError as e:
        print(f"HTTP error: {e}, status code: {response.status_code}, response: {response.text[:200]}")
        raise

print("Starting Shyft Liquidity Pools server")

@mcp.tool
async def search(query: str):
    """
    Searches for Solana liquidity pools by token pubkey. Returns a list of pools with dex info & metadata.
    """
    print("Searching for pools with token: ", query)
    try:
        data = shyft_get(
            "/v0/pools/get_by_token",
            params={"token": query, "page": 1, "per_page": 10}
        )
        if 'result' in data and 'dexes' in data['result']:
            ids = []
            for dex, dex_info in data['result']['dexes'].items():
                pools = dex_info.get('pools', [])
                if dex in ["openbookV2", "fluxbeam"]:
                    continue
                for pool in pools:
                    ids.append({
                        "id": pool['pubkey'],
                        "title": f"{dex} {pool['pubkey']}",
                        "text": "",
                        "metadata": {
                            "dex": dex,
                            **pool
                        }
                    })
            return {"ids": ids}
        else:
            print("Unexpected data structure:", data)
            return {"ids": []}
    except requests.exceptions.RequestException as e:
        print(f"Request error: {e}")
        return {"ids": [], "error": str(e)}
    except ValueError as e:
        print(f"JSON parsing error: {e}")
        return {"ids": [], "error": "Invalid JSON response"}

@mcp.tool
async def fetch(id: str):
    """
    Returns the amount of each token in the liquidity pool.
    """
    print("Fetching information for pool: ", id)
    try:
        data = shyft_get("/v0/pools/get_liquidity_details", params={"address": id})
        # Extract and simplify the result
        result = data.get("result", {})
        liquidity = result.get("liquidity", {})
        tokenA = liquidity.get("tokenA", {})
        tokenB = liquidity.get("tokenB", {})
        simplified = {
            "address": result.get("address"),
            "dex": result.get("dex"),
            "tokenA": tokenA,
            "tokenB": tokenB
        }
        return {"info": simplified}
    except requests.exceptions.RequestException as e:
        print(f"Request error: {e}")
        return {"info": {}, "error": str(e)}
    except ValueError as e:
        print(f"JSON parsing error: {e}")
        return {"info": {}, "error": "Invalid JSON response"}

if __name__ == "__main__":
    mcp.run()