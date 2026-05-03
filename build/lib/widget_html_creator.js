"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var widget_html_creator_exports = {};
__export(widget_html_creator_exports, {
  generateWeatherHtml: () => generateWeatherHtml
});
module.exports = __toCommonJS(widget_html_creator_exports);
const WIDGET_I18N = {
  de: { current: "Aktuell" },
  en: { current: "Current" },
  uk: { current: "\u0417\u0430\u0440\u0430\u0437" },
  ru: { current: "\u0421\u0435\u0439\u0447\u0430\u0441" },
  nl: { current: "Nu" },
  fr: { current: "Actuel" },
  it: { current: "Attuale" },
  es: { current: "Actual" },
  pl: { current: "Aktualnie" },
  pt: { current: "Atual" },
  "zh-cn": { current: "\u5F53\u524D" },
  zh: { current: "\u5F53\u524D" }
};
const WIDGET_VERSION = "1.0.1";
async function generateWeatherHtml(cfg, getState) {
  var _a, _b, _c, _d, _e, _f, _g, _h, _i;
  const lang = (_a = WIDGET_I18N[cfg.systemLang]) != null ? _a : WIDGET_I18N.en;
  async function getVal(relId, unit = "") {
    try {
      const state = await getState(relId);
      if (!state || state.val === null || state.val === void 0) {
        return `--${unit}`;
      }
      return `${state.val}${unit}`;
    } catch {
      return `--${unit}`;
    }
  }
  async function getImg(relId, size = "20px", className = "") {
    const url = await getVal(relId);
    if (!url || url.startsWith("--")) {
      return "";
    }
    const classAttr = className ? ` class="${className}"` : "";
    return `<img src="${url}" style="width:${size};height:${size};object-fit:contain;"${classAttr}>`;
  }
  const daysCount = Math.min(Math.max((_b = cfg.daysCount) != null ? _b : 6, 1), 16);
  const hoursCount = Math.min(Math.max((_c = cfg.hoursCount) != null ? _c : 6, 1), 24);
  const fSizeTemp = `${(_d = cfg.fSizeTemp) != null ? _d : 38}px`;
  const fSizeAll = `${(_e = cfg.fSizeAll) != null ? _e : 13}px`;
  const fSizeDay = `${(_f = cfg.fSizeDay) != null ? _f : 12}px`;
  const fSizeHour = `${(_g = cfg.fSizeHour) != null ? _g : 12}px`;
  const fSizeHourSmall = `${Math.max(((_h = cfg.fSizeHour) != null ? _h : 12) - 2, 8)}px`;
  const fSizeDaySmall = `${Math.max(((_i = cfg.fSizeDay) != null ? _i : 12) - 2, 8)}px`;
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
    currentWeatherCode
  ] = await Promise.all([
    getVal("weather.current.temperature_2m", "\xB0"),
    getVal("weather.current.relative_humidity_2m", "%"),
    getVal("weather.current.weather_text"),
    getImg("weather.current.icon_url", "80px"),
    getVal("weather.current.wind_direction_text"),
    getImg("weather.current.wind_direction_icon", "35px"),
    getImg("weather.current.wind_gust_icon", "35px"),
    getVal("weather.forecast.day0.name_day"),
    getVal("weather.forecast.day0.time"),
    getVal("weather.forecast.day0.sunrise"),
    getVal("weather.forecast.day0.sunset"),
    getVal("weather.forecast.day0.temperature_2m_max", "\xB0"),
    getVal("weather.forecast.day0.temperature_2m_min", "\xB0"),
    getVal("weather.forecast.day0.precipitation_sum", "mm"),
    getVal("weather.forecast.day0.uv_index_max"),
    getVal("weather.forecast.day0.sunshine_duration", "h"),
    getImg("weather.forecast.day0.moon_phase_icon", "30px", "icon-moon"),
    getVal("weather.current.weather_code")
  ]);
  const tempValue = parseFloat(currentTemp);
  const maxTempValue = parseFloat(day0TempMax);
  const minTempValue = parseFloat(day0TempMin);
  const rainValue = parseFloat(day0PrecipSum);
  const uvValue = parseFloat(day0UvMax);
  const wcodeValue = parseInt(currentWeatherCode);
  const tempColor = tempValue > 32 ? "#a855f7" : tempValue < -10 ? "#06b6d4" : "#fbbf24";
  const maxTempColor = maxTempValue > 32 ? "#a855f7" : maxTempValue < -10 ? "#06b6d4" : "#f87171";
  const minTempColor = minTempValue > 32 ? "#a855f7" : minTempValue < -10 ? "#06b6d4" : "#60a5fa";
  const rainColor = rainValue > 10 ? "#f30f0f" : "#ffffff";
  const uvColor = uvValue > 11 ? "#a855f7" : uvValue > 7 ? "#f87171" : uvValue > 3 ? "#fbbf24" : "#34d399";
  const weatherCodeColor = wcodeValue === 95 ? "#f36a0f" : wcodeValue === 96 ? "#ff004c" : wcodeValue === 99 ? "#a855f7" : "#38bdf8";
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
      <div class="w-info-item">\u{1F4A7} ${currentHumidity}</div>
      <div class="w-info-item" style="color:${rainColor};">\u{1F327}\uFE0F ${day0PrecipSum}</div>
      <div class="w-info-item" style="color:${uvColor};">\u2600\uFE0F UV ${day0UvMax}</div>
      <div class="w-info-item">\u23F1\uFE0F ${day0SunshineDur}</div>
    </div>
  </div>
  <div class="w-sun-moon" style="position:relative;">
    \u{1F305} ${day0Sunrise}<br>
    \u{1F307} ${day0Sunset}<br>
    \u{1F4A8} ${currentWindDirText} ${currentWindDirIcon}<br>
    <div style="margin-top:8px;display:flex;align-items:center;gap:10px;">
      ${day0MoonIcon}
      ${currentWindGustIcon}
    </div>
    <div style="position:absolute;bottom:-10px;right:0;font-size:0.6rem;color:#475569;opacity:0.8;">v${WIDGET_VERSION}</div>
  </div>
</div>
<div class="w-hourly">`;
  for (let h = 0; h < hoursCount; h++) {
    const hBase = `weather.forecast.hourly.next_hours.hour${h}`;
    const [hTime, hIconUrl, hTemp, hPrecipProb, hPrecip] = await Promise.all([
      getVal(`${hBase}.time`),
      getImg(`${hBase}.icon_url`, "30px"),
      getVal(`${hBase}.temperature_2m`, "\xB0"),
      getVal(`${hBase}.precipitation_probability`, "%"),
      getVal(`${hBase}.precipitation`, "mm")
    ]);
    const tempValue2 = parseFloat(hTemp);
    const rainValue2 = parseFloat(hPrecip);
    const tempColor2 = tempValue2 > 32 ? "#a855f7" : tempValue2 < -10 ? "#06b6d4" : "#fbbf24";
    const rainColor2 = rainValue2 > 10 ? "#f30f0f" : "#94a3b8";
    html += `
  <div class="w-h-item">
    <div class="w-h-time">${hTime}</div>
    ${hIconUrl}
    <span class="w-h-temp" style="color:${tempColor2};">${hTemp}</span>
    <span class="w-h-rain" style="color:${rainColor2};">\u{1F327}\uFE0F${hPrecipProb} / ${hPrecip}</span>
  </div>`;
  }
  html += `
</div>
<div class="w-forecast">`;
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
      dWeatherCode
    ] = await Promise.all([
      getVal(`${dBase}.name_day`),
      getVal(`${dBase}.weather_text`),
      getImg(`${dBase}.icon_url`, "45px"),
      getVal(`${dBase}.temperature_2m_max`, "\xB0"),
      getVal(`${dBase}.temperature_2m_min`, "\xB0"),
      getVal(`${dBase}.precipitation_sum`, "mm"),
      getVal(`${dBase}.precipitation_probability_max`, "%"),
      getVal(`${dBase}.relative_humidity_2m_mean`, "%"),
      getVal(`${dBase}.sunshine_duration`, "h"),
      getImg(`${dBase}.moon_phase_icon`, "18px", "icon-moon"),
      getImg(`${dBase}.wind_direction_icon`, "18px"),
      getImg(`${dBase}.wind_gust_icon`, "22px"),
      getVal(`${dBase}.weather_code`)
    ]);
    const maxTempValue2 = parseFloat(dTempMax);
    const minTempValue2 = parseFloat(dTempMin);
    const rainValue2 = parseFloat(dPrecipSum);
    const wcodeValue2 = parseInt(dWeatherCode);
    const maxTempColor2 = maxTempValue2 > 32 ? "#a855f7" : maxTempValue2 < -10 ? "#06b6d4" : "#ffffff";
    const minTempColor2 = minTempValue2 > 32 ? "#a855f7" : minTempValue2 < -10 ? "#06b6d4" : "#ffffff";
    const rainColor2 = rainValue2 > 10 ? "#f30f0f" : "#94a3b8";
    const weatherCodeColor2 = wcodeValue2 === 95 ? "#f36a0f" : wcodeValue2 === 96 ? "#ff004c" : wcodeValue2 === 99 ? "#a855f7" : "#94a3b8";
    html += `
  <div class="w-fc-day">
    <div>
      <div class="w-fc-name">${dName}</div>
      <div class="w-fc-text" style="color:${weatherCodeColor2};">${dText}</div>
      ${dIconUrl}
      <span class="w-fc-temp-max" style="color:${maxTempColor2};">${dTempMax}</span>
      <span class="w-fc-temp-min" style="color:${minTempColor2};">${dTempMin}</span>
    </div>
    <div class="w-fc-details">
      \u{1F327}\uFE0F <span style="color:${rainColor2};">${dPrecipSum} (${dPrecipProb})</span><br>
      \u{1F4A7} ${dHumidity}<br>
      \u2600\uFE0F ${dSunshine}<br>
      <div style="margin-top:5px;display:flex;justify-content:center;gap:4px;">
        ${dMoonIcon}${dWindDirIcon}${dWindGustIcon}
      </div>
    </div>
  </div>`;
  }
  html += `
</div>
</div>`;
  return html;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  generateWeatherHtml
});
//# sourceMappingURL=widget_html_creator.js.map
