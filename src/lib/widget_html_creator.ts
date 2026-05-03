// Widget HTML Creator – generates a self-contained weather widget HTML string
// for use in ioBroker VIS2 / HTML states.
// Ported and extended from html-crator.js (external script, version 0.4.0).

/** Configuration passed from the adapter config (per location). */
export interface WidgetLocationConfig {
	/** Original display name of the location (as entered by the user). */
	locationName: string;
	/** Sanitized folder name used in ioBroker state IDs. */
	folderName: string;
	/** Number of daily forecast days to show in the widget (1–16). */
	daysCount: number;
	/** Number of hourly forecast slots to show in the widget (1–24). */
	hoursCount: number;
	/** Font size for the large current temperature, in px. */
	fSizeTemp: number;
	/** General font size for labels and info items, in px. */
	fSizeAll: number;
	/** Font size for day names in the forecast section, in px. */
	fSizeDay: number;
	/** Font size for hourly forecast entries, in px. */
	fSizeHour: number;
	/** Adapter name, e.g. 'open-meteo-weather'. */
	adapterName: string;
	/** Current system language code, e.g. 'de', 'en'. */
	systemLang: string;
}

/**
 * Callback that returns a state by its ID relative to the location folder.
 * Example: `'weather.current.temperature_2m'`
 * The adapter passes `(id) => this.getStateAsync(\`\${folderName}.\${id}\`)`.
 */
export type StateGetter = (relativeId: string) => Promise<ioBroker.State | null | undefined>;

// ---------------------------------------------------------------------------
// Internal i18n – only the labels required in the widget HTML itself.
// ---------------------------------------------------------------------------
const WIDGET_I18N: Record<string, { current: string }> = {
	de: { current: 'Aktuell' },
	en: { current: 'Current' },
	uk: { current: 'Зараз' },
	ru: { current: 'Сейчас' },
	nl: { current: 'Nu' },
	fr: { current: 'Actuel' },
	it: { current: 'Attuale' },
	es: { current: 'Actual' },
	pl: { current: 'Aktualnie' },
	pt: { current: 'Atual' },
	'zh-cn': { current: '当前' },
	zh: { current: '当前' },
};

const WIDGET_VERSION = '1.0.1';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generates a complete weather-widget HTML string.
 *
 * @param cfg   Per-location widget configuration (font sizes, counts, …).
 * @param getState  Async function to read a state by its location-relative ID.
 * @returns     Resolved HTML string ready to be stored as an ioBroker html state.
 */
export async function generateWeatherHtml(cfg: WidgetLocationConfig, getState: StateGetter): Promise<string> {
	const lang = WIDGET_I18N[cfg.systemLang] ?? WIDGET_I18N.en;

	// -----------------------------------------------------------------------
	// Helper – read a state value and append an optional unit string.
	// Returns '--<unit>' when the state is missing or null.
	// -----------------------------------------------------------------------
	async function getVal(relId: string, unit = ''): Promise<string> {
		try {
			const state = await getState(relId);
			if (!state || state.val === null || state.val === undefined) {
				return `--${unit}`;
			}
			return `${state.val}${unit}`;
		} catch {
			return `--${unit}`;
		}
	}

	// -----------------------------------------------------------------------
	// Helper – build an <img> tag from a state that holds an icon URL.
	// Returns an empty string when the URL is absent.
	// -----------------------------------------------------------------------
	async function getImg(relId: string, size = '20px', className = ''): Promise<string> {
		const url = await getVal(relId);
		if (!url || url.startsWith('--')) {
			return '';
		}
		const classAttr = className ? ` class="${className}"` : '';
		return `<img src="${url}" style="width:${size};height:${size};object-fit:contain;"${classAttr}>`;
	}

	// -----------------------------------------------------------------------
	// Clamp and convert config values to CSS strings
	// -----------------------------------------------------------------------
	const daysCount = Math.min(Math.max(cfg.daysCount ?? 6, 1), 16);
	const hoursCount = Math.min(Math.max(cfg.hoursCount ?? 6, 1), 24);

	const fSizeTemp = `${cfg.fSizeTemp ?? 38}px`;
	const fSizeAll = `${cfg.fSizeAll ?? 13}px`;
	const fSizeDay = `${cfg.fSizeDay ?? 12}px`;
	const fSizeHour = `${cfg.fSizeHour ?? 12}px`;
	// Derived "small" sizes (2 px less, minimum 8 px)
	const fSizeHourSmall = `${Math.max((cfg.fSizeHour ?? 12) - 2, 8)}px`;
	const fSizeDaySmall = `${Math.max((cfg.fSizeDay ?? 12) - 2, 8)}px`;

	// -----------------------------------------------------------------------
	// Fetch all current-weather and day-0 states in parallel
	// -----------------------------------------------------------------------
	const [
		currentTemp,
		currentHumidity,
		currentWeatherText,
		currentIconUrl,
		currentWindDirText,
		currentWindDirIcon,
		currentWindGustIcon,
		day0NameDay,
		day0Time,
		day0Sunrise,
		day0Sunset,
		day0TempMax,
		day0TempMin,
		day0PrecipSum,
		day0UvMax,
		day0SunshineDur,
		day0MoonIcon,
		currentWeatherCode,
	] = await Promise.all([
		getVal('weather.current.temperature_2m', '°'),
		getVal('weather.current.relative_humidity_2m', '%'),
		getVal('weather.current.weather_text'),
		getImg('weather.current.icon_url', '80px'),
		getVal('weather.current.wind_direction_text'),
		getImg('weather.current.wind_direction_icon', '35px'),
		getImg('weather.current.wind_gust_icon', '35px'),
		getVal('weather.forecast.day0.name_day'),
		getVal('weather.forecast.day0.time'),
		getVal('weather.forecast.day0.sunrise'),
		getVal('weather.forecast.day0.sunset'),
		getVal('weather.forecast.day0.temperature_2m_max', '°'),
		getVal('weather.forecast.day0.temperature_2m_min', '°'),
		getVal('weather.forecast.day0.precipitation_sum', 'mm'),
		getVal('weather.forecast.day0.uv_index_max'),
		getVal('weather.forecast.day0.sunshine_duration', 'h'),
		getImg('weather.forecast.day0.moon_phase_icon', '30px', 'icon-moon'),
		getVal('weather.current.weather_code'),
	]);
	const tempValue = parseFloat(currentTemp);
	const maxTempValue = parseFloat(day0TempMax);
	const minTempValue = parseFloat(day0TempMin);
	const rainValue = parseFloat(day0PrecipSum);
	const uvValue = parseFloat(day0UvMax);
	const wcodeValue = parseInt(currentWeatherCode);

	const tempColor = tempValue > 32 ? '#a855f7' : tempValue < -10 ? '#06b6d4' : '#fbbf24';
	const maxTempColor = maxTempValue > 32 ? '#a855f7' : maxTempValue < -10 ? '#06b6d4' : '#f87171';
	const minTempColor = minTempValue > 32 ? '#a855f7' : minTempValue < -10 ? '#06b6d4' : '#60a5fa';
	const rainColor = rainValue > 10 ? '#f30f0f' : '#ffffff';
	const uvColor = uvValue > 11 ? '#a855f7' : uvValue > 7 ? '#f87171' : uvValue > 3 ? '#fbbf24' : '#34d399';
	const weatherCodeColor =
		wcodeValue === 95 ? '#f36a0f' : wcodeValue === 96 ? '#ff004c' : wcodeValue === 99 ? '#a855f7' : '#38bdf8';

	// -----------------------------------------------------------------------
	// Build CSS + header section
	// -----------------------------------------------------------------------
	let html = `<style>
.w-container{font-family:'Segoe UI',sans-serif;background:linear-gradient(160deg,#1e293b 0%,#0f172a 100%);color:#f1f5f9;padding:20px;border-radius:24px;border:1px solid #334155;box-shadow:0 10px 30px rgba(0,0,0,0.5);}
.w-header{display:grid;grid-template-columns:1.2fr 1.5fr 1fr;gap:15px;background:rgba(255,255,255,0.05);padding:20px;border-radius:20px;margin-bottom:20px;border:1px solid rgba(255,255,255,0.1);}
.w-temp-big{font-size:${fSizeTemp};font-weight:900;line-height:1;}
.w-desc{font-size:${fSizeAll};font-weight:600;}
.w-info-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:${fSizeAll};margin-top:10px;}
.w-info-item{background:rgba(0,0,0,0.2);padding:6px 10px;border-radius:10px;display:flex;align-items:center;gap:5px;}
.w-sun-moon{font-size:${fSizeAll};line-height:1.6;border-left:1px solid rgba(255,255,255,0.1);padding-left:15px;}
.w-hourly{display:grid;grid-template-columns:repeat(${hoursCount},1fr);gap:8px;margin-bottom:20px;background:rgba(0,0,0,0.15);padding:10px;border-radius:15px;}
.w-h-item{text-align:center;font-size:${fSizeHour};}
.w-h-time{font-weight:bold;color:#38bdf8;}
.w-h-temp{font-weight:bold;display:block;}
.w-h-rain{font-size:${fSizeHourSmall};}
.w-forecast{display:grid;grid-template-columns:repeat(${daysCount},1fr);gap:10px;}
.w-fc-day{background:rgba(255,255,255,0.03);padding:12px 8px;border-radius:18px;text-align:center;border:1px solid rgba(255,255,255,0.05);display:flex;flex-direction:column;justify-content:space-between;}
.w-fc-name{font-weight:bold;color:#38bdf8;font-size:${fSizeDay};text-transform:uppercase;margin-bottom:2px;}
.w-fc-text{font-size:${fSizeDaySmall};height:2.2em;overflow:hidden;display:flex;align-items:center;justify-content:center;line-height:1.1;margin-bottom:5px;}
.w-fc-temp-max{font-weight:bold;font-size:${fSizeDay};display:block;}
.w-fc-temp-min{font-size:${fSizeDay};display:block;margin-bottom:5px;}
.w-fc-details{font-size:${fSizeDaySmall};color:#94a3b8;border-top:1px solid rgba(255,255,255,0.05);margin-top:8px;padding-top:8px;}
.icon-moon{filter:drop-shadow(0 0 3px #fff);}
</style>
<div class="w-container">
<div class="w-header">
  <div style="text-align:center;">
    <div style="font-size:${fSizeAll};font-weight:bold;">${lang.current} / ${day0NameDay}</div>
    <div style="font-size:${fSizeDay};font-weight:bold;">${cfg.locationName}</div>
    <div style="font-size:${fSizeDay};font-weight:bold;">${day0Time}</div>
    ${currentIconUrl}
    <div class="w-desc" style="color:${weatherCodeColor};">${currentWeatherText}</div>
  </div>
  <div>
    <div class="w-temp-big" style="color:${tempColor};">${currentTemp}</div>
    <div style="font-weight:bold;margin-bottom:10px;">
      <span style="color:${maxTempColor};">${day0TempMax}</span> | <span style="color:${minTempColor};">${day0TempMin}</span>
    </div>
    <div class="w-info-grid">
      <div class="w-info-item">💧 ${currentHumidity}</div>
      <div class="w-info-item" style="color:${rainColor};">🌧️ ${day0PrecipSum}</div>
      <div class="w-info-item" style="color:${uvColor};">☀️ UV ${day0UvMax}</div>
      <div class="w-info-item">⏱️ ${day0SunshineDur}</div>
    </div>
  </div>
  <div class="w-sun-moon" style="position:relative;">
    🌅 ${day0Sunrise}<br>
    🌇 ${day0Sunset}<br>
    💨 ${currentWindDirText} ${currentWindDirIcon}<br>
    <div style="margin-top:8px;display:flex;align-items:center;gap:10px;">
      ${day0MoonIcon}
      ${currentWindGustIcon}
    </div>
    <div style="position:absolute;bottom:-10px;right:0;font-size:0.6rem;color:#475569;opacity:0.8;">v${WIDGET_VERSION}</div>
  </div>
</div>
<div class="w-hourly">`;

	// -----------------------------------------------------------------------
	// Hourly forecast rows
	// -----------------------------------------------------------------------
	for (let h = 0; h < hoursCount; h++) {
		const hBase = `weather.forecast.hourly.next_hours.hour${h}`;
		const [hTime, hIconUrl, hTemp, hPrecipProb, hPrecip] = await Promise.all([
			getVal(`${hBase}.time`),
			getImg(`${hBase}.icon_url`, '30px'),
			getVal(`${hBase}.temperature_2m`, '°'),
			getVal(`${hBase}.precipitation_probability`, '%'),
			getVal(`${hBase}.precipitation`, 'mm'),
		]);
		const tempValue = parseFloat(hTemp);
		const rainValue = parseFloat(hPrecip);

		const tempColor = tempValue > 32 ? '#a855f7' : tempValue < -10 ? '#06b6d4' : '#fbbf24';
		const rainColor = rainValue > 10 ? '#f30f0f' : '#94a3b8';
		html += `
  <div class="w-h-item">
    <div class="w-h-time">${hTime}</div>
    ${hIconUrl}
    <span class="w-h-temp" style="color:${tempColor};">${hTemp}</span>
    <span class="w-h-rain" style="color:${rainColor};">🌧️${hPrecipProb} / ${hPrecip}</span>
  </div>`;
	}

	html += `\n</div>\n<div class="w-forecast">`;

	// -----------------------------------------------------------------------
	// Daily forecast columns (day1 … day<daysCount>)
	// -----------------------------------------------------------------------
	for (let i = 1; i <= daysCount; i++) {
		const dBase = `weather.forecast.day${i}`;
		const [
			dName,
			dText,
			dIconUrl,
			dTempMax,
			dTempMin,
			dPrecipSum,
			dPrecipProb,
			dHumidity,
			dSunshine,
			dMoonIcon,
			dWindDirIcon,
			dWindGustIcon,
			dWeatherCode,
		] = await Promise.all([
			getVal(`${dBase}.name_day`),
			getVal(`${dBase}.weather_text`),
			getImg(`${dBase}.icon_url`, '45px'),
			getVal(`${dBase}.temperature_2m_max`, '°'),
			getVal(`${dBase}.temperature_2m_min`, '°'),
			getVal(`${dBase}.precipitation_sum`, 'mm'),
			getVal(`${dBase}.precipitation_probability_max`, '%'),
			getVal(`${dBase}.relative_humidity_2m_mean`, '%'),
			getVal(`${dBase}.sunshine_duration`, 'h'),
			getImg(`${dBase}.moon_phase_icon`, '18px', 'icon-moon'),
			getImg(`${dBase}.wind_direction_icon`, '18px'),
			getImg(`${dBase}.wind_gust_icon`, '22px'),
			getVal(`${dBase}.weather_code`),
		]);

		const maxTempValue = parseFloat(dTempMax);
		const minTempValue = parseFloat(dTempMin);
		const rainValue = parseFloat(dPrecipSum);
		const wcodeValue = parseInt(dWeatherCode);

		const maxTempColor = maxTempValue > 32 ? '#a855f7' : maxTempValue < -10 ? '#06b6d4' : '#ffffff';
		const minTempColor = minTempValue > 32 ? '#a855f7' : minTempValue < -10 ? '#06b6d4' : '#ffffff';
		const rainColor = rainValue > 10 ? '#f30f0f' : '#94a3b8';
		const weatherCodeColor =
			wcodeValue === 95 ? '#f36a0f' : wcodeValue === 96 ? '#ff004c' : wcodeValue === 99 ? '#a855f7' : '#94a3b8';
		html += `
  <div class="w-fc-day">
    <div>
      <div class="w-fc-name">${dName}</div>
      <div class="w-fc-text" style="color:${weatherCodeColor};">${dText}</div>
      ${dIconUrl}
      <span class="w-fc-temp-max" style="color:${maxTempColor};">${dTempMax}</span>
      <span class="w-fc-temp-min" style="color:${minTempColor};">${dTempMin}</span>
    </div>
    <div class="w-fc-details">
      🌧️ <span style="color:${rainColor};">${dPrecipSum} (${dPrecipProb})</span><br>
      💧 ${dHumidity}<br>
      ☀️ ${dSunshine}<br>
      <div style="margin-top:5px;display:flex;justify-content:center;gap:4px;">
        ${dMoonIcon}${dWindDirIcon}${dWindGustIcon}
      </div>
    </div>
  </div>`;
	}

	html += `\n</div>\n</div>`;
	return html;
}
