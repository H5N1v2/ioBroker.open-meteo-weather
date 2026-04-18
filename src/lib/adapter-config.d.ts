// This file extends the AdapterConfig type from "@iobroker/adapter-core"

// 1. Definiere das Interface AUSSERHALB von declare global und EXPORTIEREN es
export interface Location {
    name: string;
    pv_latitude: number;
    pv_longitude: number;
    tilt: number; 
    azimuth: number;
    kwp: number;
    pv_timezone?: string;
}

// 2. Das globale ioBroker Interface erweitern
declare global {
    namespace ioBroker {
        interface AdapterConfig {
            // Wetter-Einstellungen (Bestand)
            locations: {
                name: string;
                lat: number;
                lon: number;
                tz: string;
                country?: string;
            }[];
            isNight_icon: boolean;
            isWinddirection_icon: boolean;
            pollenEnabled: boolean;
            airQualityEnabled: boolean;
            language: string;
            forecastDays: number;
            select_icon: number;
            updateInterval: number;

            // PV-Einstellungen (Neu)
            enablePV: boolean;
            forecastDays_pv: number;
            pv_forecastHours: number;
            pv_updateInterval: number | "sunrise";
            pv_locations: Location[];
			locationsTotal: boolean;
			locationsTotal_hourly: boolean;
			hourlyUpdate: number;
			minutes_15: boolean;
			locationsTotal_minutely: boolean;
			minutes_15_json: boolean;
			locationsTotal_minutely_json: boolean;
			hours_json: boolean;
			locationsTotal_hourly_json: boolean;
            sunshine_duration: boolean;
            cloud_cover: boolean;
        }
    }
}

// Erforderlich, damit TypeScript die Datei als Modul erkennt
export {};