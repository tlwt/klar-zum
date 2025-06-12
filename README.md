# reservist-digital

PDF-Formular-Ausfüller für deutsche Reservisten-Dokumente.

## Anwendung

Nach dem Start sind folgende Anwendungen verfügbar:

- **Startseite**: http://localhost:8080/
- **PDF Formular Ausfüller**: http://localhost:8080/app/main/
- **Konfigurations-Editor**: http://localhost:8080/app/config/

## Docker Setup

### Mit Docker Compose (empfohlen)

```bash
cd docker
docker-compose up -d
```

Die Anwendung ist dann unter http://localhost:8080 erreichbar.

**Container-Features:**
- **Alpine Linux** + **nginx** + **PHP-FPM** (nur 130MB)
- **Direktes Speichern** von Konfigurationen (wenn `allowConfigWrite: true`)
- **Live-Updates** durch Volume-Mounts während der Entwicklung
- **Caching deaktiviert** für sofortige Änderungen

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

Die Anwendung verwendet YAML-Konfigurationsdateien im `app/formulare/` Verzeichnis zur Konfiguration der PDF-Felder. Ein Konfigurationseditor ist unter `/app/config/` verfügbar.

### Direktes Speichern von Konfigurationen

Setzen Sie `allowConfigWrite: true` in der `app/config.yaml` um das direkte Speichern von Konfigurationen im Editor zu aktivieren:

```yaml
# Entwicklungs-Features
allowConfigWrite: true  # Ermöglicht direktes Speichern von Konfigurationen

pdfs:
  - name: "beispiel.pdf"
    description: "Beispiel-Formular"
```

**Für PHP-Server**: Platzieren Sie `app/save-config.php` für erweiterte Speicherfunktionalität.

**Sicherheitshinweis**: Diese Funktion ist nur für die Entwicklung gedacht!