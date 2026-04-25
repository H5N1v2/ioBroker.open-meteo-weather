## CHANGELOG OLD

## 2.6.1 (2026-03-04)
* (H5N1v2) chore: update dependencies to latest versions
* (mcm1957) fix: axios seems to be missing in dependencies
* (mcm1957) fix: language used for stateIds and names
* (mcm1957) fix: creation of intermediate objects missing

[OLDER CHANGELOG](CHANGELOG_OLD.md)

### 2.6.0 (2026-02-19)
* (H5N1v2) feat: Leave latitude and longitude empty to use system coordinates in settings. 
* (H5N1v2) feat: Added dropdown menu for timezones in settings.

### 2.5.1 (2026-02-17)
* (oFbEQnpoLKKl6mbY5e13) Fix: The Icon 61n.png is not displayed and is in the wrong folder.
* (H5N1) chore: update dependencies to latest versions

### 2.5.0 (2026-02-15)
* (H5N1v2) New: Added "Bright Night Icons" option. You can now choose between dark and bright icons for better visibility on different backgrounds.
* (H5N1v2) New: Added new icon set directory /admin/icons/night_bright/ for enhanced night-time visualization.
* (H5N1v2) New: Move night icons from /admin/icons/weather_icons to /admin/icons/night_dark.
* (H5N1v2) Fix: Updated AdapterConfig types to support new configuration fields.
* (H5N1v2) Fix: Improved icon path logic for current weather and hourly forecasts.

### 2.4.1 (2026-02-14)
* (H5N1v2) chore: update dependencies to latest versions.
* (H5N1v2) add link to Widget in instanz configuration.

### 2.4.0 (2026-02-11)
* (H5N1v2) fix: adjust moon phase calculation for accurate phase key assignment
* (H5N1v2) chore: update dependencies
* (H5N1v2) Added option to choose between wind direction (destination) and wind origin (source) icons in Admin.
* (H5N1v2) New subfolder structure for alternative wind icons (direct_2).

### 2.3.0 (2026-02-09)
* (H5N1v2) Added: Daily air quality & pollen aggregation (configurable 1, 3, or 6 days).
* (H5N1v2) Added: Human-readable text mapping for pollen levels (None, Low, Moderate, High).
* (H5N1v2) Added: Weekday names (name_day) for air quality forecast days.
* (H5N1v2) Changed: Optimized object tree – only daily peak values are stored instead of bulky hourly data.
* (H5N1v2) Changed: Improved cleanup logic – obsolete forecast objects are automatically removed.

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