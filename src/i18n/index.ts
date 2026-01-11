// src/lib/i18n/index.ts

import { de } from './de';
import { en } from './en';
import { pl } from './pl';
import { ru } from './ru';
import { it } from './it';
import { es } from './es';
import { zh } from './zh';
import { fr } from './fr';
import { pt } from './pt';
import { nl } from './nl';
import { uk } from './uk';

/**
 * Zentrales Übersetzungsobjekt für Datenpunkte
 * Struktur: translations[Sprachcode][DatenpunktKey]
 */
export const translations: Record<string, Record<string, string>> = {
    de,
    en,
    pl,
    ru,
    it,
    es,
    "zh-cn": zh,
    fr,
    pt,
    nl,
    uk
};

/**
 * Hilfsfunktion für die Verwendung in der main.ts
 * @param key Der Key aus den Sprachdateien (z.B. 'temperature_2m')
 * @param lang Der aktuelle Sprachcode des ioBroker Systems
 */
export function getI18nName(key: string, lang: string = 'en'): string {
    return translations[lang]?.[key] || translations['en']?.[key] || key;
}