import type { SourceFailure, SourceStatus } from '@nlm/shared';
import { API_ERROR, type ApiErrorCode, SOURCE_FAILURE, SOURCE_STATUS } from '@nlm/shared';

import { ApiRequestError } from './api';
import { AUTH_FAILURE, type AuthFailure } from './auth';

/** The German text for every error the API can answer with. No technical terms. */
export const ERROR_MESSAGE: Record<ApiErrorCode, string> = {
  [API_ERROR.UNAUTHENTICATED]: 'Bitte melde dich an.',
  [API_ERROR.NOT_FOUND]: 'Das wurde nicht gefunden. Vielleicht wurde es schon gelöscht.',
  [API_ERROR.INVALID_REQUEST]: 'Die Eingabe ist nicht gültig.',
  [API_ERROR.FILE_TOO_LARGE]: 'Die Datei ist zu groß. Erlaubt sind höchstens 10 MB.',
  [API_ERROR.UNSUPPORTED_FILE]:
    'Dieses Dateiformat wird nicht unterstützt. Erlaubt sind PDF, DOCX, TXT, MD und Bilder (PNG, JPG, WEBP).',
  [API_ERROR.TOO_MANY_PAGES]: 'Das PDF hat zu viele Seiten. Erlaubt sind höchstens 50 Seiten.',
  [API_ERROR.NO_SOURCES_SELECTED]:
    'Wähle mindestens eine Quelle aus, die schon fertig gelesen wurde.',
  [API_ERROR.CHAT_LIMIT_REACHED]:
    'Für heute sind keine Antworten mehr möglich. Bitte versuche es später noch einmal.',
  [API_ERROR.INVALID_URL]: 'Diese Adresse kann nicht geladen werden. Prüfe den Link.',
  [API_ERROR.UPLOAD_LIMIT_REACHED]:
    'Du hast in den letzten 24 Stunden schon die erlaubte Zahl neuer Quellen hinzugefügt.',
  [API_ERROR.STUDIO_EMPTY]:
    'Aus den ausgewählten Quellen ließ sich dazu nichts Belegbares erstellen. Wähle mehr oder andere Quellen.',
  [API_ERROR.GUEST_UNAVAILABLE]:
    'Die Demo ist gerade nicht verfügbar. Bitte versuche es später noch einmal.',
  [API_ERROR.WEB_SEARCH_UNAVAILABLE]: 'Die Suche im Web ist hier nicht eingerichtet.',
  [API_ERROR.WEB_SEARCH_LIMIT_REACHED]:
    'Für die Suche im Web ist das Limit erreicht. Bitte versuche es später noch einmal.',
  [API_ERROR.COVER_UNAVAILABLE]: 'Titelbilder sind hier nicht eingerichtet.',
  [API_ERROR.COVER_INVALID]:
    'Das Bild muss ein PNG, JPEG oder WebP sein und darf höchstens 2 MB groß sein.',
  [API_ERROR.INTERNAL]: 'Etwas ist schiefgelaufen. Bitte versuche es noch einmal.',
};

/** Why a source could not be read. Shown under a failed source. */
export const FAILURE_MESSAGE: Record<SourceFailure, string> = {
  [SOURCE_FAILURE.EMPTY_TEXT]: 'In dieser Quelle wurde kein Text gefunden.',
  [SOURCE_FAILURE.PARSE_FAILED]: 'Die Quelle konnte nicht gelesen werden.',
  [SOURCE_FAILURE.EMBED_FAILED]: 'Die Quelle konnte nicht für die Suche vorbereitet werden.',
  [SOURCE_FAILURE.ENQUEUE_FAILED]: 'Das Lesen der Quelle konnte nicht gestartet werden.',
  [SOURCE_FAILURE.INTERRUPTED]:
    'Das Lesen der Quelle wurde unterbrochen. Lade sie bitte noch einmal hoch.',
};

export const STATUS_LABEL: Record<SourceStatus, string> = {
  [SOURCE_STATUS.PENDING]: 'Wartet',
  [SOURCE_STATUS.PROCESSING]: 'Wird gelesen …',
  [SOURCE_STATUS.READY]: 'Bereit',
  [SOURCE_STATUS.FAILED]: 'Fehlgeschlagen',
};

export const AUTH_MESSAGE: Record<AuthFailure, string> = {
  [AUTH_FAILURE.INVALID_CREDENTIALS]: 'E-Mail-Adresse oder Passwort stimmen nicht.',
  [AUTH_FAILURE.EMAIL_TAKEN]: 'Mit dieser E-Mail-Adresse gibt es schon ein Konto.',
  [AUTH_FAILURE.WEAK_PASSWORD]: 'Das Passwort muss mindestens 8 Zeichen lang sein.',
  [AUTH_FAILURE.GUEST_UNAVAILABLE]:
    'Die Demo ist gerade nicht verfügbar. Bitte melde dich an oder versuche es später noch einmal.',
  [AUTH_FAILURE.UNKNOWN]: 'Das hat nicht geklappt. Bitte versuche es noch einmal.',
};

/** The German text for any error a request can end in. */
export function describeError(error: unknown): string {
  return error instanceof ApiRequestError
    ? ERROR_MESSAGE[error.code]
    : ERROR_MESSAGE[API_ERROR.INTERNAL];
}
