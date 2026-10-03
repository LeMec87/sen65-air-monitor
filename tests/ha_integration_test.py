"""Tests with the real Home Assistant 2026.9 API; all LAN I/O is mocked."""
import asyncio
from pathlib import Path
import sys
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import ConfigEntryNotReady, Unauthorized
from homeassistant.components.frontend import async_panel_exists
from custom_components.sen65_air_monitor import client, config_flow
import custom_components.sen65_air_monitor as integration
from custom_components.sen65_air_monitor.const import DOMAIN, PANEL_PATH, MAX_RESPONSE_BYTES
from custom_components.sen65_air_monitor.validation import normalize_url, is_lan_address, validate_operation

STATE = {key: 1 for key in ('temp','rh','pm1','pm25','pm4','pm10','voc','nox')}
STATE['fw_version']='0.3.6'
DETAILS = {'device_host':'sen65-air-monitor-example.local'}

@pytest.mark.parametrize('value', ['localhost','127.0.0.1','169.254.169.254','https://8.8.8.8','http://user:pass@192.168.1.2','http://192.168.1.2/api/state','http://192.168.1.2:0','http://192.168.1.2?url=x','http://192.168.1.2\\evil','[::1]'])
def test_unsafe_targets(value):
    with pytest.raises(ValueError): normalize_url(value)

def test_safe_targets_and_commands():
    assert normalize_url('sen65-example.local') == 'http://sen65-example.local'
    assert normalize_url('http://192.168.1.2:80/') == 'http://192.168.1.2'
    assert normalize_url('http://[fd00::2]:8080') == 'http://[fd00::2]:8080'
    assert is_lan_address('10.0.0.1') and not is_lan_address('::ffff:127.0.0.1')
    assert validate_operation('/api/history?group=particles','GET')[1] == {'group':'particles'}
    assert validate_operation('/api/temp_unit?unit=C','POST')[1] == {'unit':'C'}
    assert validate_operation('/api/weather','POST','mode=manual&latitude=52&longitude=13&name=Example')[1]['name'] == 'Example'

@pytest.mark.parametrize('path,method,body', [
    ('https://example.test/api/state','GET',''),('/api/state?url=http://localhost','GET',''),
    ('/api/state','DELETE',''),('/api/../state','GET',''),('/api/history?group=other','GET',''),
    ('/api/temp_unit?unit=C&unit=F','POST',''),('/api/weather','POST','mode=manual&latitude=nan&longitude=1&name=X'),
    ('/api/weather','POST','mode=manual&latitude=1&longitude=181&name=X'),('/api/weather','POST','mode=auto&name=X'),
    ('/api/perform_update?firmware_url=https://evil.test','POST',''),
])
def test_unsafe_commands(path,method,body):
    with pytest.raises(ValueError): validate_operation(path,method,body)

class Reply:
    def __init__(self,payload=b'{"temp":1}',status=200): self.payload=payload; self.status=status; self.content=self
    async def __aenter__(self): return self
    async def __aexit__(self,*args): pass
    async def iter_chunked(self,size):
        for start in range(0,len(self.payload),size): yield self.payload[start:start+size]

class Session:
    def __init__(self): self.calls=[]; self.reply=Reply()
    def request(self,*args,**kwargs): self.calls.append((args,kwargs)); return self.reply

@pytest.mark.asyncio
async def test_client_pins_dns_cache_and_rejects_rebinding(monkeypatch):
    loop=asyncio.get_running_loop()
    resolve=AsyncMock(return_value=[(2,1,6,'',('192.168.1.2',80))])
    monkeypatch.setattr(loop,'getaddrinfo',resolve)
    session=Session(); board=client.BoardClient(session,'http://sen65-example.local')
    assert (await board.request('/api/state'))['data']['temp']==1
    await board.request('/api/state')
    assert len(session.calls)==1
    assert session.calls[0][0]==('GET','http://192.168.1.2:80/api/state')
    assert session.calls[0][1]['allow_redirects'] is False
    await board.request('/api/temp_unit?unit=C','POST')
    await board.request('/api/state')
    assert len(session.calls)==3
    resolve.return_value=[(2,1,6,'',('8.8.8.8',80))]
    with pytest.raises(client.BoardUnavailable): await board.request('/api/weather')
    assert len(session.calls)==3

@pytest.mark.asyncio
@pytest.mark.parametrize('payload,status', [(b'{}',302),(b'[]',200),(b'x',200),(b'x'*(MAX_RESPONSE_BYTES+1),200)])
async def test_client_rejects_redirects_and_bad_payloads(monkeypatch,payload,status):
    monkeypatch.setattr(asyncio.get_running_loop(),'getaddrinfo',AsyncMock(return_value=[(2,1,6,'',('192.168.1.2',80))]))
    session=Session(); session.reply=Reply(payload,status)
    with pytest.raises(client.BoardUnavailable): await client.BoardClient(session,'192.168.1.2').request('/api/state')

@pytest.mark.asyncio
async def test_panel_lifecycle_and_websocket_permissions(monkeypatch,tmp_path):
    hass=HomeAssistant(str(tmp_path))
    hass.data[DOMAIN]={'clients':{},'panel':False}
    board=SimpleNamespace(request=AsyncMock(side_effect=lambda path,*args: {'status':200,'data':STATE if path=='/api/state' else DETAILS}))
    monkeypatch.setattr(integration,'BoardClient',lambda *args:board)
    monkeypatch.setattr(integration,'async_get_clientsession',lambda hass:object())
    entry=SimpleNamespace(entry_id='board1',unique_id=DETAILS['device_host'],title='Living room',data={'url':'http://192.168.1.2'})
    assert await integration.async_setup_entry(hass,entry)
    assert async_panel_exists(hass,PANEL_PATH)
    conn=SimpleNamespace(user=SimpleNamespace(is_admin=False),send_result=Mock(),send_error=Mock())
    with pytest.raises(Unauthorized): integration.ws_list(hass,conn,{'id':1})
    with pytest.raises(Unauthorized): integration.ws_request(hass,conn,{'id':2,'entry_id':'board1','path':'/api/state','method':'GET','body':''})
    conn.user.is_admin=True
    integration.ws_list(hass,conn,{'id':1})
    assert conn.send_result.call_args.args[1]==[{'entry_id':'board1','title':'Living room'}]
    integration.ws_request(hass,conn,{'id':2,'entry_id':'board1','path':'/api/state','method':'GET','body':''})
    await hass.async_block_till_done()
    assert conn.send_result.call_args.args[1]['status']==200
    entry2=SimpleNamespace(**{**entry.__dict__,'entry_id':'board2','title':'Office'})
    await integration.async_setup_entry(hass,entry2)
    await integration.async_unload_entry(hass,entry)
    assert async_panel_exists(hass,PANEL_PATH)
    await integration.async_unload_entry(hass,entry2)
    assert not async_panel_exists(hass,PANEL_PATH)
    integration.ws_request(hass,conn,{'id':3,'entry_id':'board1','path':'/api/state','method':'GET','body':''})
    await hass.async_block_till_done()
    assert conn.send_error.call_args.args[1]=='not_found'

@pytest.mark.asyncio
async def test_setup_refuses_different_board(monkeypatch,tmp_path):
    hass=HomeAssistant(str(tmp_path)); hass.data[DOMAIN]={'clients':{},'panel':False}
    board=SimpleNamespace(request=AsyncMock(side_effect=lambda path: {'status':200,'data':STATE if path=='/api/state' else DETAILS}))
    monkeypatch.setattr(integration,'BoardClient',lambda *args:board)
    monkeypatch.setattr(integration,'async_get_clientsession',lambda hass:object())
    entry=SimpleNamespace(entry_id='board1',unique_id='another-board.local',title='Room',data={'url':'http://192.168.1.2'})
    with pytest.raises(ConfigEntryNotReady): await integration.async_setup_entry(hass,entry)
    assert not hass.data[DOMAIN]['clients']

@pytest.mark.asyncio
async def test_real_config_flow_forms_and_errors(monkeypatch,tmp_path):
    flow=config_flow.SEN65ConfigFlow(); flow.hass=HomeAssistant(str(tmp_path)); flow.context={'source':'user'}; flow.flow_id='test'
    assert (await flow.async_step_user())['step_id']=='user'
    flow._validate=AsyncMock(side_effect=client.BoardUnavailable())
    result=await flow.async_step_user({'url':'192.168.1.2','name':'Room'})
    assert result['errors']['base']=='cannot_connect'
    flow._validate=AsyncMock(side_effect=ValueError())
    assert (await flow.async_step_user({'url':'8.8.8.8'}))['errors']['base']=='invalid_board'
    flow._validate=AsyncMock(return_value=('http://192.168.1.2',DETAILS['device_host']))
    flow.async_set_unique_id=AsyncMock(); flow._abort_if_unique_id_configured=Mock()
    result=await flow.async_step_user({'url':'192.168.1.2','name':'Room'})
    assert result['type']=='create_entry' and result['title']=='Room'
    assert result['data']=={'url':'http://192.168.1.2'}

@pytest.mark.asyncio
async def test_discovery_requires_confirmation_and_uses_http_port(tmp_path):
    flow=config_flow.SEN65ConfigFlow(); flow.hass=HomeAssistant(str(tmp_path))
    flow.context={'source':'zeroconf'}; flow.flow_id='discovery'
    flow._validate=AsyncMock(return_value=('http://192.168.1.2',DETAILS['device_host']))
    flow.async_set_unique_id=AsyncMock(); flow._abort_if_unique_id_configured=Mock()
    result=await flow.async_step_zeroconf(SimpleNamespace(host='192.168.1.2',port=6053))
    flow._validate.assert_awaited_once_with('http://192.168.1.2')
    assert result['type']=='form' and result['step_id']=='user'
    assert flow._discovered_url=='http://192.168.1.2'
    flow._validate.side_effect=client.BoardUnavailable()
    assert (await flow.async_step_zeroconf(SimpleNamespace(host='192.168.1.3')))['reason']=='not_supported'

@pytest.mark.asyncio
async def test_reconfigure_preserves_board_identity(tmp_path):
    flow=config_flow.SEN65ConfigFlow(); flow.hass=HomeAssistant(str(tmp_path))
    flow.context={'source':'reconfigure'}; flow.flow_id='reconfigure'
    entry=SimpleNamespace(unique_id=DETAILS['device_host'],data={'url':'http://192.168.1.2'})
    flow._get_reconfigure_entry=Mock(return_value=entry)
    flow._validate=AsyncMock(return_value=('http://192.168.1.3','different-board.local'))
    result=await flow.async_step_reconfigure({'url':'192.168.1.3'})
    assert result['errors']['base']=='invalid_board'
    flow._validate.return_value=('http://192.168.1.3',DETAILS['device_host'])
    flow.async_update_reload_and_abort=Mock(return_value={'type':'abort','reason':'reconfigure_successful'})
    assert (await flow.async_step_reconfigure({'url':'192.168.1.3'}))['reason']=='reconfigure_successful'
    flow.async_update_reload_and_abort.assert_called_once_with(entry,data_updates={'url':'http://192.168.1.3'})

@pytest.mark.asyncio
@pytest.mark.parametrize('error,code',[(ValueError(),'invalid_request'),(client.BoardUnavailable(),'unavailable')])
async def test_websocket_reports_invalid_operation_and_offline_board(tmp_path,error,code):
    hass=HomeAssistant(str(tmp_path))
    board=SimpleNamespace(request=AsyncMock(side_effect=error))
    hass.data[DOMAIN]={'clients':{'board1':{'client':board,'title':'Room'}},'panel':False}
    conn=SimpleNamespace(user=SimpleNamespace(is_admin=True),send_result=Mock(),send_error=Mock())
    integration.ws_request(hass,conn,{'id':1,'entry_id':'board1','path':'/api/state','method':'GET','body':''})
    await hass.async_block_till_done()
    assert conn.send_error.call_args.args[1]==code
    conn.send_result.assert_not_called()
