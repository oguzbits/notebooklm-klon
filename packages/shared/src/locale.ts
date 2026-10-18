import { z } from 'zod';

/** The languages of the interface. The client sends the chosen one in `LOCALE_HEADER`. */
export const LOCALE = { DE: 'de', EN: 'en' } as const;
export const LocaleSchema = z.enum(LOCALE);
export type Locale = z.infer<typeof LocaleSchema>;
export const LOCALE_HEADER = 'x-locale';
