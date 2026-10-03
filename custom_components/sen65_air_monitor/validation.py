"""Strict board and operation validation; no generic HTTP proxy."""

import ipaddress
import math
import re
from urllib.parse import parse_qsl, urlsplit

READ_PATHS = {"/api/state", "/api/history", "/api/weather", "/api/home_assistant"}
WRITE_PATHS = {"/api/temp_unit", "/api/weather", "/api/weather/refresh", "/api/check_update", "/api/perform_update", "/api/home_assistant/scan"}


def normalize_url(raw: str) -> str:
    """Accept a LAN hostname/IP, or an HTTP(S) origin without credentials."""
    if not isinstance(raw, str) or not raw or re.search(r"[\s\\]", raw):
        raise ValueError("Enter the board's local hostname or IP address.")
    url = urlsplit(raw if "://" in raw else "http://" + raw)
    if url.scheme not in {"http", "https"} or url.username or url.password or url.path not in {"", "/"} or url.query or url.fragment:
        raise ValueError("Only a local HTTP(S) origin without credentials is allowed.")
    host = url.hostname
    if not host or (":" not in host and not re.fullmatch(r"[a-zA-Z0-9.-]+", host)):
        raise ValueError("Invalid host.")
    port = url.port if url.port is not None else (443 if url.scheme == "https" else 80)
    if not 1 <= port <= 65535:
        raise ValueError("Invalid port.")
    host = host.lower().rstrip(".")
    try:
        address = ipaddress.ip_address(host)
    except ValueError:
        if host == "localhost" or host.endswith(".localhost"):
            raise ValueError("Loopback targets are not allowed.") from None
    else:
        if not is_lan_address(str(address)):
            raise ValueError("Only private LAN addresses are allowed.")
    authority = f"[{host}]" if ":" in host else host
    default_port = 443 if url.scheme == "https" else 80
    return f"{url.scheme}://{authority}" + (f":{port}" if port != default_port else "")


def is_lan_address(raw: str) -> bool:
    """Allow RFC1918 / IPv6 ULA only, excluding loopback and metadata targets."""
    try:
        ip = ipaddress.ip_address(raw)
    except ValueError:
        return False
    if ip.version == 6:
        return ip in ipaddress.ip_network("fc00::/7")
    return any(ip in ipaddress.ip_network(net) for net in ("10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16"))


def validate_operation(path: str, method: str, body: str = "") -> tuple[str, dict[str, str]]:
    """Whitelist method, endpoint and parameters before reaching the LAN."""
    if len(path) > 512 or len(body) > 1024:
        raise ValueError("Request is too large.")
    url = urlsplit(path)
    if url.scheme or url.netloc or url.fragment or url.path not in (READ_PATHS if method == "GET" else WRITE_PATHS if method == "POST" else set()):
        raise ValueError("Unsupported dashboard operation.")
    pairs = parse_qsl(url.query, keep_blank_values=True) + parse_qsl(body, keep_blank_values=True)
    params = dict(pairs)
    if len(params) != len(pairs) or (body and method != "POST"):
        raise ValueError("Duplicate or unsupported parameters.")
    endpoint = url.path
    allowed = set()
    if endpoint == "/api/history" and method == "GET":
        allowed = {"group"}
        if params.get("group", "particles") not in {"particles", "gases", "climate"}:
            raise ValueError("Unknown history group.")
    elif endpoint == "/api/temp_unit":
        allowed = {"unit"}
        if params.get("unit") not in {"C", "F"}:
            raise ValueError("Choose Celsius or Fahrenheit.")
    elif endpoint == "/api/weather" and method == "POST":
        allowed = {"mode", "latitude", "longitude", "name"}
        if params.get("mode") not in {"auto", "manual"}:
            raise ValueError("Choose a weather location mode.")
        if params["mode"] == "manual":
            for key, limit in (("latitude", 90), ("longitude", 180)):
                value = float(params.get(key, "nan"))
                if not math.isfinite(value) or not -limit <= value <= limit:
                    raise ValueError("Invalid weather coordinates.")
            name = params.get("name", "")
            if not name or len(name.encode()) > 95 or any(ord(c) < 32 for c in name):
                raise ValueError("Invalid location name.")
        elif set(params) != {"mode"}:
            raise ValueError("Automatic location accepts no coordinates.")
    if set(params) - allowed:
        raise ValueError("Unsupported parameters.")
    return endpoint, params


def board_identity(state: dict, details: dict) -> str:
    """Verify the expected board API without trusting its URL as a target."""
    if not isinstance(state, dict) or not all(key in state for key in ("temp", "rh", "pm1", "pm25", "pm4", "pm10", "voc", "nox", "fw_version")):
        raise ValueError("This is not a compatible SEN65 dashboard API.")
    identity = details.get("device_host", "") if isinstance(details, dict) else ""
    if not isinstance(identity, str) or not re.fullmatch(r"[a-zA-Z0-9-]+\.local", identity):
        raise ValueError("The board did not provide a valid identity.")
    return identity.lower()
