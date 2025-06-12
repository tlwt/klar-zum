# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Reservist-Digital is a web-based PDF form filler for German military reservist documentation. It's a pure frontend application using vanilla JavaScript with no build process.

## Development Setup

This is a static web application that requires a local web server due to CORS restrictions:

```bash
# Python 3
python -m http.server 8000

# Python 2
python -m SimpleHTTPServer 8000

# Node.js
npx http-server
```

## Architecture

### Module Structure
- `js/app.js` - Main application initialization
- `js/config.js` - Global configuration and state management
- `js/pdf-handler.js` - PDF loading, filling, and signature handling
- `js/form-generator.js` - Dynamic form generation from YAML configs
- `js/calculation-engine.js` - Formula evaluation for calculated fields
- `js/data-manager.js` - Save/load form data as JSON
- `js/ui-manager.js` - UI interactions and tab management

### Configuration System
Forms are configured via YAML files in `formulare/` directory. Example structure:
```yaml
sections:
  - title: "Personal Data"
    fields:
      - name: "Nachname"
        type: "text"
        label: "Nachname"
        required: true
        pdfMapping:
          default: "Nachname"
```

### Key Features
- **Digital Signatures**: Canvas-based drawing with configurable PDF positioning
- **Calculated Fields**: Support formulas like `CONCAT({field1}, " ", {field2})`
- **Field Mapping**: Map form fields to different PDF field names
- **Multi-PDF Generation**: Fill multiple PDFs at once

### Configuration Editor
Separate application at `app/config/index.html` for creating/editing YAML configurations. Access at `http://localhost:8000/app/config/`

**Direct Save Feature**: If `allowConfigWrite: true` is set in `config.yaml`, the configuration editor shows an additional "🚀 Konfiguration direkt speichern" button that attempts to save configurations directly to the server (requires PUT endpoint support).

## Common Tasks

### Adding a New PDF Form
1. Add PDF to `app/formulare/` directory
2. Add PDF entry to `app/config.yaml`
3. Use config editor (`app/config/`) to map fields
4. Test with main application (`app/main/`)

### Debugging PDF Issues
- Check browser console for pdf-lib errors
- Verify YAML syntax and field mappings
- Use `test-form.html` for isolated testing
- Enable caching headers are set to `no-cache` for development

### Working with Signatures
- Signature positioning uses PDF coordinates (bottom-left origin)
- Test signature placement using `unterschrift.html`
- Coordinates are stored in YAML under `signatureConfig`