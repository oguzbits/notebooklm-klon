import type { SourceFailure, SourceStatus } from '@nlm/shared';
import { API_ERROR, type ApiErrorCode, SOURCE_FAILURE, SOURCE_STATUS } from '@nlm/shared';

import { ApiRequestError } from './api';
import { AUTH_FAILURE, type AuthFailure } from './auth';
import { tr } from './i18n';

/** The text for every error the API can answer with. No technical terms. */
export const ERROR_MESSAGE: Record<ApiErrorCode, string> = {
  [API_ERROR.UNAUTHENTICATED]: tr('Bitte melde dich an.', 'Please sign in.'),
  [API_ERROR.NOT_FOUND]: tr(
    'Das wurde nicht gefunden. Vielleicht wurde es schon gelöscht.',
    'That could not be found. It may have been deleted already.'
  ),
  [API_ERROR.INVALID_REQUEST]: tr('Die Eingabe ist nicht gültig.', 'That input is not valid.'),
  [API_ERROR.FILE_TOO_LARGE]: tr(
    'Die Datei ist zu groß. Erlaubt sind höchstens 10 MB.',
    'The file is too large. The limit is 10 MB.'
  ),
  [API_ERROR.UNSUPPORTED_FILE]: tr(
    'Dieses Dateiformat wird nicht unterstützt. Erlaubt sind PDF, DOCX, PPTX, TXT, MD, Bilder (PNG, JPG, WEBP) und Aufnahmen (MP3, WAV).',
    'This file format is not supported. Allowed are PDF, DOCX, PPTX, TXT, MD, images (PNG, JPG, WEBP) and recordings (MP3, WAV).'
  ),
  [API_ERROR.UNREADABLE_FILE]: tr(
    'Diese Datei lässt sich nicht öffnen. Vielleicht ist sie beschädigt oder mit einem Passwort geschützt.',
    'This file cannot be opened. It may be damaged or protected by a password.'
  ),
  [API_ERROR.TOO_MANY_PAGES]: tr(
    'Das PDF hat zu viele Seiten. Erlaubt sind höchstens 50 Seiten.',
    'The PDF has too many pages. The limit is 50 pages.'
  ),
  [API_ERROR.NO_SOURCES_SELECTED]: tr(
    'Wähle mindestens eine Quelle aus, die schon fertig gelesen wurde.',
    'Select at least one source that has finished loading.'
  ),
  [API_ERROR.CHAT_LIMIT_REACHED]: tr(
    'Im Moment sind keine Antworten mehr möglich. Bitte versuche es später noch einmal.',
    'No more answers are possible right now. Please try again later.'
  ),
  [API_ERROR.INVALID_URL]: tr(
    'Diese Adresse kann nicht geladen werden. Prüfe den Link.',
    'This address cannot be loaded. Check the link.'
  ),
  [API_ERROR.STUDIO_EMPTY]: tr(
    'Aus den ausgewählten Quellen ließ sich dazu nichts Belegbares erstellen. Wähle mehr oder andere Quellen.',
    'Nothing that the selected sources back up could be created. Select more or different sources.'
  ),
  [API_ERROR.GUEST_UNAVAILABLE]: tr(
    'Die Demo ist gerade nicht verfügbar. Bitte versuche es später noch einmal.',
    'The demo is not available right now. Please try again later.'
  ),
  [API_ERROR.WEB_SEARCH_UNAVAILABLE]: tr(
    'Die Suche im Web ist hier nicht eingerichtet.',
    'Web search is not set up here.'
  ),
  [API_ERROR.WEB_SEARCH_LIMIT_REACHED]: tr(
    'Für die Suche im Web ist das Limit erreicht. Bitte versuche es später noch einmal.',
    'The limit for web search has been reached. Please try again later.'
  ),
  [API_ERROR.COVER_UNAVAILABLE]: tr(
    'Titelbilder sind hier nicht eingerichtet.',
    'Cover images are not set up here.'
  ),
  [API_ERROR.COVER_INVALID]: tr(
    'Das Bild muss ein PNG, JPEG oder WebP sein und darf höchstens 2 MB groß sein.',
    'The image must be a PNG, JPEG or WebP and at most 2 MB.'
  ),
  [API_ERROR.SOURCE_NOT_RETRYABLE]: tr(
    'Diese Quelle kann nicht noch einmal gelesen werden. Entferne sie und füge sie neu hinzu.',
    'This source cannot be read again. Remove it and add it anew.'
  ),
  [API_ERROR.USAGE_LIMIT_REACHED]: tr(
    'Das Limit ist erreicht. Bitte versuche es später noch einmal.',
    'The limit has been reached. Please try again later.'
  ),
  [API_ERROR.DAILY_BUDGET_REACHED]: tr(
    'Heute ist das Kontingent der Demo aufgebraucht. Morgen geht es weiter.',
    "Today's allowance for the demo is used up. It continues tomorrow."
  ),
  [API_ERROR.REQUEST_IN_PROGRESS]: tr(
    'Es läuft schon eine Anfrage von dir. Warte, bis sie fertig ist.',
    'One of your requests is already running. Wait until it has finished.'
  ),
  [API_ERROR.NOTEBOOK_LIMIT_REACHED]: tr(
    'Du hast die Höchstzahl an Notebooks erreicht. Lösche eines, um ein neues anzulegen.',
    'You have reached the maximum number of notebooks. Delete one to create a new one.'
  ),
  [API_ERROR.SOURCE_LIMIT_REACHED]: tr(
    'Dieses Notebook hat die Höchstzahl an Quellen erreicht. Entferne eine, um eine neue hinzuzufügen.',
    'This notebook has reached the maximum number of sources. Remove one to add a new one.'
  ),
  [API_ERROR.INTERNAL]: tr(
    'Etwas ist schiefgelaufen. Bitte versuche es noch einmal.',
    'Something went wrong. Please try again.'
  ),
};

/** Why a source could not be read. Shown under a failed source. */
export const FAILURE_MESSAGE: Record<SourceFailure, string> = {
  [SOURCE_FAILURE.EMPTY_TEXT]: tr(
    'In dieser Quelle wurde kein Text gefunden.',
    'No text was found in this source.'
  ),
  [SOURCE_FAILURE.PARSE_FAILED]: tr(
    'Die Quelle konnte nicht gelesen werden. Vielleicht ist die Datei beschädigt oder mit einem Passwort geschützt; sonst versuche es später noch einmal.',
    'The source could not be read. The file may be damaged or protected by a password; otherwise try again later.'
  ),
  [SOURCE_FAILURE.EMBED_FAILED]: tr(
    'Die Quelle konnte nicht für die Suche vorbereitet werden.',
    'The source could not be prepared for searching.'
  ),
  [SOURCE_FAILURE.ENQUEUE_FAILED]: tr(
    'Das Lesen der Quelle konnte nicht gestartet werden.',
    'Reading the source could not be started.'
  ),
  [SOURCE_FAILURE.INTERRUPTED]: tr(
    'Das Lesen der Quelle wurde unterbrochen.',
    'Reading the source was interrupted.'
  ),
};

export const STATUS_LABEL: Record<SourceStatus, string> = {
  [SOURCE_STATUS.PENDING]: tr('Wartet', 'Waiting'),
  [SOURCE_STATUS.PROCESSING]: tr('Wird gelesen …', 'Reading …'),
  [SOURCE_STATUS.READY]: tr('Bereit', 'Ready'),
  [SOURCE_STATUS.FAILED]: tr('Fehlgeschlagen', 'Failed'),
};

export const AUTH_MESSAGE: Record<AuthFailure, string> = {
  [AUTH_FAILURE.INVALID_CREDENTIALS]: tr(
    'E-Mail-Adresse oder Passwort stimmen nicht.',
    'The email address or password is wrong.'
  ),
  [AUTH_FAILURE.EMAIL_TAKEN]: tr(
    'Mit dieser E-Mail-Adresse gibt es schon ein Konto.',
    'An account with this email address already exists.'
  ),
  [AUTH_FAILURE.WEAK_PASSWORD]: tr(
    'Das Passwort muss mindestens 8 Zeichen lang sein.',
    'The password must be at least 8 characters long.'
  ),
  [AUTH_FAILURE.WRONG_PASSWORD]: tr('Das Passwort stimmt nicht.', 'The password is wrong.'),
  [AUTH_FAILURE.GUEST_UNAVAILABLE]: tr(
    'Die Demo ist gerade nicht verfügbar. Bitte melde dich an oder versuche es später noch einmal.',
    'The demo is not available right now. Please sign in or try again later.'
  ),
  [AUTH_FAILURE.UNKNOWN]: tr(
    'Das hat nicht geklappt. Bitte versuche es noch einmal.',
    'That did not work. Please try again.'
  ),
};

const REFERENCE_LENGTH = 8;

/** The text for any error a request can end in. */
export function describeError(error: unknown): string {
  if (!(error instanceof ApiRequestError)) return ERROR_MESSAGE[API_ERROR.INTERNAL];
  const message = ERROR_MESSAGE[error.code];
  // Only an unexpected error needs a reference: the others explain themselves.
  if (error.code !== API_ERROR.INTERNAL || !error.requestId) return message;
  return `${message} ${tr('Referenz', 'Reference')}: ${error.requestId.slice(0, REFERENCE_LENGTH)}`;
}
