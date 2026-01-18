![Logo](admin/open-meteo.png)
# ioBroker.open-meteo-weather

[![NPM version](https://img.shields.io/npm/v/iobroker.open-meteo-weather.svg)](https://www.npmjs.com/package/iobroker.open-meteo-weather)
[![Downloads](https://img.shields.io/npm/dm/iobroker.open-meteo-weather.svg)](https://www.npmjs.com/package/iobroker.open-meteo-weather)
![Number of Installations](https://iobroker.live/badges/open-meteo-weather.svg)

[![NPM](https://nodei.co/npm/iobroker.open-meteo-weather.svg)](https://www.npmjs.com/package/iobroker.open-meteo-weather)

**Tests:**  ![Test and Release](https://github.com/H5N1v2/iobroker.open-meteo-weather/workflows/Test%20and%20Release/badge.svg)

**The Open-Meteo Weather Service Adapter for ioBroker.**

This adapter provides precise weather data, forecasts, air quality, and pollen information powered by [Open-Meteo.com](https://open-meteo.com/). It is free for non-commercial use (under 10,000 daily API calls) and requires no API key registration, making the setup process extremely simple.

---

## Features

* **Current Weather Data:** Real-time retrieval of temperature, humidity, air pressure, and wind data.
* **Flexible Forecasts:** Configurable number of forecast days and hourly resolution.
* **Air Quality & Pollen:** Optional data for particulate matter (PM2.5, PM10) as well as various pollen types (alder, birch, grass, etc.).
* **Automatic Cleanup:** The adapter automatically cleans up the object structure if forecast periods are shortened or changed in the configuration.
* **Multi-Language Support:** Supports 11 languages (including English, German, Polish, Russian, French, Chinese, etc.).
* **Unit System:** Seamless switching between Metric (°C, km/h) and Imperial (°F, mph) systems.
* **Multi Location:** Add multible Locations.

---

## Configuration

After installation, configure the following fields in the instance settings:

1.  **Location:** Add your Location or a name you want.
2.  **Coordinates (Latitude & Longitude):** Determine your location (you can find these on openstreetmap.org).
3.  **Update Interval:** Time interval in minutes (Default: 30 min).
4.  **Forecast Days:** Number of days for the daily overview (0–16 days).
5.  **Hourly Forecast:** Toggle and set the number of hours per day (e.g., the next 24 hours).
6.  **Optional Data:** Checkboxes for pollen and air quality data.
7.  **Units:** Choose between Metric and Imperial.

---

## Icons & Visualization

The adapter provides dynamic icon paths that can be used directly in visualizations such as **vis, iQontrol, or Jarvis**.

* **Weather Icons:** Found under `weather.current.icon_url`. The adapter automatically distinguishes between day and night (e.g., Sun vs. Moon).
* **Wind Direction:** Static paths under `wind_direction_icon` display a compass arrow corresponding to the degree value.
* **Wind Gust Warning:** A warning icon is displayed under `wind_gust_icon` for wind speeds above approx. 39 km/h (Bft 6), featuring levels 0–4.

---

## Data Points (Excerpt)

| Folder | Description |
|:---|:---|
| `weather.current` | Current measurements (Temp, Dew point, Wind, etc.) |
| `weather.forecast.dayX` | Daily forecast for Day X |
| `weather.forecast.hourly.dayX.hourY` | Hourly details per day |
| `air.current` | Air quality and pollen levels as text and value |

---
## Change Log
### 2.0.1 (2026-01-18)
* (H5N1v2) Fix wind direction icons

### 2.0.0 (2026-01-15)
* (H5N1v2) Major Feature: Migrated to a dynamic table-based location management (multi-location support).
* (H5N1v2) Major Feature: Implemented smart recursive cleanup logic for objects (locations, days, hours, air quality).
* (H5N1v2) Improved UI visibility for coordinates link.

### 1.2.1 (2026-01-13)
* (H5n1v2) Fix settings for adapter checker

### 1.2.0
* Updated internal project structure to latest standards; improved code stability and maintenance.

### 1.1.0
* Initial NPM release
* fix for air quality timestamps
* added icons for wind direction and storm warnings
* add some translations

## Legal & Copyright

### Icons & Images
The weather and wind direction icons included in this adapter are subject to the creator's copyright.
* **Usage:** These icons are licensed for use within ioBroker. Commercial redistribution or use outside of this adapter requires the explicit consent of the author: h5n1@iknox.de.
* **Weather Data:** All weather data is provided by [Open-Meteo.com](https://open-meteo.com/). Please review their terms of use for commercial purposes.

### License
This project is licensed under the **MIT License** - see the `LICENSE` file for details.

Copyright (c) 2026 H5N1v2 <h5n1@iknox.de>