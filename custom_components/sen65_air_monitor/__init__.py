"""Serve the shared dashboard inside Home Assistant's authenticated frontend."""

from pathlib import Path

import voluptuous as vol

from homeassistant.components import frontend, panel_custom, websocket_api
from homeassistant.components.http import StaticPathConfig
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import ConfigEntryNotReady
from homeassistant.helpers.aiohttp_client import async_get_clientsession

from .client import BoardClient, BoardUnavailable
from .const import DOMAIN, FRONTEND_VERSION, PANEL_PATH, STATIC_PATH
from .validation import board_identity


async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    runtime = hass.data.setdefault(DOMAIN, {"clients": {}, "panel": False})
    await hass.http.async_register_static_paths([
        StaticPathConfig(STATIC_PATH, str(Path(__file__).parent / "frontend"), False)
    ])
    websocket_api.async_register_command(hass, ws_list)
    websocket_api.async_register_command(hass, ws_request)
    return True


async def async_setup_entry(hass: HomeAssistant, entry) -> bool:
    runtime = hass.data[DOMAIN]
    client = BoardClient(async_get_clientsession(hass), entry.data["url"])
    try:
        state = await client.request("/api/state")
        details = await client.request("/api/home_assistant")
        if state["status"] != 200 or details["status"] != 200:
            raise ValueError("Incompatible board API.")
        identity = board_identity(state["data"], details["data"])
        if identity != entry.unique_id:
            raise ValueError("The address now belongs to a different board.")
    except (BoardUnavailable, ValueError) as err:
        raise ConfigEntryNotReady("Cannot connect to the configured SEN65 board.") from err
    runtime["clients"][entry.entry_id] = {"client": client, "title": entry.title}
    try:
        if not runtime["panel"]:
            await panel_custom.async_register_panel(
                hass, frontend_url_path=PANEL_PATH,
                webcomponent_name="sen65-air-monitor-panel",
                sidebar_title="SEN65 Air Monitor", sidebar_icon="mdi:air-filter",
                module_url=f"{STATIC_PATH}/panel.js?v={FRONTEND_VERSION}",
                config={"static_path": STATIC_PATH}, require_admin=True,
            )
            runtime["panel"] = True
    except Exception:
        runtime["clients"].pop(entry.entry_id, None)
        raise
    return True


async def async_unload_entry(hass: HomeAssistant, entry) -> bool:
    runtime = hass.data[DOMAIN]
    runtime["clients"].pop(entry.entry_id, None)
    if not runtime["clients"] and runtime["panel"]:
        frontend.async_remove_panel(hass, PANEL_PATH)
        runtime["panel"] = False
    return True


@websocket_api.websocket_command({"type": f"{DOMAIN}/list"})
@websocket_api.require_admin
def ws_list(hass, connection, msg):
    """Only HA administrators can access this device-control panel."""
    clients = hass.data[DOMAIN]["clients"]
    connection.send_result(msg["id"], [{"entry_id": key, "title": value["title"]} for key, value in clients.items()])


@websocket_api.websocket_command({
    "type": f"{DOMAIN}/request", vol.Required("entry_id"): str,
    vol.Required("path"): vol.All(str, vol.Length(max=512)),
    vol.Optional("method", default="GET"): vol.In(["GET", "POST"]),
    vol.Optional("body", default=""): vol.All(str, vol.Length(max=1024)),
})
@websocket_api.require_admin
@websocket_api.async_response
async def ws_request(hass, connection, msg):
    """Relay whitelisted API operations to the configured board only."""
    board = hass.data[DOMAIN]["clients"].get(msg["entry_id"])
    if board is None:
        connection.send_error(msg["id"], "not_found", "This board is not configured or is offline.")
        return
    try:
        result = await board["client"].request(msg["path"], msg["method"], msg["body"])
    except ValueError:
        connection.send_error(msg["id"], "invalid_request", "Unsupported dashboard operation.")
    except BoardUnavailable:
        connection.send_error(msg["id"], "unavailable", "Cannot reach this board from Home Assistant.")
    else:
        connection.send_result(msg["id"], result)
