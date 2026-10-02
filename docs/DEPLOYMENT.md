# Deployment und Betrieb

Wie die App auf einem Hetzner-Server läuft, wie man sie dort einrichtet, aktualisiert und wiederherstellt. Die
Begründung der Wahl steht in [ENTSCHEIDUNGEN.md](ENTSCHEIDUNGEN.md), Abschnitt „Deployment: Entscheidung und Stand“.

## Überblick

```
Internet ──443/80──> Caddy ──> app (Hono + gebautes Web, Port 3000) ──> db (Postgres + pgvector)
                                                                    └──> s3 (SeaweedFS, Titelbilder)
```

| Teil        | Datei                                                        | Aufgabe                                                           |
| ----------- | ------------------------------------------------------------ | ----------------------------------------------------------------- |
| Stack       | [docker-compose.prod.yml](../deploy/docker-compose.prod.yml) | Vier Container; nur Caddy ist aus dem Internet erreichbar         |
| Proxy       | [Caddyfile](../deploy/Caddyfile)                             | HTTPS-Zertifikat holen und erneuern, ohne Pufferung weiterreichen |
| Einrichtung | [provision.sh](../deploy/provision.sh)                       | Ein Befehl vom eigenen Rechner: Server, `server.env`, Secrets     |
| Backup      | [backup.sh](../deploy/backup.sh)                             | Täglich 03:15 ein `pg_dump`, die letzten 7 bleiben                |
| Deploy      | [deploy.yml](../.github/workflows/deploy.yml)                | Baut das Image, schickt es per SSH, startet den Stack             |

- Das Image entsteht in GitHub Actions (`docker build`) und wird mit `docker save | ssh docker load` übertragen. Der Server
  braucht weder Registry noch Zugriff auf das Repository.
- Die Datenbank hört nur auf `127.0.0.1` des Servers. Von außen kommt man nur per SSH-Tunnel heran.
- Alle Geheimnisse liegen in `/srv/nlm/server.env` (Rechte 600) und in `/srv/nlm/s3.json`. Beides entsteht auf dem Server
  und ist nie im Repository.
- Die App migriert die Datenbank beim Start und legt den Bucket für die Titelbilder selbst an.

## Einmalige Einrichtung

Was nur du tun kannst, ist hier fett.

1. **Server buchen:** Hetzner Cloud CX23 (2 vCPU, 4 GB RAM, 40 GB), Ubuntu 24.04, deinen SSH-Schlüssel hinterlegen.
2. **Firewall:** In der Hetzner-Konsole eine Firewall mit eingehend TCP 22, 80 und 443 anlegen und dem Server zuweisen.
3. **Server einrichten, ein Befehl** auf deinem Rechner, im Repository: `deploy/provision.sh <IPv4 oder Hostname>`.
   Hostname ohne eigene Domain: `<IP mit Bindestrichen>.sslip.io`, zum Beispiel `203-0-113-7.sslip.io` für `203.0.113.7`
   (das Skript bildet ihn selbst). Mit eigener Domain stattdessen zuerst einen A-Eintrag auf die IP setzen und die Domain
   übergeben. Voraussetzung: Login als root mit deinem SSH-Schlüssel, `gh auth login`, eine `.env.local` mit den Werten
   `GEMINI_API_KEY`, `AI_MODEL`, `PARSE_MODEL`, `EMBEDDING_MODEL` (für den Betrieb ein Schlüssel aus einem eigenen
   Google-Projekt, damit Tests das Kontingent der Prüfer nicht verbrauchen; Modellnamen vorher in der aktuellen Google-Doku
   prüfen). Das Skript:
   - zeigt den SSH-Fingerabdruck des Servers; du vergleichst ihn mit der Hetzner-Konsole (Server > Übersicht) und bestätigst,
   - erzeugt ein neues Schlüsselpaar für den Benutzer `deploy` und führt [bootstrap.sh](../deploy/bootstrap.sh) aus
     (Docker, 2 GB Swap, Benutzer `deploy` nur mit Schlüssel, `ufw`, nächtliches Backup, `server.env` mit frisch erzeugten
     Geheimnissen),
   - trägt die Werte aus `.env.local` per SSH in `/srv/nlm/server.env` ein (nur Zeilen mit `FILL_IN`, nichts wird
     ausgegeben, eine ungesetzte `PARSE_FALLBACK_MODEL` entfällt, ein `TAVILY_API_KEY` wird übernommen) und fragt
     `SEED_DEMO_EMAIL`, falls sie fehlt,
   - prüft den Login als `deploy` und setzt die GitHub-Secrets `DEPLOY_HOST`, `DEPLOY_SSH_KEY`, `DEPLOY_KNOWN_HOSTS`.

   Ein zweiter Lauf ist sicher: Er ersetzt das Deploy-Schlüsselpaar auf dem Server und in GitHub, ausgefüllte Werte in
   `server.env` bleiben. Nicht ändern in `server.env`: `SITE_ADDRESS`, `POSTGRES_PASSWORD`, `BETTER_AUTH_SECRET`, `S3_*`. Ein
   neues `POSTGRES_PASSWORD` gilt nur beim ersten Anlegen des Volumes; ein neues `BETTER_AUTH_SECRET` meldet alle ab.
   Von Hand geht es auch: die Schritte stehen als Kommentar in [provision.sh](../deploy/provision.sh) und in
   [bootstrap.sh](../deploy/bootstrap.sh).

4. **Erster Deploy:** Actions > Deploy > Run workflow. Danach läuft er nach jedem grünen CI-Lauf auf `main`.
5. **Demo-Notebook anlegen** (einmalig, siehe unten).
6. **Uptime-Check** auf `https://<Hostname>/health` einrichten (zum Beispiel UptimeRobot, kostenlos). Dann Live-Link,
   Demo-Zugang und Loom-Link in die [README](../README.md) eintragen.

### Demo-Notebook anlegen

`pnpm seed:demo` liegt nicht im Produktions-Image und läuft deshalb auf deinem Rechner, im Repository, gegen die
Datenbank des Servers durch einen SSH-Tunnel:

```bash
ssh -N -L 5433:127.0.0.1:5432 deploy@<Hostname>      # Shell 1, offen lassen
```

In Shell 2, im Repository, `DATABASE_URL=postgresql://nlm:<POSTGRES_PASSWORD>@127.0.0.1:5433/nlm`, `SEED_DEMO_EMAIL` und
`SEED_DEMO_PASSWORD` in der Shell setzen (Variablen aus der Shell haben Vorrang vor deiner lokalen `.env.local`; Google-Schlüssel
und Modellnamen können aus ihr kommen), dann `pnpm seed:demo`. Der Befehl liest drei Beispieldokumente einmal ein (Modellaufrufe, also
Kontingent) und kann wiederholt werden. Das `POSTGRES_PASSWORD` steht in `/srv/nlm/server.env`.

## Betrieb

Alle Befehle auf dem Server als `deploy`, im Verzeichnis `/srv/nlm`. Kurzform:
`dc() { docker compose -f docker-compose.prod.yml --env-file server.env "$@"; }`

| Aufgabe                | Befehl                                                                 |
| ---------------------- | ---------------------------------------------------------------------- |
| Zustand ansehen        | `dc ps` und `curl -s https://<Hostname>/health`                        |
| Logs der App           | `dc logs -f --tail 100 app`                                            |
| Speicher und CPU       | `docker stats --no-stream`                                             |
| Neue Version ausrollen | Merge auf `main` (nach grünem CI) oder Actions > Deploy > Run workflow |
| Alte Version ausrollen | Actions > Deploy > Run workflow mit dem älteren Branch oder Tag        |
| Neu starten            | `dc restart app`                                                       |

Zu beobachten nach dem ersten Lauf: ob 4 GB RAM reichen (`docker stats`, Swap mit `free -h`). Die Logs enthalten nach
Regel 7 in [AGENTS.md](../AGENTS.md) nur IDs, Längen, Dauer und Token-Zahlen, keine Dokumentinhalte. Docker rotiert sie
(je 10 MB, 3 Dateien).

### Backup und Wiederherstellung

- `backup.sh` schreibt nach `/srv/nlm/backups/nlm-<Datum>.sql.gz` (Fehler stehen in `/srv/nlm/backup.log`). Gesichert wird
  die Datenbank. **Die Titelbilder (Volume `s3data`) und `server.env` sind nicht im Backup**; eine Kopie der `server.env`
  gehört in deinen Passwortmanager. Die Dumps liegen auf demselben Server: gegen einen Verlust des Servers helfen sie nur,
  wenn du sie gelegentlich herunterlädst (`scp deploy@<Hostname>:/srv/nlm/backups/<Datei> .`).
- Wiederherstellen in eine leere Datenbank:

  ```bash
  dc stop app
  dc exec -T db psql -U nlm -d postgres -c 'DROP DATABASE nlm' -c 'CREATE DATABASE nlm'
  gunzip -c backups/nlm-<Datum>.sql.gz | dc exec -T db psql -U nlm -d nlm
  dc start app
  ```

### Zurück auf die vorige Version

Jeder Deploy behält das bisherige Image als `nlm-app:previous`. Ist die neue Version fehlerhaft, auf dem Server:

```bash
docker tag nlm-app:previous nlm-app:current
dc up -d
```

Die Datenbank-Migrationen laufen beim Start der App vorwärts und werden dabei nicht zurückgenommen; ein Rollback über
mehrere Versionen mit Schemaänderung braucht deshalb das Backup (siehe oben).

### Zertifikat und Hostname

Caddy holt das Zertifikat beim ersten Start und erneuert es selbst; es liegt im Volume `caddy_data`. Bei `sslip.io` können
die Let’s-Encrypt-Limits für den gemeinsamen Domain-Namen greifen; Caddy weicht dann automatisch auf ZeroSSL aus. Hilft das
nicht, eine eigene Domain nehmen (nur `SITE_ADDRESS` in `server.env` und `DEPLOY_HOST` ändern). Eine Änderung des Hostnamens
braucht einen neuen Deploy (`BETTER_AUTH_URL` wird aus `SITE_ADDRESS` gebildet).

## Fehlersuche

| Beobachtung                                  | Wahrscheinliche Ursache und Schritt                                                                                |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Deploy bricht bei `ssh` ab                   | `DEPLOY_KNOWN_HOSTS` oder `DEPLOY_SSH_KEY` falsch; Firewall lässt Port 22 nicht zu                                 |
| `up --wait` meldet `app` als unhealthy       | `dc logs app`: meist ein `FILL_IN` oder ein fehlender Wert in `server.env` (die App prüft die Umgebung beim Start) |
| Browser meldet Zertifikatsfehler             | `dc logs caddy`: Ports 80 und 443 offen? Hostname zeigt auf die IP? Limits siehe oben                              |
| „Demo ausprobieren“ antwortet mit Fehler     | `SEED_DEMO_EMAIL` fehlt oder `pnpm seed:demo` wurde nicht ausgeführt                                               |
| Titelbilder fehlen nach Neustart des Servers | Volume `s3data` gelöscht? Es ist nicht im Backup; Bilder neu hochladen                                             |
| Server träge, Container beendet              | `docker stats`, `free -h`: Speicher knapp; größeren Server wählen oder Swap prüfen                                 |
