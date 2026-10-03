// --- Tabs ---
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabPanels = {
      env: document.getElementById('tab-env'),
      history: document.getElementById('tab-history'),
      ha: document.getElementById('tab-ha'),
      weather: document.getElementById('tab-weather'),
      fw: document.getElementById('tab-fw')
    };

    tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        // activate button
        tabButtons.forEach(b => {
          b.classList.toggle('tab-btn--active', b === btn);
          b.setAttribute('aria-pressed', String(b === btn));
        });
        // show panel
        Object.entries(tabPanels).forEach(([key, panel]) => {
          panel.classList.toggle('tab-panel--active', key === tab);
        });
      });
    });

    // --- Live metrics + firmware status + temp unit ---

    const metricsEl = document.getElementById('metrics');
    const lastUpdatedChip = document.getElementById('chip-last-updated');
    const statusText = document.getElementById('status-text');

    const fwCurrentEl = document.getElementById('fw-current');
    const fwLatestEl = document.getElementById('fw-latest');
    const fwBadgeEl = document.getElementById('fw-badge');
    const fwStatusTextEl = document.getElementById('fw-status-text');
    const fwUpdateBtn = document.getElementById('fw-update-btn');
    const fwCheckBtn = document.getElementById('fw-check-btn');

    const unitButtons = document.querySelectorAll('.unit-btn');

    let currentFwVersion = null;
    let latestFwVersion = null;
    let updateState = 'unknown';
    let updateProgress = 0.0;
    let hasUpdate = false;
    let updateConfigured = false;
    let updateChecking = false;
    let updateError = '';
    let updateCheckPending = false;
    let currentTempUnit = 'C';

    function formatNumber(v, digits = 1) {
      if (v === null || v === undefined || Number.isNaN(v)) return '—';
      return Number(v).toFixed(digits);
    }

    function applyUnitToUI(unit) {
      const changed = currentTempUnit !== unit;
      currentTempUnit = unit;
      unitButtons.forEach(btn => {
        btn.classList.toggle('unit-btn--active', btn.dataset.unit === unit);
        btn.setAttribute('aria-pressed', String(btn.dataset.unit === unit));
      });
      if (changed) document.dispatchEvent(new CustomEvent('monitor:unit', { detail: unit }));
    }

    unitButtons.forEach(btn => {
      btn.addEventListener('click', async () => {
        const unit = btn.dataset.unit;
        const previousUnit = currentTempUnit;
        applyUnitToUI(unit);
        try {
          const res = await fetch('/api/temp_unit?unit=' + encodeURIComponent(unit), {
            method: 'POST'
          });
          if (!res.ok) throw new Error('bad status');
          const json = await res.json();
          if (json.temp_unit === 'C' || json.temp_unit === 'F') {
            applyUnitToUI(json.temp_unit);
          }
          await pollState();
        } catch (e) {
          applyUnitToUI(previousUnit);
        }
      });
    });

    function renderMetrics(data) {
      const unit = (data.temp_unit === 'C' || data.temp_unit === 'F') ? data.temp_unit : 'C';
      applyUnitToUI(unit);

      const tempRaw = data.temp;
      const temp = (tempRaw !== null && tempRaw !== undefined && !Number.isNaN(tempRaw))
        ? (unit === 'F' ? (tempRaw * 9/5 + 32) : tempRaw)
        : null;

      const items = [
        { label: 'Temperature', value: temp, unit: '°' + unit, decimals: 1, group: 'Indoor climate', style: 'climate', caption: 'Your room temperature' },
        { label: 'Humidity', value: data.rh, unit: '%', decimals: 1, group: 'Indoor climate', style: 'climate', caption: 'Relative humidity' },
        { label: 'PM1.0',     value: data.pm1,    unit: 'µg/m³',    decimals: 1, group: 'Airborne particles' },
        { label: 'PM2.5',     value: data.pm25,   unit: 'µg/m³',    decimals: 1 },
        { label: 'PM4.0',     value: data.pm4,    unit: 'µg/m³',    decimals: 1 },
        { label: 'PM10',      value: data.pm10,   unit: 'µg/m³',    decimals: 1 },
        { label: 'VOC index', value: data.voc, unit: '', decimals: 0, group: 'Gas indices', style: 'gas', caption: 'Volatile organic compounds' },
        { label: 'NOx index', value: data.nox, unit: '', decimals: 0, style: 'gas', caption: 'Nitrogen oxides' }
      ];

      let group = '';
      metricsEl.innerHTML = items.map(m => {
        const val = formatNumber(m.value, m.decimals);
        const heading = m.group && m.group !== group ? `<div class="metric-group">${m.group}</div>` : '';
        if (m.group) group = m.group;
        return `
          ${heading}<div class="metric${m.style ? ' metric--' + m.style : ''}">
            <div class="metric-label">${m.label}</div>
            <div class="metric-main">
              <div class="metric-value">${val}</div>
              <div class="metric-unit">${m.unit}</div>
            </div>
            ${m.caption ? '<div class="metric-caption">' + m.caption + '</div>' : ''}
          </div>
        `;
      }).join('');

      const now = new Date();
      lastUpdatedChip.textContent =
        'Last updated: ' + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }

    function renderFirmwareStatus() {
      fwCurrentEl.textContent = currentFwVersion || '—';
      fwLatestEl.textContent = latestFwVersion || '—';

      fwCheckBtn.textContent = updateChecking || updateCheckPending ? 'Checking…' : 'Check for updates';
      fwCheckBtn.disabled = !updateConfigured || updateChecking || updateCheckPending || updateState === 'installing';
      if (!updateConfigured) {
        fwBadgeEl.textContent = 'Initial update required';
        fwBadgeEl.className = 'fw-badge fw-badge--warn';
        fwStatusTextEl.textContent = 'This firmware has no GitHub updater. Install v0.3.2 or newer once via ESPHome/USB to enable dashboard updates.';
        fwUpdateBtn.disabled = true;
        fwUpdateBtn.textContent = 'Update firmware';
        return;
      }
      if (updateChecking || updateCheckPending) {
        fwBadgeEl.textContent = 'Checking GitHub';
        fwBadgeEl.className = 'fw-badge fw-badge--unknown';
        fwStatusTextEl.textContent = 'Fetching the latest firmware manifest from GitHub…';
        fwUpdateBtn.disabled = true;
        return;
      }
      if (updateError) {
        fwBadgeEl.textContent = 'Update error';
        fwBadgeEl.className = 'fw-badge fw-badge--warn';
        fwStatusTextEl.textContent = updateError;
        fwUpdateBtn.disabled = true;
        fwUpdateBtn.textContent = 'Update firmware';
        return;
      }

      if (updateState === 'installing') {
        fwBadgeEl.textContent = 'Installing update';
        fwBadgeEl.className = 'fw-badge fw-badge--warn';
        if (updateProgress > 0) {
          fwStatusTextEl.textContent = 'Installing firmware update... ' + Math.round(updateProgress) + '%';
        } else {
          fwStatusTextEl.textContent = 'Starting firmware update... device will reboot when done.';
        }
        fwUpdateBtn.disabled = true;
        fwUpdateBtn.textContent = 'Installing...';
        return;
      }

      if (!latestFwVersion) {
        fwBadgeEl.textContent = 'Status unknown';
        fwBadgeEl.className = 'fw-badge fw-badge--unknown';
        fwStatusTextEl.textContent = 'No successful GitHub check yet. Press Check for updates.';
        fwUpdateBtn.disabled = true;
        fwUpdateBtn.textContent = 'Update firmware';
        return;
      }

      if (hasUpdate) {
        fwBadgeEl.textContent = 'Update available';
        fwBadgeEl.className = 'fw-badge fw-badge--warn';
        fwStatusTextEl.textContent = 'A newer firmware is available. Click the button to install it over Wi-Fi.';
        fwUpdateBtn.disabled = false;
        fwUpdateBtn.textContent = 'Update to ' + latestFwVersion;
      } else {
        fwBadgeEl.textContent = 'Up to date';
        fwBadgeEl.className = 'fw-badge fw-badge--ok';
        fwStatusTextEl.textContent = 'This device is running the latest known firmware.';
        fwUpdateBtn.disabled = true;
        fwUpdateBtn.textContent = 'Up to date';
      }
    }

    function renderFirmwareFromState(data) {
      currentFwVersion = data.fw_version || null;
      latestFwVersion = data.latest_version || null;
      updateState = data.update_state || 'unknown';
      updateProgress = data.update_progress || 0.0;
      hasUpdate = data.has_update || false;
      updateConfigured = data.update_configured === true;
      updateChecking = data.update_checking === true;
      updateError = data.update_error || '';
      renderFirmwareStatus();
    }

    fwUpdateBtn.addEventListener('click', async () => {
      if (fwUpdateBtn.disabled) return;
      fwUpdateBtn.disabled = true;
      fwStatusTextEl.textContent = 'Starting firmware update… device will reboot when done.';

      try {
        const res = await fetch('/api/perform_update', { method: 'POST' });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'The device rejected the update.');
        // If the device reboots quickly, this page will drop connection anyway.
        fwStatusTextEl.textContent = 'Update started. This page may become unreachable while the device reboots.';
      } catch (e) {
        fwStatusTextEl.textContent = e.message || 'Failed to start update. Check connection and try again.';
        // Re-enable after a short delay
        setTimeout(() => {
          renderFirmwareStatus();
        }, 3000);
      }
    });

    fwCheckBtn.addEventListener('click', async () => {
      if (fwCheckBtn.disabled) return;
      updateCheckPending = true;
      updateError = '';
      renderFirmwareStatus();

      try {
        const res = await fetch('/api/check_update', { method: 'POST' });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'The device rejected the update check.');
        updateChecking = true;
      } catch (e) {
        updateChecking = false;
        updateError = e.message || 'Failed to check for updates. Check connection and try again.';
      }
      updateCheckPending = false;
      renderFirmwareStatus();
      setTimeout(pollState, 1000);
    });

    async function pollState() {
      try {
        const res = await fetch('/api/state', { cache: 'no-store' });
        if (!res.ok) throw new Error('bad status');
        const json = await res.json();
        renderMetrics(json);
        renderFirmwareFromState(json);
        statusText.textContent = 'Live';
        statusText.closest('.status-chip').dataset.state = 'live';
      } catch (e) {
        statusText.textContent = 'Offline';
        statusText.closest('.status-chip').dataset.state = 'offline';
      }
    }

    // --- Persistent weather location and current outdoor conditions ---
    const weatherMode = document.getElementById('weather-mode');
    const weatherSearch = document.getElementById('weather-search');
    const weatherResults = document.getElementById('weather-results');
    const weatherSave = document.getElementById('weather-save-btn');
    const weatherSearchBtn = document.getElementById('weather-search-btn');
    const weatherRefresh = document.getElementById('weather-refresh-btn');
    const weatherSearchStatus = document.getElementById('weather-search-status');
    const weatherSaveStatus = document.getElementById('weather-save-status');
    let weatherInitialized = false;
    let weatherDirty = false;
    let weatherSaving = false;
    let weatherSearchGeneration = 0;
    let weatherSearchController = null;
    let weatherLocations = [];
    let weatherSelected = null;
    let weatherPollInFlight = false;

    const weatherNames = ['Sunny', 'Cloudy', 'Light rain', 'Clear night', 'Partly cloudy', 'Heavy rain', 'Thunderstorm'];
    function weatherIcon(kind) {
      const cloud = '<path d="M5 16h14a4 4 0 0 0 0-8 6 6 0 0 0-11-1 4.5 4.5 0 0 0-3 9Z"/>';
      const sun = '<circle cx="12" cy="12" r="4"/><path d="M12 1v2m0 18v2M1 12h2m18 0h2M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2"/>';
      let content = '<path d="M9 8a3 3 0 1 1 4 3c-1 1-1 1-1 3m0 4h.01"/>';
      if (kind === 0) content = sun;
      if (kind === 1) content = cloud;
      if (kind === 2) content = cloud + '<path d="m9 19-1 2m8-2-1 2"/>';
      if (kind === 3) content = '<path d="M20 15A9 9 0 0 1 9 4a9 9 0 1 0 11 11Z"/>';
      if (kind === 4) content = '<circle cx="7" cy="6" r="3"/><path d="M7 1V0M2 6H0m2-4L1 1m10 1 1-1"/>' + cloud;
      if (kind === 5) content = cloud + '<path d="m6 18-2 4m7-4-2 4m7-4-2 4m7-4-2 4"/>';
      if (kind === 6) content = cloud + '<path d="m13 15-4 5h4l-2 4 7-6h-5l2-3"/>';
      return '<svg viewBox="0 0 24 26" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + content + '</svg>';
    }
    document.getElementById('weather-legend').innerHTML = [0, 4, 1, 2, 5, 6, 3].map(kind =>
      '<div class="weather-legend-item">' + weatherIcon(kind) + '<span>' + weatherNames[kind] + '</span></div>'
    ).join('');

    function weatherMessage(element, message, error = false) {
      element.textContent = message;
      element.dataset.error = String(error);
    }
    function updateWeatherForm() {
      document.getElementById('weather-manual-fields').hidden = weatherMode.value !== 'manual';
      weatherSave.disabled = !weatherInitialized || weatherSaving ||
        (weatherMode.value === 'manual' && !weatherSelected);
    }
    weatherMode.addEventListener('change', () => { weatherDirty = true; updateWeatherForm(); });
    weatherResults.addEventListener('change', () => {
      weatherSelected = weatherLocations[Number(weatherResults.value)] || null;
      if (weatherResults.value === '') weatherSelected = null;
      weatherDirty = true;
      updateWeatherForm();
    });
    weatherSearch.addEventListener('input', () => {
      ++weatherSearchGeneration;
      if (weatherSearchController) weatherSearchController.abort();
      weatherSearchBtn.disabled = false;
      weatherSelected = null;
      weatherLocations = [];
      weatherResults.replaceChildren(new Option('Search for a city first', ''));
      weatherResults.disabled = true;
      weatherDirty = true;
      weatherMessage(weatherSearchStatus, '');
      updateWeatherForm();
    });
    async function searchWeatherLocations() {
      const query = weatherSearch.value.trim();
      if (query.length < 2) { weatherMessage(weatherSearchStatus, 'Enter at least two characters.', true); return; }
      const generation = ++weatherSearchGeneration;
      if (weatherSearchController) weatherSearchController.abort();
      const controller = new AbortController();
      weatherSearchController = controller;
      const timeout = setTimeout(() => controller.abort(), 12000);
      weatherSelected = null;
      weatherLocations = [];
      weatherResults.replaceChildren(new Option('Searching…', ''));
      weatherResults.disabled = true;
      weatherSearchBtn.disabled = true;
      updateWeatherForm();
      weatherMessage(weatherSearchStatus, 'Searching locations…');
      try {
        const response = await fetch('https://geocoding-api.open-meteo.com/v1/search?' +
          new URLSearchParams({ name: query, count: '10', language: 'en', format: 'json' }),
          { signal: controller.signal });
        if (!response.ok) throw new Error('Search failed. Check your internet connection and try again.');
        const data = await response.json();
        if (generation !== weatherSearchGeneration) return;
        weatherLocations = (data.results || []).filter(location =>
          Number.isFinite(location.latitude) && Number.isFinite(location.longitude)
        ).map(location => ({
          latitude: location.latitude, longitude: location.longitude,
          name: [...new Set([location.name, location.admin1, location.country].filter(Boolean))].join(', ')
        })).filter(location => new TextEncoder().encode(location.name).length < 128);
        weatherResults.replaceChildren(new Option(weatherLocations.length ? 'Choose a location' : 'No matching locations', ''));
        weatherLocations.forEach((location, index) => weatherResults.add(new Option(location.name, String(index))));
        weatherResults.disabled = !weatherLocations.length;
        weatherMessage(weatherSearchStatus, weatherLocations.length ? 'Choose the correct city and country, then save.' : 'No matches. Try a nearby city or a different spelling.');
      } catch (error) {
        if (generation !== weatherSearchGeneration) return;
        weatherResults.replaceChildren(new Option('Search unavailable', ''));
        weatherMessage(weatherSearchStatus, 'City search failed. Check internet access and try again.', true);
      } finally {
        clearTimeout(timeout);
        if (generation === weatherSearchGeneration) weatherSearchBtn.disabled = false;
        updateWeatherForm();
      }
    }
    weatherSearchBtn.addEventListener('click', searchWeatherLocations);
    weatherSearch.addEventListener('keydown', event => {
      if (event.key === 'Enter') { event.preventDefault(); searchWeatherLocations(); }
    });

    async function weatherRequest(url, options = {}) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);
      try {
        const response = await fetch(url, { cache: 'no-store', signal: controller.signal, ...options });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'The device could not complete the request.');
        return data;
      } finally { clearTimeout(timeout); }
    }
    function renderWeather(data) {
      document.getElementById('weather-current-icon').innerHTML = weatherIcon(data.kind);
      document.getElementById('weather-condition').textContent = data.condition;
      document.getElementById('weather-location').textContent = data.location || 'Detecting location…';
      const age = data.age_seconds;
      document.getElementById('weather-age').textContent = age === null
        ? 'Waiting for the first weather update · Refreshes every 15 minutes'
        : 'Updated ' + (age < 60 ? 'just now' : Math.floor(age / 60) + ' min ago') + ' · ' +
          (data.mode === 'manual' ? 'Saved city' : 'IP-based location');
      weatherMessage(document.getElementById('weather-device-status'), data.error ||
        (data.fetching ? 'Updating weather…' : data.stale ? 'Weather is out of date. Check internet access.' : ''), Boolean(data.error || data.stale));
      if (!weatherInitialized || !weatherDirty) {
        weatherMode.value = data.mode;
        if (data.mode === 'manual' && Number.isFinite(data.latitude) && Number.isFinite(data.longitude)) {
          weatherSelected = { name: data.location, latitude: data.latitude, longitude: data.longitude };
          weatherLocations = [weatherSelected];
          weatherResults.replaceChildren(new Option(data.location, '0'));
          weatherResults.value = '0';
          weatherResults.disabled = false;
        }
      }
      weatherInitialized = true;
      weatherMode.disabled = false;
      weatherRefresh.disabled = data.fetching;
      updateWeatherForm();
    }
    async function pollWeather() {
      if (weatherPollInFlight) return;
      weatherPollInFlight = true;
      try { renderWeather(await weatherRequest('/api/weather')); }
      catch (error) {
        weatherMessage(document.getElementById('weather-device-status'), 'Weather settings unavailable. Check the device connection and firmware version.', true);
      } finally { weatherPollInFlight = false; }
    }
    document.getElementById('weather-settings-form').addEventListener('submit', async event => {
      event.preventDefault();
      if (weatherSave.disabled) return;
      const params = new URLSearchParams({ mode: weatherMode.value });
      if (weatherMode.value === 'manual') {
        params.set('latitude', weatherSelected.latitude);
        params.set('longitude', weatherSelected.longitude);
        params.set('name', weatherSelected.name);
      }
      weatherSaving = true;
      updateWeatherForm();
      weatherMessage(weatherSaveStatus, 'Saving location…');
      try {
        await weatherRequest('/api/weather', { method: 'POST', body: params });
        weatherDirty = false;
        weatherMessage(weatherSaveStatus, 'Location saved on the device. Fetching weather…');
        await pollWeather();
      } catch (error) { weatherMessage(weatherSaveStatus, error.message, true); }
      finally { weatherSaving = false; updateWeatherForm(); }
    });
    weatherRefresh.addEventListener('click', async () => {
      weatherRefresh.disabled = true;
      try {
        await weatherRequest('/api/weather/refresh', { method: 'POST' });
        weatherMessage(weatherSaveStatus, 'Weather refresh requested.');
      } catch (error) { weatherMessage(weatherSaveStatus, error.message, true); }
      finally { setTimeout(pollWeather, 1500); }
    });
    setInterval(pollWeather, 5000);
    pollWeather();

    // Poll local state every 5s, which includes the backend's OTA status
    setInterval(pollState, 5000);
    pollState();
