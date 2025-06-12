# reservist-digital

PDF-Formular-Ausfüller für deutsche Reservisten-Dokumente.

## Anwendung

Nach dem Start sind folgende Anwendungen verfügbar:

- **Startseite**: http://localhost:8080/
- **PDF Formular Ausfüller**: http://localhost:8080/main/
- **Konfigurations-Editor**: http://localhost:8080/config/

## Docker Setup

### Mit Docker Compose (empfohlen)

```bash
cd docker
docker-compose up -d
```

Die Anwendung ist dann unter http://localhost:8080 erreichbar.

### Mit Docker direkt

```bash
# Build
docker build -f docker/Dockerfile -t reservist-digital .

# Run
docker run -d -p 8080:80 --name reservist-digital reservist-digital
```

### Entwicklung

Für die Entwicklung kann ein lokaler Webserver verwendet werden:

```bash
# Python 3
python -m http.server 8000

# Node.js
npx http-server
```

## Konfiguration

Die Anwendung verwendet YAML-Konfigurationsdateien im `formulare/` Verzeichnis zur Konfiguration der PDF-Felder. Ein Konfigurationseditor ist unter `/config/` verfügbar.