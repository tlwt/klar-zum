# reservist-digital

Moderne Web-Anwendung zum Ausfüllen deutscher Reservisten-PDF-Formulare mit Live-Vorschau und intelligenter Feldkonfiguration.

## ✨ Features

- **📄 Live PDF Vorschau**: Echtzeit-Vorschau beim Ausfüllen mit 50% Split-Screen Layout
- **🎯 Intelligente PDF-Auswahl**: Hover-Vorschau mit echter PDF-Anzeige
- **📝 Automatische Formularfelder**: Erkennt PDF-Felder und generiert dynamische Formulare
- **🔧 Konfigurations-Editor**: Visueller Editor für PDF-Feldkonfigurationen
- **📊 Daten-Editor**: Bearbeitung gespeicherter JSON-Datensätze
- **✍️ Digitale Unterschriften**: Zeichnen oder Upload von Signaturen
- **💾 Export-Funktionen**: Flache oder bearbeitbare PDFs mit konfigurierbaren Dateinamen
- **📧 E-Mail-Integration**: Direkter E-Mail-Draft mit ausgefüllten Formularen

## Anwendungen

Nach dem Start sind folgende Module verfügbar:

- **🏠 Startseite**: http://localhost:8080/
- **📄 PDF Formular Ausfüller**: http://localhost:8080/app/main/
- **🔧 Konfigurations-Editor**: http://localhost:8080/app/config/
- **📊 Daten-Editor**: http://localhost:8080/app/data-editor/

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

## 🚀 Neue Features (2025)

### PDF-Auswahl mit Live-Vorschau
- **Split-Screen Layout**: 50% PDF-Liste, 50% Live-Vorschau
- **Echte PDF-Anzeige**: Hover-Vorschau zeigt tatsächlichen PDF-Inhalt
- **Klickbare Einträge**: Gesamte PDF-Einträge sind zur Auswahl anklickbar
- **Persistente Auswahl**: Zuletzt ausgewähltes PDF bleibt in der Vorschau

### Verbesserte Benutzeroberfläche
- **Email-Client Layout**: Moderne, professionelle Benutzeroberfläche
- **Optimierte Navigation**: Einheitliches Verhalten zwischen Sidebar und Buttons
- **Responsive Design**: Funktioniert auf Desktop und Mobile
- **Notification System**: Moderne Toast-Benachrichtigungen

### Formular-Verbesserungen
- **Bessere Checkbox/Radio-Formatierung**: Links-bündige, saubere Ausrichtung
- **Live-Vorschau Optimierung**: Verwendet 95% des verfügbaren Platzes
- **Daten-Editor**: Vollständige JSON-Datensatz-Bearbeitung
- **Verbesserte Feldtypen**: Automatische Erkennung und Validierung

## Konfiguration

Die Anwendung verwendet YAML-Konfigurationsdateien im `app/formulare/` Verzeichnis zur Konfiguration der PDF-Felder. Drei spezialisierte Editoren sind verfügbar:

### 🔧 Konfigurations-Editor (`/app/config/`)
- Visueller Editor für PDF-Feldkonfigurationen
- Drag & Drop Feldorganisation
- Erweiterte Unterschrift-Positionierung
- Live-Vorschau der Konfigurationsänderungen

### 📊 Daten-Editor (`/app/data-editor/`)
- Bearbeitung gespeicherter JSON-Datensätze
- Hinzufügen, Ändern und Löschen von Feldern
- Alphabetische Sortierung
- Suchfunktionalität

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

## 🏗️ Technische Details

### Frontend-Architektur
- **Vanilla JavaScript**: Keine externen Frameworks, optimale Performance
- **Modulare Struktur**: Getrennte Module für PDF-Handling, UI, Forms, etc.
- **PDF-lib Integration**: Direkte PDF-Manipulation und -Rendering
- **Canvas-basierte Unterschriften**: Hochauflösende digitale Signaturen

### Backend-Integration
- **Statische Bereitstellung**: Nginx/Apache ready
- **PHP-Unterstützung**: Optionale Serverseitige Funktionen
- **Docker-optimiert**: Multi-Stage Build, Alpine Linux (130MB)
- **Entwicklungsfreundlich**: Hot-Reload, Cache-Kontrolle