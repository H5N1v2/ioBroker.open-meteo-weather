![Logo](admin/open-meteo.png)
# ioBroker.open-meteo-weather

[![NPM version](https://img.shields.io/npm/v/iobroker.open-meteo-weather.svg)](https://www.npmjs.com/package/iobroker.open-meteo-weather)
[![Downloads](https://img.shields.io/npm/dm/iobroker.open-meteo-weather.svg)](https://www.npmjs.com/package/iobroker.open-meteo-weather)
![Number of Installations](https://iobroker.live/badges/open-meteo-weather-installed.svg)

[![NPM](https://nodei.co/npm/iobroker.open-meteo-weather.svg?data=d)](https://www.npmjs.com/package/iobroker.open-meteo-weather)

![Test and Release](https://github.com/H5N1v2/iobroker.open-meteo-weather/workflows/Test%20and%20Release/badge.svg) 
![Libraries.io dependency status for latest release](https://img.shields.io/librariesio/release/npm/iobroker.open-meteo-weather?label=npm%20dependencies&style=flat-square) ![node-lts](https://img.shields.io/node/v-lts/iobroker.open-meteo-weather?style=flat-square)

**The Open-Meteo Weather Service Adapter for ioBroker.**

## First: If you are looking for a widget specifically for this adapter, then create it using [VIS2-widget-script-om-weather](https://github.com/H5N1v2/VIS2-widget-script-om-weather).

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

### Air Quality Data
Currently, only **real-time data (Current)** is supported. 

**Why no forecasts?** The Open-Meteo Air Quality API provides forecast data exclusively on an hourly basis. Processing and storing these large datasets (168+ data points per variable) would result in a disproportionately high system and database load. To keep the adapter lightweight and performant, hourly forecasts are currently omitted. 

*Note: As soon as the API provider offers native daily aggregates, this feature will be integrated.*

---

## Configuration

After installation, configure the following fields in the instance settings:

1.  **Location:** Add your Location or a name you want.
2.  **Coordinates (Latitude & Longitude):** Determine your location (you can find these on openstreetmap.org).
3.  **Update Interval:** Time interval in minutes (Default: 30 min).
4.  **Forecast Days:** Number of days for the daily overview (0–16 days).
5.  **Hourly Forecast:** Enable or disable this option and set the number of hours (e.g., the next 24 hours). For example, hour0 is the current hour, hour1 is the next hour, and so on.
6.  **Optional Data:** Checkboxes for pollen and air quality data.
7.  **Units:** Choose between Metric and Imperial.

---

## Icons & Visualization

The adapter provides dynamic icon paths that can be used directly in visualizations such as **vis, iQontrol, or Jarvis**.

* **Weather Icons:** Found under `weather.current.icon_url`. The adapter automatically distinguishes between day and night (e.g., Sun vs. Moon).
* **Wind Direction:** Static paths under `wind_direction_icon` display a compass arrow corresponding to the degree value.
* **Wind Gust Warning:** A warning icon is displayed under `wind_gust_icon` for wind speeds above approx. 39 km/h (Bft 6), featuring levels 0–4.
* **Moon Phases Icons:** Moon icons can be found under `moon_phase_icon` they display the moon phases.

---

## Data Points (Excerpt)

| Folder | Description |
|:---|:---|
| `weather.current` | Current measurements (Temp, Dew point, Wind, etc.) |
| `weather.forecast.dayX` | Daily forecast for Day X |
| `weather.forecast.hourly.hourX` | Hourly details per full hour |
| `air.current` | Air quality and pollen levels as text and value |

---

## Update note

After a new adapter update, it is recommended to delete the entire directory tree and let it be recreated.

## Change Log
### 2.2.5 (2026-02-07)
* (H5N1v2) Nitrogen dioxide (NO2) datapoint added to the air quality data, user request.
* (H5N1v2) Added new datapoints for "global_tilted_irradiance" & "et0_fao_evapotranspiration" in hourlyX and "et0_fao_evapotranspiration_sum" in dailyX.
* (H5N1v2) Some Log-messages translated in main.ts
* (H5N1v2) Corrected setStateAsync to setState in main.ts
* (H5N1v2) fix: update forecast hours handling.
* (H5N1v2) Added an info folder with a last_update data point to check when the last update was performed.

### 2.2.4 (2026-02-06)
* (H5N1v2) fix: update snow depth unit from cm to m in metric unit map
* (H5N1v2) add: precipitation in hourly & precipitation_sum (snow,rain,showers) in daily.
* (H5N1v2) Implemented state caching to reduce redundant database I/O operations.
* (H5N1v2) Optimized socket management with explicit connection handling and timeouts.
* (H5N1v2) Refactored update logic for better resource management

### 2.2.3 (2026-02-03)
* (wg25 iob-forum) Fix: In the hourly forecast, all hours were incorrectly inheriting the date from the last "day".*
* (wg25 iob-forum) Fix: Corrected name_day for day0. Previously, it was hardcoded as "Today" (a legacy remnant). It now correctly displays the actual day of the week.
* (H5N1v2) Updated hours*: Split date and time into separate data points ("date" and "time") based on user feedback.
* (H5N1v2) Added 'date' key with translations to all translation files.

### 2.2.2 (2026-01-30)
* (H5N1v2) fix: update js-controller and admin dependencies to latest versions
* (H5N1v2) fix: add missing responsive breakpoints in jsonConfig
* (H5N1v2) fix: Chinese translations files & correct import path for Chinese translations
* (H5N1v2) fix: add missing translation for precipitation probability to the translations
* (H5N1v2) fix: Adjusted the creation of hourly state icons to account for day/night conditions.
* (H5N1v2) add: Added debug logs to track the execution flow and data processing for better traceability.
* (H5N1v2) Enhance performance and readability by caching translations, unit maps, and imperial settings.
* (H5N1v2) Refactor icon retrieval methods for wind direction and moon phases, optimize cleanup logic for deleted locations, improve state creation and updating with consistent translation handling.

### 2.2.1 (2026-01-26)
* (H5N1v2) fix: Correct quotation marks for relative humidity translation in French

### 2.2.0 (2026-01-26)
* (H5N1v2) add unit translations for improved localization in weather data
* (H5N1v2) add additional pollen units and translations to unit maps
* (H5N1v2) add carbon monoxide, dust, olive pollen, and ozone in air quality & translations
* (H5N1v2) refactor weather data fetching to use constants for parameter keys
* (H5N1v2) remove unused dependencies and scripts
* (H5N1v2) add image for wind warning

### 2.1.0 (2026-01-18)
* (H5N1v2) add module suncalc
* (H5N1v2) add Moon Phase value, text and icon url datapoints 
* (H5N1v2) add Moon Phase icons 
* (H5N1v2) add translations for Moon Phases
* (H5N1v2) Changed location for weather icons for better overview

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