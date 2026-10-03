"""User-confirmed setup, discovery and address reconfiguration."""

import voluptuous as vol

from homeassistant import config_entries
from homeassistant.const import CONF_NAME, CONF_URL
from homeassistant.helpers.aiohttp_client import async_get_clientsession

from .client import BoardClient, BoardUnavailable
from .const import DOMAIN
from .validation import board_identity, normalize_url


class SEN65ConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    VERSION = 1

    def __init__(self):
        self._discovered_url = ""

    async def _validate(self, value):
        origin = normalize_url(value)
        client = BoardClient(async_get_clientsession(self.hass), origin)
        state = await client.request("/api/state")
        details = await client.request("/api/home_assistant")
        if state["status"] != 200 or details["status"] != 200:
            raise ValueError("Install compatible firmware first.")
        return origin, board_identity(state["data"], details["data"])

    async def async_step_user(self, user_input=None):
        errors = {}
        if user_input is not None:
            try:
                origin, identity = await self._validate(user_input[CONF_URL])
            except BoardUnavailable:
                errors["base"] = "cannot_connect"
            except ValueError:
                errors["base"] = "invalid_board"
            else:
                await self.async_set_unique_id(identity)
                self._abort_if_unique_id_configured()
                return self.async_create_entry(title=user_input.get(CONF_NAME) or identity.removesuffix(".local"), data={CONF_URL: origin})
        schema = vol.Schema({vol.Required(CONF_URL, default=self._discovered_url): str, vol.Optional(CONF_NAME, default="SEN65 Air Monitor"): str})
        return self.async_show_form(step_id="user", data_schema=schema, errors=errors)

    async def async_step_zeroconf(self, discovery_info):
        # The native API advertises 6053; the dashboard uses the board's port 80.
        host = discovery_info.host
        host = f"[{host}]" if ":" in host else host
        try:
            self._discovered_url, identity = await self._validate(f"http://{host}")
        except (BoardUnavailable, ValueError):
            return self.async_abort(reason="not_supported")
        await self.async_set_unique_id(identity)
        # Never silently change the configured target based on untrusted mDNS.
        self._abort_if_unique_id_configured()
        self.context["title_placeholders"] = {"name": identity.removesuffix(".local")}
        return await self.async_step_user()

    async def async_step_reconfigure(self, user_input=None):
        entry = self._get_reconfigure_entry()
        errors = {}
        if user_input is not None:
            try:
                origin, identity = await self._validate(user_input[CONF_URL])
                if identity != entry.unique_id:
                    raise ValueError("Different board.")
            except BoardUnavailable:
                errors["base"] = "cannot_connect"
            except ValueError:
                errors["base"] = "invalid_board"
            else:
                return self.async_update_reload_and_abort(entry, data_updates={CONF_URL: origin})
        return self.async_show_form(step_id="reconfigure", data_schema=vol.Schema({vol.Required(CONF_URL, default=entry.data[CONF_URL]): str}), errors=errors)
