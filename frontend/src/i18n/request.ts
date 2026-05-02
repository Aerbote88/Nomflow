import { cookies } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';
import { DEFAULT_LOCALE, LOCALE_COOKIE, SUPPORTED_LOCALES, type Locale } from './config';

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(LOCALE_COOKIE)?.value;
  const locale: Locale = (SUPPORTED_LOCALES as readonly string[]).includes(cookieValue ?? '')
    ? (cookieValue as Locale)
    : DEFAULT_LOCALE;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
