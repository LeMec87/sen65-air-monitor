"""Bounded requests to an administrator-configured LAN board."""

import asyncio
import json
import socket
from time import monotonic
from urllib.parse import urlsplit

from aiohttp import ClientError, ClientTimeout

from .const import MAX_RESPONSE_BYTES, REQUEST_TIMEOUT
from .validation import is_lan_address, normalize_url, validate_operation


class BoardUnavailable(Exception):
    """The board cannot provide a valid response."""


class BoardClient:
    def __init__(self, session, origin: str):
        self.session = session
        self.origin = normalize_url(origin)
        self._lock = asyncio.Lock()
        self._cache = {}

    async def request(self, path: str, method: str = "GET", body: str = "") -> dict:
        endpoint, params = validate_operation(path, method, body)
        key = (endpoint, tuple(sorted(params.items())))
        async with self._lock:
            if method == "GET" and key in self._cache:
                timestamp, result = self._cache[key]
                if monotonic() - timestamp < 3:
                    return result
            try:
                async with asyncio.timeout(REQUEST_TIMEOUT):
                    # Validate every resolution and pin the connection to a LAN IP.
                    # This prevents redirects and DNS rebinding into arbitrary targets.
                    url = urlsplit(self.origin)
                    port = url.port or (443 if url.scheme == "https" else 80)
                    addresses = await asyncio.get_running_loop().getaddrinfo(url.hostname, port, type=socket.SOCK_STREAM)
                    ips = list(dict.fromkeys(item[4][0] for item in addresses))
                    if not ips or any(not is_lan_address(ip) for ip in ips):
                        raise BoardUnavailable("The board must resolve only to private LAN addresses.")
                    ip = ips[0]
                    authority = f"[{ip}]" if ":" in ip else ip
                    target = f"{url.scheme}://{authority}:{port}{endpoint}"
                    async with self.session.request(
                        method, target, params=params, allow_redirects=False,
                        timeout=ClientTimeout(total=REQUEST_TIMEOUT),
                        server_hostname=url.hostname if url.scheme == "https" else None,
                    ) as response:
                        if 300 <= response.status < 400:
                            raise BoardUnavailable("Board redirects are not allowed.")
                        # Iterated reads bound memory even with a misleading Content-Length.
                        payload = bytearray()
                        async for chunk in response.content.iter_chunked(8192):
                            payload.extend(chunk)
                            if len(payload) > MAX_RESPONSE_BYTES:
                                raise BoardUnavailable("The board response is too large.")
                        data = json.loads(payload)
                        if not isinstance(data, dict):
                            raise BoardUnavailable("Invalid board response.")
                        result = {"status": response.status, "data": data}
            except (TimeoutError, ClientError, OSError, ValueError) as err:
                raise BoardUnavailable("The board is unavailable or returned invalid data.") from err
            if method == "GET" and result["status"] == 200:
                self._cache[key] = (monotonic(), result)
            elif method == "POST":
                self._cache.clear()
            return result
