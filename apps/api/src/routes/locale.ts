import { LOCALE, type Locale, LOCALE_HEADER, LocaleSchema } from '@nlm/shared';

/** The interface language the client asked for; a missing or unknown value means German. */
export function requestLocale(c: {
  req: { header: (name: string) => string | undefined };
}): Locale {
  const parsed = LocaleSchema.safeParse(c.req.header(LOCALE_HEADER));
  return parsed.success ? parsed.data : LOCALE.DE;
}
