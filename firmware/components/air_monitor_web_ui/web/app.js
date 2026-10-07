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
          const res = await airMonitorFetch('/api/temp_unit?unit=' + encodeURIComponent(unit), {
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

    // Instantaneous dashboard guidance, not AQI or health/exposure limits.
    // PM1 and PM4 use explicit project heuristics; gas indices are relative.
    const metricBands = {
      temp: { valid: [-40, 85], good: [20, 26], moderate: [18, 28] },
      rh: { valid: [0, 100], good: [40, 60], moderate: [30, 70] },
      pm1: { valid: [0, Infinity], good: [0, 15], moderate: [0, 35] },
      pm25: { valid: [0, Infinity], good: [0, 15], moderate: [0, 35] },
      pm4: { valid: [0, Infinity], good: [0, 45], moderate: [0, 100] },
      pm10: { valid: [0, Infinity], good: [0, 45], moderate: [0, 100] },
      voc: { valid: [1, 500], good: [1, 150], moderate: [1, 250] },
      nox: { valid: [1, 500], good: [1, 20], moderate: [1, 50] }
    };
    function metricQuality(key, value) {
      const band = metricBands[key];
      if (!band || typeof value !== 'number' || !Number.isFinite(value) ||
          value < band.valid[0] || value > band.valid[1]) return 'unknown';
      if (value >= band.good[0] && value <= band.good[1]) return 'good';
      if (value >= band.moderate[0] && value <= band.moderate[1]) return 'moderate';
      return 'poor';
    }

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
      const metricKeys = ['temp', 'rh', 'pm1', 'pm25', 'pm4', 'pm10', 'voc', 'nox'];
      metricsEl.innerHTML = items.map((m, i) => {
        // Always assess raw Celsius, independent of display unit.
        const quality = metricQuality(metricKeys[i], data[metricKeys[i]]);
        const qualityLabel = { good: 'Good', moderate: 'Moderate', poor: 'Poor', unknown: 'No valid reading' }[quality];
        const val = formatNumber(m.value, m.decimals);
        const heading = m.group && m.group !== group ? `<div class="metric-group">${m.group}</div>` : '';
        if (m.group) group = m.group;
        return `
          ${heading}<div class="metric${m.style ? ' metric--' + m.style : ''}" data-quality="${quality}">
            <div class="metric-label">${m.label}</div>
            <div class="metric-main">
              <div class="metric-value">${val}</div>
              <div class="metric-unit">${m.unit}</div>
            </div>
            ${m.caption ? '<div class="metric-caption">' + m.caption + '</div>' : ''}
            <div class="metric-quality">${qualityLabel}</div>
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
        const res = await airMonitorFetch('/api/perform_update', { method: 'POST' });
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
        const res = await airMonitorFetch('/api/check_update', { method: 'POST' });
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
        const res = await airMonitorFetch('/api/state', { cache: 'no-store' });
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

    const weatherNames = ['Sunny', 'Cloudy', 'Light rain', 'Clear night', 'Partly cloudy', 'Heavy rain', 'Thunderstorm', 'Snow'];
    // Pixel silhouettes mirror the native 18 x 18 e-paper weather symbols.
    function weatherIcon(kind) {
      if (kind === 3) return '<svg xmlns="http://www.w3.org/2000/svg" class="pixel-icon" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 2h12v2H6zM4 4h2v2H4zM18 4h2v2h-2zM2 6h2v12H2zM20 6h2v12h-2zM4 18h2v2H4zM18 18h2v2h-2zM6 20h12v2H6zM8 6h3v2H8zM6 8h2v3H6zM11 8h2v3h-2zM8 11h3v2H8zM15 7h2v2h-2zM7 15h2v2H7zM14 14h3v3h-3z"/></svg>';
      if (kind === 7) return '<svg xmlns="http://www.w3.org/2000/svg" class="pixel-icon" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M10 0h6v2h-6zM8 2h2v2H8zM16 2h2v2h-2zM4 4h4v2H4zM18 4h2v4h-2zM2 6h2v2H2zM8 6h2v2H8zM0 8h2v6H0zM16 8h8v2h-8zM22 10h2v4h-2zM2 14h8v2H2zM20 14h2v2h-2zM14 14h2v2h-2zM12 16h2v2h-2zM16 16h2v2h-2zM14 18h2v2h-2zM0 18h2v2H0zM6 18h2v2H6zM4 20h2v2H4zM6 22h2v2H6zM20 18h2v2h-2zM18 20h2v2h-2z"/></svg>';
      if (kind === 2 || kind === 5 || kind === 6) {
        const cloud = 'M22 20H2v-2h20v2ZM2 18H0v-6h2v6Zm22 0h-2v-6h2v6Zm-6-6v2h-2v-2h2ZM4 12H2v-2h2v2Zm6 0H8v-2h2v2Zm10-2h2v2h-4V8h2v2ZM8 10H4V8h4v2Zm2-2H8V6h2v2Zm8 0h-2V6h2v2Zm-2-2h-6V4h6v2Z';
        const rain = kind === 6 ? 'M11 13h4v2h-2v2h3v2h-3v2h-2v2H9v-4h2v-2H8v-2h3z' : kind === 2 ? 'M7 17h2v3H7zM15 17h2v3h-2z' : 'M3 17h2v5H3zM8 17h2v5H8zM13 17h2v5h-2zM18 17h2v5h-2z';
        return '<svg xmlns="http://www.w3.org/2000/svg" class="pixel-icon" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path transform="translate(0 -4)" d="' + cloud + '"/><path d="' + rain + '"/></svg>';
      }
      if (kind === 1) return '<svg xmlns="http://www.w3.org/2000/svg" class="pixel-icon" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M22 20H2v-2h20v2ZM2 18H0v-6h2v6Zm22 0h-2v-6h2v6Zm-6-6v2h-2v-2h2ZM4 12H2v-2h2v2Zm6 0H8v-2h2v2Zm10-2h2v2h-4V8h2v2ZM8 10H4V8h4v2Zm2-2H8V6h2v2Zm8 0h-2V6h2v2Zm-2-2h-6V4h6v2Z"/></svg>';
      if (kind === 4) return '<svg xmlns="http://www.w3.org/2000/svg" class="pixel-icon" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M14 22H4v-2h10v2ZM4 20H2v-4h2v4Zm12 0h-2v-4h2v4Zm-6-2H8v-2h2v2Zm-2-2H4v-2h4v2Zm6 0h-2v-2h2v2Zm-2-2H8v-2h4v2Zm12-1h-4v-2h4v2Zm-6-1h-2v-2h2v2ZM8 10H6V8h2v2Zm8 0h-2V8h2v2Zm-2-2H8V6h6v2ZM6 6H4V4h2v2Zm14 0h-2V4h2v2ZM4 4H2V2h2v2Zm9 0h-2V0h2v4Zm9 0h-2V2h2v2Z"/></svg>';
      if (kind === 0) return '<svg xmlns="http://www.w3.org/2000/svg" class="pixel-icon" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M13 22h-2v-3h2v3Zm-6-3H5v-2h2v2Zm12 0h-2v-2h2v2ZM15 9h2v6h-2v2H9v-2H7V9h2V7h6v2ZM5 13H2v-2h3v2Zm17 0h-3v-2h3v2ZM7 7H5V5h2v2Zm12 0h-2V5h2v2Zm-6-2h-2V2h2v3Z"/></svg>';
      const paths = ["M9 0h2v1h-2zM9 1h2v1h-2zM9 2h2v1h-2zM4 3h1v1h-1zM14 3h1v1h-1zM4 4h2v1h-2zM13 4h2v1h-2zM5 5h1v1h-1zM9 5h1v1h-1zM13 5h1v1h-1zM7 6h5v1h-5zM7 7h5v1h-5zM1 8h3v1h-3zM6 8h7v1h-7zM15 8h3v1h-3zM1 9h3v1h-3zM7 9h5v1h-5zM15 9h3v1h-3zM7 10h5v1h-5zM9 11h1v1h-1zM5 12h1v1h-1zM13 12h1v1h-1zM4 13h2v1h-2zM13 13h2v1h-2zM4 14h1v1h-1zM9 14h2v1h-2zM14 14h1v1h-1zM9 15h2v1h-2zM9 16h2v1h-2z","M10 2h1v1h-1zM7 3h7v1h-7zM6 4h4v1h-4zM11 4h4v1h-4zM5 5h3v1h-3zM13 5h2v1h-2zM3 6h5v1h-5zM13 6h2v1h-2zM2 7h3v1h-3zM6 7h1v1h-1zM14 7h2v1h-2zM2 8h2v1h-2zM7 8h1v1h-1zM13 8h4v1h-4zM1 9h2v1h-2zM15 9h2v1h-2zM1 10h2v1h-2zM16 10h2v1h-2zM1 11h2v1h-2zM15 11h2v1h-2zM1 12h16v1h-16zM1 13h16v1h-16z","M10 0h1v1h-1zM7 1h7v1h-7zM6 2h4v1h-4zM11 2h4v1h-4zM5 3h3v1h-3zM13 3h2v1h-2zM3 4h5v1h-5zM13 4h2v1h-2zM2 5h3v1h-3zM6 5h1v1h-1zM14 5h2v1h-2zM2 6h2v1h-2zM7 6h1v1h-1zM13 6h4v1h-4zM1 7h2v1h-2zM15 7h2v1h-2zM1 8h2v1h-2zM16 8h2v1h-2zM1 9h2v1h-2zM15 9h2v1h-2zM1 10h16v1h-16zM1 11h16v1h-16zM6 13h1v1h-1zM13 13h1v1h-1zM5 14h1v1h-1zM12 14h1v1h-1zM5 15h1v1h-1zM12 15h1v1h-1z","M6 2h2v1h-2zM5 3h3v1h-3zM4 4h4v1h-4zM3 5h4v1h-4zM3 6h5v1h-5zM3 7h5v1h-5zM2 8h6v1h-6zM3 9h6v1h-6zM3 10h7v1h-7zM3 11h10v1h-10zM14 11h2v1h-2zM4 12h11v1h-11zM5 13h9v1h-9zM6 14h7v1h-7zM9 15h1v1h-1z","M6 0h1v1h-1zM11 0h1v1h-1zM1 1h1v1h-1zM6 1h1v1h-1zM10 1h1v1h-1zM2 2h1v1h-1zM6 2h1v1h-1zM4 3h5v1h-5zM4 4h5v1h-5zM10 4h1v1h-1zM0 5h2v1h-2zM3 5h11v1h-11zM4 6h6v1h-6zM11 6h4v1h-4zM4 7h4v1h-4zM13 7h2v1h-2zM3 8h5v1h-5zM13 8h2v1h-2zM2 9h3v1h-3zM6 9h1v1h-1zM14 9h2v1h-2zM2 10h2v1h-2zM7 10h1v1h-1zM13 10h4v1h-4zM1 11h2v1h-2zM15 11h2v1h-2zM1 12h2v1h-2zM16 12h2v1h-2zM1 13h2v1h-2zM15 13h2v1h-2zM1 14h16v1h-16zM1 15h16v1h-16z","M10 0h1v1h-1zM7 1h7v1h-7zM6 2h4v1h-4zM11 2h4v1h-4zM5 3h3v1h-3zM13 3h2v1h-2zM3 4h5v1h-5zM13 4h2v1h-2zM2 5h3v1h-3zM6 5h1v1h-1zM14 5h2v1h-2zM2 6h2v1h-2zM7 6h1v1h-1zM13 6h4v1h-4zM1 7h2v1h-2zM15 7h2v1h-2zM1 8h2v1h-2zM16 8h2v1h-2zM1 9h2v1h-2zM15 9h2v1h-2zM1 10h16v1h-16zM1 11h16v1h-16zM3 12h2v1h-2zM7 12h2v1h-2zM11 12h2v1h-2zM15 12h2v1h-2zM2 13h2v1h-2zM6 13h2v1h-2zM10 13h2v1h-2zM14 13h2v1h-2zM2 14h2v1h-2zM6 14h2v1h-2zM10 14h2v1h-2zM14 14h2v1h-2zM1 15h2v1h-2zM5 15h2v1h-2zM9 15h2v1h-2zM13 15h2v1h-2zM1 16h2v1h-2zM5 16h2v1h-2zM9 16h2v1h-2zM13 16h2v1h-2z","M10 0h1v1h-1zM7 1h7v1h-7zM6 2h4v1h-4zM11 2h4v1h-4zM5 3h3v1h-3zM13 3h2v1h-2zM3 4h5v1h-5zM13 4h2v1h-2zM2 5h3v1h-3zM6 5h1v1h-1zM14 5h2v1h-2zM2 6h2v1h-2zM7 6h1v1h-1zM13 6h4v1h-4zM1 7h2v1h-2zM15 7h2v1h-2zM1 8h2v1h-2zM16 8h2v1h-2zM1 9h2v1h-2zM10 9h1v1h-1zM15 9h2v1h-2zM1 10h16v1h-16zM1 11h16v1h-16zM8 12h6v1h-6zM7 13h5v1h-5zM6 14h6v1h-6zM8 15h2v1h-2zM8 16h1v1h-1zM7 17h1v1h-1z","M9 2h2v1h-2zM9 3h2v1h-2zM9 4h2v1h-2zM3 5h1v1h-1zM9 5h2v1h-2zM15 5h1v1h-1zM3 6h3v1h-3zM7 6h5v1h-5zM13 6h3v1h-3zM4 7h4v1h-4zM9 7h6v1h-6zM6 8h7v1h-7zM6 9h7v1h-7zM6 10h7v1h-7zM6 11h7v1h-7zM4 12h11v1h-11zM3 13h3v1h-3zM9 13h2v1h-2zM13 13h3v1h-3zM3 14h1v1h-1zM9 14h2v1h-2zM15 14h1v1h-1zM9 15h2v1h-2zM9 16h2v1h-2z"];
      const content = paths[kind] || 'M7 3h4v2H7zM11 5h2v4h-2v2H9v2H7V9h2V7h2zM7 15h2v2H7z';
      return '<svg class="pixel-icon" viewBox="0 0 18 18" fill="currentColor" shape-rendering="crispEdges" aria-hidden="true"><path d="' + content + '"/></svg>';
    }
    document.getElementById('weather-legend').innerHTML = [0, 4, 1, 2, 5, 6, 7, 3].map(kind =>
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
        const response = await airMonitorFetch(url, { cache: 'no-store', signal: controller.signal, ...options });
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
