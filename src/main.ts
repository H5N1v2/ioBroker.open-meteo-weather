import * as utils from '@iobroker/adapter-core';
import { weatherTranslations } from './lib/words';
import { translations } from './i18n';
import { fetchAllWeatherData } from './lib/api_caller';
import { PVService } from './lib/pv-service';
import { unitMapMetric, unitMapImperial, unitTranslations } from './lib/units';
import { getRole } from './lib/role_mapping';
import * as SunCalc from 'suncalc';

class OpenMeteoWeather extends utils.Adapter {
	private updateInterval: ioBroker.Interval | undefined = undefined;
	private pvService: PVService | undefined = undefined;
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

	// System-Koordinaten aus ioBroker-Systemkonfiguration
	private systemLatitude: number | null = null;
	private systemLongitude: number | null = null;

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
	private getI18nObject(key: string): ioBroker.StringOrTranslated {
		const obj: any = {};
		for (const lang in translations) {
			obj[lang] = translations[lang][key] || translations.en[key] || key;
		}
		return obj;
	}

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
		const useDirect2 = this.config.isWinddirection_icon;
		const subFolder = useDirect2 ? 'direct_2/' : '';
		return `/adapter/${this.name}/icons/wind_direction_icons/${subFolder}${this.WIND_DIRECTION_FILES[index]}`;
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
				const sysLat = (sysConfig.common as any).latitude;
				const sysLon = (sysConfig.common as any).longitude;
				if (sysLat != null && sysLat !== '' && sysLon != null && sysLon !== '') {
					this.systemLatitude = parseFloat(sysLat);
					this.systemLongitude = parseFloat(sysLon);
				}
				this.log.debug(`onReady: System language: ${this.systemLang}, Timezone: ${this.systemTimeZone}`);
			}
			await this.extendForeignObjectAsync(this.namespace, {
				type: 'meta',
				common: {
					name: {
						en: 'Open-Meteo Weather Service',
						de: 'Open-Meteo Wetterdienst',
						pl: 'Usługa pogodowa Open-Meteo',
						ru: 'Сервис погоды Open-Meteo',
						it: 'Servizio meteo Open-Meteo',
						es: 'Servicio meteorológico Open-Meteo',
						'zh-cn': 'Open-Meteo 天气服务',
						fr: 'Service météo Open-Meteo',
						pt: 'Serviço meteorológico Open-Meteo',
						nl: 'Open-Meteo Weerdienst',
						uk: 'Сервіс погоди Open-Meteo',
					},
					type: 'meta.user',
				},
			});

			// Cache häufig verwendete Werte
			const config = this.config as any;
			this.cachedIsImperial = config.isImperial || false;
			this.cachedUnitMap = this.cachedIsImperial ? unitMapImperial : unitMapMetric;
			this.cachedTranslations = weatherTranslations[this.systemLang] || weatherTranslations.de;

			// Cleanup veralteter Standorte
			await this.cleanupDeletedLocations();

			// Info-Datenpunkt für letztes Update erstellen
			await this.setObjectNotExistsAsync('info', {
				type: 'channel',
				common: {
					name: {
						en: 'Information',
						de: 'Information',
						pl: 'Informacja',
						ru: 'Информация',
						it: 'Informazione',
						es: 'Información',
						'zh-cn': '信息',
						fr: 'Information',
						pt: 'Informação',
						nl: 'Informatie',
						uk: 'Інформація',
					},
				},
				native: {},
			});

			// 2. Den Datenpunkt lastUpdate erstellen
			await this.extendObject('info.lastUpdate_weather', {
				type: 'state',
				common: {
					name: {
						en: 'Last Update Weather Data',
						de: 'Letztes Update Wetterdaten',
						pl: 'Ostatnia aktualizacja danych pogodowych',
						ru: 'Последнее обновление данных о погоде',
						it: 'Ultimo aggiornamento dati meteo',
						es: 'Última actualización de datos meteorológicos',
						'zh-cn': '最后更新天气数据',
						fr: 'Dernière mise à jour des données météorologiques',
						pt: 'Última atualização dos dados meteorológicos',
						nl: 'Laatste update van de weersgegevens',
						uk: 'Останнє оновлення даних про погоду',
					},
					type: 'string',
					role: 'date',
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

		if (this.config.enablePV) {
			this.log.info('PV Service is enabled, initializing...');
			try {
				const pvService = new PVService(this);
				await pvService.init();
			} catch (err: any) {
				this.log.error(`Failed to initialize PV Service: ${err}`);
			}
		} else {
			// PV-Cleanup if PV is disabled
			this.log.info('PV Service is disabled, checking for cleanup...');
			try {
				await this.delObjectAsync('pv-forecast', { recursive: true });
				await this.delObjectAsync('info.lastUpdate_PV_Forecast');
				this.log.debug('PV-Forecast data points cleaned up.');
			} catch {
				//silent catch
			}
		}
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
				const folderName = parts[2];

				// 1. Ganze Stadt gelöscht?
				if (folderName === 'pv-forecast' || folderName === 'info') {
					continue;
				}
				if (!validFolders.has(folderName)) {
					this.log.info(`Delete outdated location:: ${folderName}`);
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

				// Punkt 5b: Zu viele Luftqualitäts-Vorhersage-Tage? ---
				if (objId.includes(`${folderName}.air.forecast.day`)) {
					const aqDayMatch = objId.match(/\.day(\d+)/);
					if (aqDayMatch) {
						const aqDayNum = parseInt(aqDayMatch[1]);
						// Holen des Limits aus der Config (0 wenn deaktiviert oder nicht gesetzt)
						const aqLimit = airQualityEnabled ? parseInt(config.airQualityForecastDays) || 0 : 0;

						if (aqDayNum >= aqLimit) {
							this.log.info(
								`Bereinige veralteten Luftqualitäts-Vorhersagetag: ${folderName}.air.forecast.day${aqDayNum}`,
							);
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
				if (!this.config.enablePV) {
					this.log.warn(
						'No locations configured. Please add at least one weather location or enable PV-Forecast.',
					);
				} else {
					this.log.debug('Skipping weather update because no locations are defined (PV-Forecast is active).');
					await this.delObjectAsync('info.lastUpdate_weather');
				}
				return;
			}

			for (const loc of locations) {
				const folderName = loc.name.replace(/[^a-zA-Z0-9]/g, '_');

				// 1. Das Gerät (Device) für den Standort
				await this.setObjectNotExistsAsync(folderName, {
					type: 'device',
					common: {
						name: {
							en: 'location',
							de: 'Standort',
							ru: 'расположение',
							pt: 'localização',
							nl: 'locatie',
							fr: 'emplacement',
							it: 'posizione',
							es: 'ubicación',
							pl: 'lokalizacja',
							uk: 'місцезнаходження',
							'zh-cn': '地点',
						},
						desc: {
							en: 'Your configured location',
							de: 'Ihr konfigurierter Standort',
							ru: 'Ваше указанное местоположение',
							pt: 'Sua localização configurada',
							nl: 'Uw geconfigureerde locatie',
							fr: 'Votre emplacement configuré',
							it: 'La tua posizione configurata',
							es: 'Su ubicación configurada',
							pl: 'Twoja skonfigurowana lokalizacja',
							uk: 'Ваше налаштоване місцезнаходження',
							'zh-cn': '您配置的位置',
						},
					},
					native: {},
				});

				// 2. Kanäle (Channels)
				let channels = [
					{
						id: 'weather',
						name: {
							en: 'Weather',
							de: 'Wetter',
							pl: 'Pogoda',
							ru: 'Погода',
							it: 'Meteo',
							es: 'Clima',
							'zh-cn': '天气',
							fr: 'Météo',
							pt: 'Clima',
							nl: 'Weer',
							uk: 'Погода',
						},
					},
					{
						id: 'weather.current',
						name: {
							en: 'Current weather',
							de: 'Aktuelles Wetter',
							pl: 'Aktualna pogoda',
							ru: 'Текущая погода',
							it: 'Meteo attuale',
							es: 'Clima actual',
							'zh-cn': '当前天气',
							fr: 'Météo actuelle',
							pt: 'Clima atual',
							nl: 'Huidige weer',
							uk: 'Поточна погода',
						},
					},
					{
						id: 'weather.forecast',
						name: {
							en: 'Weather forecast',
							de: 'Wettervorhersage',
							pl: 'Prognoza pogody',
							ru: 'Прогноз pogody',
							it: 'Previsioni meteo',
							es: 'Pronóstico del tiempo',
							'zh-cn': '天气预报',
							fr: 'Prévisions météo',
							pt: 'Previsão do tempo',
							nl: 'Weersverwachting',
							uk: 'Прогноз погоди',
						},
					},
					{
						id: 'air',
						name: {
							en: 'Air quality',
							de: 'Luftqualität',
							pl: 'Jakość powietrza',
							ru: 'Качество воздуха',
							it: "Qualità dell'aria",
							es: 'Calidad del aire',
							'zh-cn': '空气质量',
							fr: "Qualité de l'air",
							pt: 'Qualidade do ar',
							nl: 'Luchtkwaliteit',
							uk: 'Якість повітря',
						},
					},
					{
						id: 'air.current',
						name: {
							en: 'Current air quality',
							de: 'Aktuelle Luftqualität',
							pl: 'Aktualna jakość powietrza',
							ru: 'Текущее качество воздуха',
							it: "Qualità dell'aria attuale",
							es: 'Calidad del aire actual',
							'zh-cn': '当前空气质量',
							fr: "Qualité de l'air actuelle",
							pt: 'Qualidade do ar atual',
							nl: 'Huidige luchtkwaliteit',
							uk: 'Поточна якість повітря',
						},
					},
					{
						id: 'air.forecast',
						name: {
							en: 'Air quality forecast',
							de: 'Luftqualitäts-Vorhersage',
							pl: 'Prognoza jakości powietrza',
							ru: 'Прогноз качества воздуха',
							it: "Previsioni qualità dell'aria",
							es: 'Pronóstico de calidad del aire',
							'zh-cn': '空气质量預報',
							fr: "Prévisions qualité de l'air",
							pt: 'Previsão de qualidade do ar',
							nl: 'Luchtkwaliteit verwachting',
							uk: 'Прогноз якості повітря',
						},
					},
				];
				if (!config.airQualityEnabled) {
					this.log.debug(`Skipping air quality channels for ${loc.name} because it is disabled in config`);
					channels = channels.filter(chan => !chan.id.startsWith('air'));
				}

				for (const chan of channels) {
					await this.setObjectNotExistsAsync(`${folderName}.${chan.id}`, {
						type: 'channel',
						common: { name: chan.name as any },
						native: {},
					});
				}

				// Koordinaten prüfen und ggf. Systemkonfiguration verwenden
				let latitude: number = loc.latitude;
				let longitude: number = loc.longitude;
				const latMissing = loc.latitude == null || loc.latitude === '' || isNaN(Number(loc.latitude));
				const lonMissing = loc.longitude == null || loc.longitude === '' || isNaN(Number(loc.longitude));

				if (latMissing || lonMissing) {
					this.log.debug('longitude and/or latitude not set, try loading system configuration');
					if (this.systemLatitude != null && this.systemLongitude != null) {
						latitude = this.systemLatitude;
						longitude = this.systemLongitude;
						this.log.info(`Using system coordinates for location "${loc.name}": ${latitude}/${longitude}`);
					} else {
						this.log.error(
							'Please set the longitude and latitude manual in the adapter or in your system configuration!',
						);
						continue;
					}
				}

				this.log.debug(`updateData: Fetching data for ${loc.name} (${latitude}/${longitude})`);

				const data = await fetchAllWeatherData(
					{
						latitude: latitude,
						longitude: longitude,
						forecastDays: config.forecastDays || 7,
						forecastHours: config.forecastHours || 1,
						forecastHoursEnabled: config.forecastHoursEnabled || false,
						airQualityEnabled: config.airQualityEnabled || false,
						airQualityForecastDays: parseInt(config.airQualityForecastDays) || 0,
						timezone: loc.timezone || this.systemTimeZone,
						isImperial: config.isImperial || false,
					},
					this.log,
				);

				if (data.weather) {
					this.log.debug(`updateData: Processing weather for ${folderName}`);
					await this.processWeatherData(data.weather, folderName, latitude, longitude);
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
			this.log.debug('updateData: All Weather locations processed successfully.');

			// Zeitstempel für letztes Update setzen
			const now = new Date();
			const day = String(now.getDate()).padStart(2, '0');
			const month = String(now.getMonth() + 1).padStart(2, '0');
			const year = now.getFullYear();
			const hours = String(now.getHours()).padStart(2, '0');
			const minutes = String(now.getMinutes()).padStart(2, '0');
			const seconds = String(now.getSeconds()).padStart(2, '0');
			const timestamp = `${day}.${month}.${year}, ${hours}:${minutes}:${seconds}`;
			await this.setState('info.lastUpdate_weather', { val: timestamp, ack: true });
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
				// Wir nutzen getRole, damit auch hier die Logik (Stunde 0 vs andere) greift
				const dpRole = getRole('current', 'dew_point_2m');

				// Jetzt korrekt: ID, Wert, ROLLE, TranslationKey
				await this.extendOrCreateState(`${root}.dew_point_2m`, dp, dpRole, 'dew_point_2m');
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
				const role = getRole('current', key);
				await this.extendOrCreateState(`${root}.${key}`, val, role, key);

				if (key === 'weather_code') {
					await this.createCustomState(`${root}.weather_text`, t.codes[val] || '?', 'string', 'text', '');

					// Konfiguration auslesen
					const useNightBright = this.config.isNight_icon;
					const useAnimated = this.config.select_icon === 0;

					// Icon Pfad Logik
					const iconPath = useAnimated
						? `/adapter/${this.name}/icons/animated/${isDay === 1 ? 'day' : 'night'}/${val}.svg`
						: isDay === 1
							? `/adapter/${this.name}/icons/weather_icons/${val}.png`
							: useNightBright
								? `/adapter/${this.name}/icons/night_bright/${val}nh.png`
								: `/adapter/${this.name}/icons/night_dark/${val}n.png`;

					await this.createCustomState(`${root}.icon_url`, iconPath, 'string', 'weather.icon', '');
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
						'weather.icon.wind',
						'',
					);
				}
				if (key === 'wind_gusts_10m' && typeof val === 'number') {
					await this.createCustomState(
						`${root}.wind_gust_icon`,
						this.getWindGustIcon(val),
						'string',
						'weather.icon.wind',
						'',
					);
				}
			}
		}

		if (data.daily) {
			for (let i = 0; i < (data.daily.time?.length || 0); i++) {
				const dayPath = `${locationPath}.weather.forecast.day${i}`;
				const dayId = `day${i}`;
				const dayName = {
					en: `Day ${i}`,
					de: `Tag ${i}`,
					pl: `Dzień ${i}`,
					ru: `День ${i}`,
					it: `Giorno ${i}`,
					es: `Día ${i}`,
					'zh-cn': `第 ${i} 天`,
					fr: `Jour ${i}`,
					pt: `Dia ${i}`,
					nl: `Dag ${i}`,
					uk: `День ${i}`,
				};

				// Ordner für Wetter-Tagesvorhersage
				await this.setObjectNotExistsAsync(`${locationPath}.weather.forecast.${dayId}`, {
					type: 'channel',
					common: { name: dayName },
					native: {},
				});

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
				let phaseKey = '';

				if (phaseValue < 0.02 || phaseValue > 0.98) {
					phaseKey = 'new_moon';
				} else if (phaseValue >= 0.02 && phaseValue < 0.23) {
					phaseKey = 'waxing_crescent';
				} else if (phaseValue >= 0.23 && phaseValue < 0.27) {
					phaseKey = 'first_quarter'; // Zentriert um 0.25
				} else if (phaseValue >= 0.27 && phaseValue < 0.48) {
					phaseKey = 'waxing_gibbous';
				} else if (phaseValue >= 0.48 && phaseValue < 0.52) {
					phaseKey = 'full_moon'; // Zentriert um 0.50
				} else if (phaseValue >= 0.52 && phaseValue < 0.73) {
					phaseKey = 'waning_gibbous';
				} else if (phaseValue >= 0.73 && phaseValue < 0.77) {
					phaseKey = 'last_quarter'; // Zentriert um 0.75
				} else {
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
				const sunTimes = SunCalc.getTimes(forecastDate, lat, lon);
				const solarNoon = sunTimes.solarNoon
					? sunTimes.solarNoon.toLocaleTimeString(this.systemLang, {
							hour: '2-digit',
							minute: '2-digit',
							hour12: this.systemLang === 'en',
						})
					: '--:--';

				await this.createCustomState(`${dayPath}.solar_noon`, solarNoon, 'string', 'value', '');

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

					const role = getRole('daily', key, i);
					await this.extendOrCreateState(`${dayPath}.${key}`, val, role, key);

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
							this.config.select_icon === 0
								? `/adapter/${this.name}/icons/animated/day/${val}.svg`
								: `/adapter/${this.name}/icons/weather_icons/${val}.png`,
							'string',
							`weather.icon.forecast.${i}`,
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
			await this.setObjectNotExistsAsync(`${locationPath}.weather.forecast.hourly`, {
				type: 'channel',
				common: {
					name: {
						en: 'Hourly forecast',
						de: 'Stündliche Vorhersage',
						pl: 'Prognoza godzinowa',
						ru: 'Почасовой прогноз',
						it: 'Previsioni orarie',
						es: 'Pronóstico por hora',
						'zh-cn': '每小时预报',
						fr: 'Prévisions horaires',
						pt: 'Previsão horária',
						nl: 'Uurlijkse verwachting',
						uk: 'Погодинний прогноз',
					},
				},
				native: {},
			});

			// 2. Kanal für 'next_hours'
			await this.setObjectNotExistsAsync(`${locationPath}.weather.forecast.hourly.next_hours`, {
				type: 'channel',
				common: {
					name: {
						en: 'Next hours',
						de: 'Kommende Stunden',
						pl: 'Najbliższe godziny',
						ru: 'Ближайшие часы',
						it: 'Prossime ore',
						es: 'Próximas horas',
						'zh-cn': '接下来的几小时',
						fr: 'Heures suivantes',
						pt: 'Próximas horas',
						nl: 'Komende uren',
						uk: 'Найближчі години',
					},
				},
				native: {},
			});
			for (let i = 0; i < data.hourly.time.length; i++) {
				if (i < hoursPer_h_Limit) {
					const hourPath = `${locationPath}.weather.forecast.hourly.next_hours.hour${i}`;
					await this.setObjectNotExistsAsync(hourPath, {
						type: 'channel',
						common: {
							name: {
								en: `Hour ${i}`,
								de: `Stunde ${i}`,
								pl: `Godzina ${i}`,
								ru: `Час ${i}`,
								it: `Ora ${i}`,
								es: `Hora ${i}`,
								'zh-cn': `小时 ${i}`,
								fr: `Heure ${i}`,
								pt: `Hora ${i}`,
								nl: `Uur ${i}`,
								uk: `Година ${i}`,
							},
						},
						native: {},
					});
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
						const role = getRole('hourly', key, i);
						await this.extendOrCreateState(`${hourPath}.${key}`, val, role, key);

						if (key === 'snowfall_height' && typeof val === 'number') {
							const currentPrecip = data.hourly.precipitation ? data.hourly.precipitation[i] : 0;

							let finalValue = 0;

							// Logik: Nur wenn Niederschlag > 0 UND die Höhe nicht negativ ist
							if (currentPrecip > 0 && val >= 0) {
								finalValue = val;
							} else {
								const freezingLevel = data.hourly.freezing_level_height
									? data.hourly.freezing_level_height[i]
									: 0;

								finalValue = Math.max(0, freezingLevel - 300);
							}

							await this.createCustomState(`${hourPath}.snowfall_height`, finalValue, 'number', role, '');
						}

						if (key === 'weather_code') {
							await this.createCustomState(
								`${hourPath}.weather_text`,
								t.codes[val] || '?',
								'string',
								'text',
								'',
							);

							// Vorbereitungen für die Icon-Logik
							const currentIsDayh = isDay ? isDay[i] : 1; // 1 = Tag, 0 = Nacht
							const useNightBright = this.config.isNight_icon;
							const useAnimated = this.config.select_icon === 0;

							// Die kombinierte Pfad-Logik für stündliche Icons
							const iconPathHourly = useAnimated
								? `/adapter/${this.name}/icons/animated/${currentIsDayh === 1 ? 'day' : 'night'}/${val}.svg`
								: currentIsDayh === 1
									? `/adapter/${this.name}/icons/weather_icons/${val}.png`
									: useNightBright
										? `/adapter/${this.name}/icons/night_bright/${val}nh.png`
										: `/adapter/${this.name}/icons/night_dark/${val}n.png`;

							//await this.createCustomState(`${hourPath}.icon_url`, iconPathHourly, 'string', 'url', '');
							const iconRole = `weather.icon.forecast.${i}`;
							await this.createCustomState(
								`${hourPath}.icon_url`,
								iconPathHourly,
								'string',
								iconRole,
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
		const config = this.config as any;
		const aqForecastDays = parseInt(config.airQualityForecastDays) || 0;

		// 1. Current
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
				const role = getRole('current', key);
				await this.extendOrCreateState(`${root}.${key}`, val, role, key);

				if (key.includes('pollen')) {
					const pollenText = this.mapPollenToText(val, t, key);
					await this.createCustomState(`${root}.${key}_text`, pollenText, 'string', 'text', '');
				}
			}
		}

		if (data.hourly && data.hourly.time && aqForecastDays > 0) {
			for (let day = 0; day < aqForecastDays; day++) {
				const dayPath = `${locationPath}.air.forecast.day${day}`;

				// --- NEU: Intermediate Objects (Channels) ---
				const dayName = {
					en: `Day ${day}`,
					de: `Tag ${day}`,
					pl: `Dzień ${day}`,
					ru: `День ${day}`,
					it: `Giorno ${day}`,
					es: `Día ${day}`,
					'zh-cn': `第 ${day} 天`,
					fr: `Jour ${day}`,
					pt: `Dia ${day}`,
					nl: `Dag ${day}`,
					uk: `День ${day}`,
				};

				// Sicher stellen, dass der Ordner für diesen Tag existiert
				await this.setObjectNotExistsAsync(dayPath, {
					type: 'channel',
					common: { name: dayName },
					native: {},
				});

				const startIdx = day * 24;
				const endIdx = startIdx + 24;

				// --- Wochentag und Datum vorbereiten ---
				const forecastDate = new Date(data.hourly.time[startIdx]);
				const nameDay = forecastDate.toLocaleDateString(this.systemLang, { weekday: 'long' });
				const dayDate = forecastDate.toLocaleDateString(this.systemLang);

				// States für Zeit/Tag schreiben
				await this.createCustomState(`${dayPath}.name_day`, nameDay, 'string', 'text', '');
				await this.createCustomState(`${dayPath}.date`, dayDate, 'string', `date.forecast.${day}`, '');

				for (const key in data.hourly) {
					if (key === 'time') {
						continue;
					}

					const hourlyValues = data.hourly[key].slice(startIdx, endIdx);
					if (hourlyValues.length > 0) {
						const maxVal = Math.max(...hourlyValues);
						await this.extendOrCreateState(`${dayPath}.${key}_max`, maxVal, 'value', `${key}_max`);

						if (key.includes('pollen')) {
							const pollenText = this.mapPollenToText(maxVal, t, key);
							await this.createCustomState(`${dayPath}.${key}_text`, pollenText, 'string', 'text', '');
						}
					}
				}
			}
		}
	}

	private mapPollenToText(val: number, t: any, key?: string): string {
		if (!t.pollen) {
			return val.toString();
		}

		const k = key || '';

		if (k.includes('mugwort') || k.includes('ragweed')) {
			return val > 20 ? t.pollen.high : val > 5 ? t.pollen.moderate : val > 0 ? t.pollen.low : t.pollen.none;
		}

		return val > 50 ? t.pollen.high : val > 10 ? t.pollen.moderate : val > 0 ? t.pollen.low : t.pollen.none;
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
					name: this.getI18nObject(lastPart),
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

	// Erstellt oder aktualisiert einen Datenpunkt und weist automatisch Einheiten und Rollen zu
	private async extendOrCreateState(
		id: string,
		val: any,
		role: string = 'value',
		translationKey?: string,
	): Promise<void> {
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

			this.log.debug(`extendOrCreateState: Creating state ${id} (role: ${role}, unit: ${displayUnit})`);

			const idParts = id.split('.');
			const lastPart = idParts[idParts.length - 1] || id;
			const key = translationKey || lastPart;

			await this.setObjectNotExistsAsync(id, {
				type: 'state',
				common: {
					name: this.getI18nObject(key),
					type: typeof val as any,
					role: role,
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
		if (this.pvService) {
			this.log.debug('onUnload: Stopping PV-Service.');
			this.pvService.destroy();
		}
		callback();
	}
}

if (require.main !== module) {
	module.exports = (options: Partial<utils.AdapterOptions> | undefined) => new OpenMeteoWeather(options);
} else {
	new OpenMeteoWeather();
}
