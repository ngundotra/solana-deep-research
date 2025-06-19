from typing import List
import requests
from fastmcp import FastMCP
import os
from dotenv import load_dotenv

mcp = FastMCP(
    name="Solflare Token API",
    instructions="""
    This server provides data lookup tools via Solflare UTL API.
    """,
    streamable_http_path="/mcp"
)

load_dotenv()

SOLFLARE_UTL_BASE = "https://token-list-api.solana.cloud/v1"

# Abstracted headers and request logic
def get_solflare_utl_headers():
    return {
        "accept": "application/json",
    }

def solflare_utl_request(method, path, params=None, json=None):
    url = f"{SOLFLARE_UTL_BASE}{path}"
    try:
        if method == "GET":
            response = requests.get(url, headers=get_solflare_utl_headers(), params=params, allow_redirects=True)
        elif method == "POST":
            response = requests.post(url, headers=get_solflare_utl_headers(), params=params, json=json, allow_redirects=True)
        else:
            raise ValueError(f"Unsupported HTTP method: {method}")
        response.raise_for_status()
        return response.json()
    except requests.exceptions.HTTPError as e:
        print(f"HTTP error: {e}, status code: {response.status_code}, response: {response.text[:200]}")
        raise
    except Exception as e:
        print(f"Unexpected error: {e}")
        raise

def search_solflare_utl(query: str):
    return solflare_utl_request(
        "GET",
        "/search",
        params={"query": query, "chainId": 101, "start": 0, "limit": 20}
    )

def get_solflare_utl_data(addresses: List[str]):
    return solflare_utl_request(
        "POST",
        "/mints",
        params={"chainId": 101},
        json={"addresses": addresses}
    )

# print("Starting Solflare UTL server")

@mcp.tool
async def search(query: str):
    """
    Searches for Solana token by name or symbol. Returns a list of tokens with metadata.
    """
    try:
        data = search_solflare_utl(query)
        if 'content' in data:
            ids = []
            for mint in data['content']:
                ids.append({
                    "id": mint['address'],
                    "title": f"{mint.get('name', '')} {mint.get('address', '')}",
                    "text": "",
                    "metadata": {
                        **mint
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
    Returns the information for a given token.
    """
    try:
        data = get_solflare_utl_data([id])
        if 'content' in data and data['content']:
            mint = data['content'][0]
            simplified = {
                "address": mint.get("address"),
                "name": mint.get("name"),
                "symbol": mint.get("symbol"),
                "decimals": mint.get("decimals"),
                "logoURI": mint.get("logoURI"),
            }
            return {"info": simplified}
        else:
            print("Unexpected data structure or empty content:", data)
            return {"info": {}}
    except requests.exceptions.RequestException as e:
        print(f"Request error: {e}")
        return {"info": {}, "error": str(e)}
    except ValueError as e:
        print(f"JSON parsing error: {e}")
        return {"info": {}, "error": "Invalid JSON response"}

if __name__ == "__main__":
    mcp.run()