import * as utils from '@iobroker/adapter-core';
import { weatherTranslations } from './lib/words';
import { translations } from './i18n';
import { fetchAllWeatherData } from './lib/api_caller';
import { unitMapMetric, unitMapImperial, unitTranslations } from './lib/units';
import * as SunCalc from 'suncalc';

class OpenMeteoWeather extends utils.Adapter {
	private updateInterval: ioBroker.Interval | undefined = undefined;
	private systemLang: string = 'de';
	private systemTimeZone: string = 'Europe/Berlin';

	// Cached values für Performance
	private cachedTranslations: any = null;
	private cachedUnitMap: any = null;
	private cachedIsImperial: boolean = false;

	// Objekt-Caching für bereits erstellte States (verhindert redundante DB-Zugriffe)
	private createdObjects = new Set<string>();

	// Update-Sperre um Überschneidungen zu verhindern
	private isUpdating = false;

	// Konstanten für Icon-Mapping
	private readonly WIND_DIRECTION_FILES = [
		'n.png',
		'no.png',
		'o.png',
		'so.png',
		's.png',
		'sw.png',
		'w.png',
		'nw.png',
	];
	private readonly MOON_PHASE_ICONS: Record<string, string> = {
		new_moon: 'nm.png',
		waxing_crescent: 'zsm.png',
		first_quarter: 'ev.png',
		waxing_gibbous: 'zdm.png',
		full_moon: 'vm.png',
		waning_gibbous: 'adm.png',
		last_quarter: 'lv.png',
		waning_crescent: 'asm.png',
	};

	// Initialisiert die Basisklasse des Adapters
	constructor(options: Partial<utils.AdapterOptions> = {}) {
		super({ ...options, name: 'open-meteo-weather' });
		this.on('ready', this.onReady.bind(this));
		this.on('unload', this.onUnload.bind(this));
	}

	// Holt die passende Übersetzung für Objektnamen aus den i18n Dateien
	private getTranslation(key: string): string {
		if (!translations) {
			return key;
		}
		return translations[this.systemLang]?.[key] || translations.en?.[key] || key;
	}

	// Wandelt Gradzahlen in Himmelsrichtungen als Text um
	private getWindDirection(deg: number): string {
		const directions = this.cachedTranslations.dirs || ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW'];
		const index = Math.round(deg / 45) % 8;
		return directions[index];
	}

	// Liefert den Pfad zum passenden Icon für die Windrichtung
	private getWindDirectionIcon(deg: number): string {
		const index = Math.round(deg / 45) % 8;
		return `/adapter/${this.name}/icons/wind_direction_icons/${this.WIND_DIRECTION_FILES[index]}`;
	}

	// Ermittelt basierend auf der Mondphase das passende Icon
	private getMoonPhaseIcon(phaseKey: string): string {
		const fileName = this.MOON_PHASE_ICONS[phaseKey] || 'nm.png';
		return `/adapter/${this.name}/icons/moon_phases/${fileName}`;
	}

	// Ermittelt basierend auf der Windgeschwindigkeit das passende Warn-Icon
	private getWindGustIcon(gusts: number): string {
		const factor = this.cachedIsImperial ? 1.60934 : 1;

		if (gusts < 39 / factor) {
			return `/adapter/${this.name}/icons/wind_icons/z.png`;
		}
		if (gusts < 50 / factor) {
			return `/adapter/${this.name}/icons/wind_icons/0.png`;
		}
		if (gusts < 62 / factor) {
			return `/adapter/${this.name}/icons/wind_icons/1.png`;
		}
		if (gusts < 75 / factor) {
			return `/adapter/${this.name}/icons/wind_icons/2.png`;
		}
		if (gusts < 89 / factor) {
			return `/adapter/${this.name}/icons/wind_icons/3.png`;
		}
		return `/adapter/${this.name}/icons/wind_icons/4.png`;
	}

	// Errechnet den Taupunkt unter Berücksichtigung der eingestellten Maßeinheit
	private calculateDewPoint(temp: number, humidity: number): number {
		const t = this.cachedIsImperial ? ((temp - 32) * 5) / 9 : temp;
		const rh = humidity / 100;
		const a = 17.625;
		const b = 243.04;
		const alpha = Math.log(rh) + (a * t) / (b + t);
		let dewPoint = (b * alpha) / (a - alpha);
		if (this.cachedIsImperial) {
			dewPoint = (dewPoint * 9) / 5 + 32;
		}
		return parseFloat(dewPoint.toFixed(1));
	}

	// Setzt die Grundeinstellungen beim Start und startet den Update-Zyklus
	private async onReady(): Promise<void> {
		this.log.debug('onReady: Adapter starting...');
		try {
			const sysConfig = await this.getForeignObjectAsync('system.config');
			if (sysConfig && sysConfig.common) {
				this.systemLang = sysConfig.common.language || 'de';
				this.systemTimeZone = (sysConfig.common as any).timezone || 'Europe/Berlin';
				this.log.debug(`onReady: System language: ${this.systemLang}, Timezone: ${this.systemTimeZone}`);
			}

			// Cache häufig verwendete Werte
			const config = this.config as any;
			this.cachedIsImperial = config.isImperial || false;
			this.cachedUnitMap = this.cachedIsImperial ? unitMapImperial : unitMapMetric;
			this.cachedTranslations = weatherTranslations[this.systemLang] || weatherTranslations.de;

			// Cleanup veralteter Standorte
			await this.cleanupDeletedLocations();

			// Info-Datenpunkt für letztes Update erstellen
			await this.extendObject('info.lastUpdate', {
				type: 'state',
				common: {
					name: 'Last Update',
					type: 'string',
					role: 'text',
					read: true,
					write: false,
				},
				native: {},
			});
		} catch (err: any) {
			this.log.error(`Initialization failed: ${err.message}`);
		}

		await this.updateData();
		const config = this.config as any;
		const minutes = parseInt(config.updateInterval) || 30;
		const intervalMs = minutes * 60000;

		this.updateInterval = this.setInterval(() => this.updateData(), intervalMs);
		this.log.debug(`onReady: Scheduled update every ${minutes} minutes.`);
	}

	private async cleanupDeletedLocations(): Promise<void> {
		this.log.debug('cleanupDeletedLocations: Starting cleanup check...');
		const config = this.config as any;
		const locations = config.locations || [];
		// Set für O(1) Lookup-Performance statt O(n) mit Array.includes
		const validFolders = new Set(locations.map((loc: any) => loc.name.replace(/[^a-zA-Z0-9]/g, '_')));

		const forecastDays = parseInt(config.forecastDays) || 1;
		const forecastHoursEnabled = config.forecastHoursEnabled || false;
		const airQualityEnabled = config.airQualityEnabled || false;
		const hoursLimit = parseInt(config.forecastHours) || 24;

		const allObjects = await this.getAdapterObjectsAsync();
		let deletedCount = 0;

		for (const objId in allObjects) {
			const parts = objId.split('.');
			if (parts.length > 2) {
				const folderName = parts[2]; // Der Stadt-Ordner

				// 1. Ganze Stadt gelöscht?
				if (!validFolders.has(folderName)) {
					this.log.info(`Lösche veralteten Standort: ${folderName}`);
					await this.delObjectAsync(objId, { recursive: true });
					deletedCount++;
					continue;
				}

				// 2. Luftqualität deaktiviert?
				if (!airQualityEnabled && objId.includes(`${folderName}.air`)) {
					await this.delObjectAsync(objId, { recursive: true });
					deletedCount++;
					continue;
				}

				// 3. Stündliche Vorhersage komplett deaktiviert?
				if (!forecastHoursEnabled && objId.includes(`${folderName}.weather.forecast.hourly`)) {
					await this.delObjectAsync(objId, { recursive: true });
					deletedCount++;
					continue;
				}

				// 4. Entfernt

				// 5. Zu viele normale Vorhersage-Tage? (dayX außerhalb von hourly)
				if (objId.includes(`${folderName}.weather.forecast.day`) && !objId.includes('.hourly.')) {
					const dayMatch = objId.match(/\.day(\d+)/);
					if (dayMatch) {
						const dayNum = parseInt(dayMatch[1]);
						if (dayNum >= forecastDays) {
							await this.delObjectAsync(objId, { recursive: true });
							deletedCount++;
							continue;
						}
					}
				}

				// 6. Zu viele Stunden pro Tag?
				if (forecastHoursEnabled && objId.includes('.hourly.next_hours.hour')) {
					const hourMatch = objId.match(/\.hour(\d+)/);
					if (hourMatch) {
						const hourNum = parseInt(hourMatch[1]);
						if (hourNum >= hoursLimit) {
							await this.delObjectAsync(objId, { recursive: true });
							deletedCount++;
							continue;
						}
					}
				}
			}
		}
		this.log.debug(`cleanupDeletedLocations: Finished. Objects deleted: ${deletedCount}`);
	}

	// Steuert den Abruf der Wetterdaten und verteilt sie an die Verarbeitungsfunktionen
	private async updateData(): Promise<void> {
		// Überschneidungsschutz: Wenn bereits ein Update läuft, abbrechen
		if (this.isUpdating) {
			this.log.warn('Update skipped: Previous update is still running.');
			return;
		}

		this.isUpdating = true;
		this.log.debug('updateData: Starting data fetch for all locations...');

		try {
			const config = this.config as any;
			const locations = config.locations;

			if (!locations || !Array.isArray(locations) || locations.length === 0) {
				this.log.warn('No locations configured.');
				return;
			}

			for (const loc of locations) {
				const folderName = loc.name.replace(/[^a-zA-Z0-9]/g, '_');
				this.log.debug(`updateData: Fetching data for ${loc.name} (${loc.latitude}/${loc.longitude})`);

				const data = await fetchAllWeatherData(
					{
						latitude: loc.latitude,
						longitude: loc.longitude,
						forecastDays: config.forecastDays || 7,
						forecastHours: config.forecastHours || 1,
						forecastHoursEnabled: config.forecastHoursEnabled || false,
						airQualityEnabled: config.airQualityEnabled || false,
						timezone: loc.timezone || this.systemTimeZone,
						isImperial: config.isImperial || false,
					},
					this.log,
				);

				if (data.weather) {
					this.log.debug(`updateData: Processing weather for ${folderName}`);
					await this.processWeatherData(data.weather, folderName, loc.latitude, loc.longitude);
				}
				if (data.hourly) {
					this.log.debug(`updateData: Processing hourly forecast for ${folderName}`);
					await this.processForecastHoursData(data.hourly, folderName);
				}
				if (data.air) {
					this.log.debug(`updateData: Processing air quality for ${folderName}`);
					await this.processAirQualityData(data.air, folderName);
				}
			}
			this.log.debug('updateData: All locations processed successfully.');

			// Zeitstempel für letztes Update setzen
			const now = new Date();
			const day = String(now.getDate()).padStart(2, '0');
			const month = String(now.getMonth() + 1).padStart(2, '0');
			const year = now.getFullYear();
			const hours = String(now.getHours()).padStart(2, '0');
			const minutes = String(now.getMinutes()).padStart(2, '0');
			const seconds = String(now.getSeconds()).padStart(2, '0');
			const timestamp = `${day}.${month}.${year}, ${hours}:${minutes}:${seconds}`;
			await this.setState('info.lastUpdate', { val: timestamp, ack: true });
		} catch (error: any) {
			this.log.error(`Retrieval failed: ${error.message}`);
		} finally {
			// Update-Sperre immer freigeben, auch bei Fehler
			this.isUpdating = false;
		}
	}

	// Verarbeitet aktuelle Wetterdaten sowie die tägliche Vorhersage inkl. lokaler Monddaten
	private async processWeatherData(data: any, locationPath: string, lat: number, lon: number): Promise<void> {
		const t = this.cachedTranslations;

		if (data.current) {
			const isDay = data.current.is_day;
			const root = `${locationPath}.weather.current`;

			if (
				typeof data.current.temperature_2m === 'number' &&
				typeof data.current.relative_humidity_2m === 'number'
			) {
				const dp = this.calculateDewPoint(data.current.temperature_2m, data.current.relative_humidity_2m);
				await this.extendOrCreateState(`${root}.dew_point_2m`, dp, 'dew_point_2m');
			}

			for (const key in data.current) {
				let val = data.current[key];
				if (key === 'time' && typeof val === 'string') {
					val = new Date(val).toLocaleString(this.systemLang, {
						day: '2-digit',
						month: '2-digit',
						year: 'numeric',
						hour: '2-digit',
						minute: '2-digit',
						hour12: this.systemLang === 'en',
					});
				}
				await this.extendOrCreateState(`${root}.${key}`, val, key);

				if (key === 'weather_code') {
					await this.createCustomState(`${root}.weather_text`, t.codes[val] || '?', 'string', 'text', '');
					await this.createCustomState(
						`${root}.icon_url`,
						`/adapter/${this.name}/icons/weather_icons/${val}${isDay === 1 ? '' : 'n'}.png`,
						'string',
						'url',
						'',
					);
				}
				if (key === 'wind_direction_10m' && typeof val === 'number') {
					await this.createCustomState(
						`${root}.wind_direction_text`,
						this.getWindDirection(val),
						'string',
						'text',
						'',
					);
					await this.createCustomState(
						`${root}.wind_direction_icon`,
						this.getWindDirectionIcon(val),
						'string',
						'url',
						'',
					);
				}
				if (key === 'wind_gusts_10m' && typeof val === 'number') {
					await this.createCustomState(
						`${root}.wind_gust_icon`,
						this.getWindGustIcon(val),
						'string',
						'url',
						'',
					);
				}
			}
		}

		if (data.daily) {
			for (let i = 0; i < (data.daily.time?.length || 0); i++) {
				const dayPath = `${locationPath}.weather.forecast.day${i}`;

				// Berechnung der Monddaten für diesen Tag (lokal via SunCalc)
				const forecastDate = new Date(data.daily.time[i]);
				const moonTimes = SunCalc.getMoonTimes(forecastDate, lat, lon);
				const moonIllumination = SunCalc.getMoonIllumination(forecastDate);

				// Mondaufgang und -untergang formatieren
				const mRise = moonTimes.rise
					? moonTimes.rise.toLocaleTimeString(this.systemLang, {
							hour: '2-digit',
							minute: '2-digit',
							hour12: this.systemLang === 'en',
						})
					: '--:--';
				const mSet = moonTimes.set
					? moonTimes.set.toLocaleTimeString(this.systemLang, {
							hour: '2-digit',
							minute: '2-digit',
							hour12: this.systemLang === 'en',
						})
					: '--:--';

				await this.createCustomState(`${dayPath}.moonrise`, mRise, 'string', 'value', '');
				await this.createCustomState(`${dayPath}.moonset`, mSet, 'string', 'value', '');

				// Mondphase in Text umwandeln (nutzt Übersetzung aus words.ts)
				const phaseValue = moonIllumination.phase;
				let phaseKey = 'new_moon';
				if (phaseValue >= 0.03 && phaseValue < 0.22) {
					phaseKey = 'waxing_crescent';
				} else if (phaseValue >= 0.22 && phaseValue < 0.28) {
					phaseKey = 'first_quarter';
				} else if (phaseValue >= 0.28 && phaseValue < 0.47) {
					phaseKey = 'waxing_gibbous';
				} else if (phaseValue >= 0.47 && phaseValue < 0.53) {
					phaseKey = 'full_moon';
				} else if (phaseValue >= 0.53 && phaseValue < 0.72) {
					phaseKey = 'waning_gibbous';
				} else if (phaseValue >= 0.72 && phaseValue < 0.78) {
					phaseKey = 'last_quarter';
				} else if (phaseValue >= 0.78 && phaseValue < 0.97) {
					phaseKey = 'waning_crescent';
				}

				const phaseText = t.moon_phases ? t.moon_phases[phaseKey] : phaseKey;
				await this.createCustomState(`${dayPath}.moon_phase_text`, phaseText, 'string', 'text', '');
				await this.createCustomState(
					`${dayPath}.moon_phase_val`,
					parseFloat(phaseValue.toFixed(2)),
					'number',
					'value',
					'',
				);

				// Erstellt die Icon-URL für die Mondphase
				await this.createCustomState(
					`${dayPath}.moon_phase_icon`,
					this.getMoonPhaseIcon(phaseKey),
					'string',
					'url',
					'',
				);

				// Name des Tages: Wochentag
				const nameDay = forecastDate.toLocaleDateString(this.systemLang, { weekday: 'long' });
				await this.createCustomState(`${dayPath}.name_day`, nameDay, 'string', 'text', '');

				for (const key in data.daily) {
					let val = data.daily[key][i];
					if (key === 'time' && typeof val === 'string') {
						val = new Date(val).toLocaleDateString(this.systemLang, {
							day: '2-digit',
							month: '2-digit',
							year: 'numeric',
						});
					}
					if (key === 'sunshine_duration' && typeof val === 'number') {
						val = parseFloat((val / 3600).toFixed(2));
					}
					if ((key === 'sunrise' || key === 'sunset') && typeof val === 'string') {
						val = new Date(val).toLocaleTimeString(this.systemLang, {
							hour: '2-digit',
							minute: '2-digit',
							hour12: this.systemLang === 'en',
						});
					}

					await this.extendOrCreateState(`${dayPath}.${key}`, val, key);

					if (key === 'wind_direction_10m_dominant' && typeof val === 'number') {
						await this.createCustomState(
							`${dayPath}.wind_direction_text`,
							this.getWindDirection(val),
							'string',
							'text',
							'',
						);
						await this.createCustomState(
							`${dayPath}.wind_direction_icon`,
							this.getWindDirectionIcon(val),
							'string',
							'url',
							'',
						);
					}
					if (key === 'wind_gusts_10m_max' && typeof val === 'number') {
						await this.createCustomState(
							`${dayPath}.wind_gust_icon`,
							this.getWindGustIcon(val),
							'string',
							'url',
							'',
						);
					}
					if (key === 'weather_code') {
						await this.createCustomState(
							`${dayPath}.weather_text`,
							t.codes[val] || '?',
							'string',
							'text',
							'',
						);
						await this.createCustomState(
							`${dayPath}.icon_url`,
							`/adapter/${this.name}/icons/weather_icons/${val}.png`,
							'string',
							'url',
							'',
						);
					}
				}
			}
		}
	}

	// Verarbeitet die stündlichen Vorhersagedaten
	private async processForecastHoursData(data: any, locationPath: string): Promise<void> {
		const t = this.cachedTranslations;
		const config = this.config as any;
		const hoursPer_h_Limit = parseInt(config.forecastHours) || 24;

		if (data.hourly && data.hourly.time) {
			const isDay = data.hourly.is_day;
			for (let i = 0; i < data.hourly.time.length; i++) {
				if (i < hoursPer_h_Limit) {
					const hourPath = `${locationPath}.weather.forecast.hourly.next_hours.hour${i}`;
					for (const key in data.hourly) {
						let val = data.hourly[key][i];
						if (key === 'time' && typeof val === 'string') {
							const dateObj = new Date(val);
							// Datum in separaten Datenpunkt
							const lang = this.systemLang || 'de';
							const dateVal = dateObj.toLocaleDateString(lang, {
								day: '2-digit',
								month: '2-digit',
								year: 'numeric',
							});
							await this.extendOrCreateState(`${hourPath}.date`, dateVal, 'date');
							// Zeit (nur Uhrzeit)
							val = dateObj.toLocaleTimeString(this.systemLang, {
								hour: '2-digit',
								minute: '2-digit',
								hour12: this.systemLang === 'en',
							});
						}
						if (key === 'sunshine_duration' && typeof val === 'number') {
							val = parseFloat((val / 3600).toFixed(2));
						}
						await this.extendOrCreateState(`${hourPath}.${key}`, val, key);

						if (key === 'weather_code') {
							await this.createCustomState(
								`${hourPath}.weather_text`,
								t.codes[val] || '?',
								'string',
								'text',
								'',
							);
							const currentIsDayh = isDay ? isDay[i] : 1;
							await this.createCustomState(
								`${hourPath}.icon_url`,
								`/adapter/${this.name}/icons/weather_icons/${val}${currentIsDayh === 1 ? '' : 'n'}.png`,
								'string',
								'url',
								'',
							);
						}
						if (key === 'wind_direction_10m' && typeof val === 'number') {
							await this.createCustomState(
								`${hourPath}.wind_direction_text`,
								this.getWindDirection(val),
								'string',
								'text',
								'',
							);
							await this.createCustomState(
								`${hourPath}.wind_direction_icon`,
								this.getWindDirectionIcon(val),
								'string',
								'url',
								'',
							);
						}
						if (key === 'wind_gusts_10m' && typeof val === 'number') {
							await this.createCustomState(
								`${hourPath}.wind_gust_icon`,
								this.getWindGustIcon(val),
								'string',
								'url',
								'',
							);
						}
					}
				}
			}
		}
	}

	// Verarbeitet Daten zur Luftqualität und Pollenbelastung
	private async processAirQualityData(data: any, locationPath: string): Promise<void> {
		const t = this.cachedTranslations;
		if (data.current) {
			const root = `${locationPath}.air.current`;
			for (const key in data.current) {
				let val = data.current[key];
				if (key === 'time' && typeof val === 'string') {
					val = new Date(val).toLocaleString(this.systemLang, {
						day: '2-digit',
						month: '2-digit',
						year: 'numeric',
						hour: '2-digit',
						minute: '2-digit',
						hour12: this.systemLang === 'en',
					});
				}
				await this.extendOrCreateState(`${root}.${key}`, val, key);
				if (key.includes('pollen')) {
					const valPollen = data.current[key];
					const pollenText =
						valPollen > 2
							? t.pollen.high
							: valPollen > 1
								? t.pollen.moderate
								: valPollen > 0
									? t.pollen.low
									: t.pollen.none;
					await this.createCustomState(`${root}.${key}_text`, pollenText, 'string', 'text', '');
				}
			}
		}
	}

	// Erstellt einen neuen Datenpunkt mit benutzerdefinierter Rolle und Einheit
	private async createCustomState(
		id: string,
		val: any,
		type: ioBroker.CommonType,
		role: string,
		unit: string,
	): Promise<void> {
		// Objekt-Caching: Nur erstellen, wenn noch nicht im Set vorhanden
		if (!this.createdObjects.has(id)) {
			this.log.debug(`createCustomState: Creating state ${id} (role: ${role})`);
			const idParts = id.split('.');
			const lastPart = idParts[idParts.length - 1] || id;
			await this.setObjectNotExistsAsync(id, {
				type: 'state',
				common: {
					name: this.getTranslation(lastPart),
					type,
					role,
					read: true,
					unit: unit ? (unitTranslations[this.systemLang]?.[unit] ?? unit) : unit,
					write: false,
				},
				native: {},
			});
			this.createdObjects.add(id);
		}
		await this.setState(id, { val, ack: true });
	}

	// Erstellt oder aktualisiert einen Datenpunkt und weist automatisch Einheiten zu
	private async extendOrCreateState(id: string, val: any, translationKey?: string): Promise<void> {
		// Objekt-Caching: Nur erstellen, wenn noch nicht im Set vorhanden
		if (!this.createdObjects.has(id)) {
			let unit = '';
			for (const k in this.cachedUnitMap) {
				if (id.includes(k)) {
					unit = this.cachedUnitMap[k];
					break;
				}
			}
			const displayUnit = unit ? (unitTranslations[this.systemLang]?.[unit] ?? unit) : unit;
			this.log.debug(`extendOrCreateState: Creating state ${id} (unit: ${displayUnit})`);
			const idParts = id.split('.');
			const lastPart = idParts[idParts.length - 1] || id;
			await this.setObjectNotExistsAsync(id, {
				type: 'state',
				common: {
					name: this.getTranslation(translationKey || lastPart),
					type: typeof val as any,
					role: 'value',
					read: true,
					write: false,
					unit: displayUnit,
				},
				native: {},
			});
			this.createdObjects.add(id);
		}
		await this.setState(id, { val, ack: true });
	}

	// Bereinigt Intervalle beim Beenden des Adapters
	private onUnload(callback: () => void): void {
		this.log.debug('onUnload: Cleaning up intervals.');
		if (this.updateInterval) {
			this.clearInterval(this.updateInterval);
		}
		callback();
	}
}

if (require.main !== module) {
	module.exports = (options: Partial<utils.AdapterOptions> | undefined) => new OpenMeteoWeather(options);
} else {
	new OpenMeteoWeather();
}
