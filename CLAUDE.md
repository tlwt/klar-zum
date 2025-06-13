# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## GIT handling

always ask user for confirmation that feature works before committing.

## Project Overview

Reservist-Digital is a modern web-based PDF form filler for German military reservist documentation. It features a sophisticated multi-app architecture with live PDF preview, intelligent form generation, and visual configuration editors.

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

### Multi-App Structure

The application consists of three separate but integrated web applications:

1. **Main App** (`app/main/`) - Core PDF form filling functionality
2. **Config Editor** (`app/config/`) - Visual YAML configuration editor  
3. **Data Editor** (`app/data-editor/`) - JSON dataset editing and management

### Module Structure (Main App)

- `js/app.js` - Main application initialization and loading
- `js/config.js` - Global configuration and state management
- `js/pdf-handler.js` - PDF loading, filling, and signature handling with pdf-lib
- `js/form-generator.js` - Dynamic form generation from YAML configs
- `js/calculation-engine.js` - Formula evaluation for calculated fields
- `js/data-manager.js` - Save/load form data as JSON
- `js/ui-manager.js` - Email-client style UI with navigation and PDF preview
- `js/pdf-preview.js` - Live PDF preview functionality

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

#### Main Application Features
- **Live PDF Preview**: Real-time 95% viewport PDF preview with split-screen layout
- **Smart PDF Selection**: 50/50 layout with hover preview showing actual PDF content
- **Email-Client UI**: Modern, professional interface with sidebar navigation
- **Digital Signatures**: Canvas-based drawing and image upload with precise positioning
- **Calculated Fields**: Support formulas like `CONCAT({field1}, " ", {field2})`
- **Field Mapping**: Map form fields to different PDF field names
- **Multi-PDF Generation**: Fill multiple PDFs simultaneously (flat or editable)
- **Export Options**: Configurable filename patterns and email integration

#### User Interface Improvements (2025)
- **Clickable PDF Entries**: Entire PDF selection items are clickable
- **Improved Form Controls**: Left-aligned checkboxes/radio buttons with proper spacing
- **Notification System**: Modern toast notifications replacing status bars
- **Responsive Design**: Mobile-friendly with adaptive layouts
- **Navigation Consistency**: Unified behavior between sidebar and action buttons

### Configuration Editor

Visual YAML configuration editor at `app/config/index.html`. Access at `http://localhost:8000/app/config/`

Features:
- **Drag & Drop Interface**: Visual field organization and grouping
- **Signature Positioning**: Advanced coordinate system with visual helpers
- **Field Type Management**: Comprehensive form field configuration
- **Live Validation**: Real-time YAML syntax checking

**Direct Save Feature**: If `allowConfigWrite: true` is set in `config.yaml`, shows "🚀 Konfiguration direkt speichern" button for server-side saves.

### Data Editor

JSON dataset management application at `app/data-editor/index.html`. Access at `http://localhost:8000/app/data-editor/`

Features:
- **Field Management**: Add, edit, delete fields in saved datasets
- **Search & Filter**: Real-time field searching and filtering
- **Alphabetical Sorting**: Organize fields for better usability
- **Type Validation**: Support for different field types (text, email, date, etc.)
- **Signature Editing**: Visual signature editor with canvas and upload support

## Common Tasks

### Adding a New PDF Form

1. Add PDF to `app/formulare/` directory
2. Add PDF entry to `app/config.yaml`
3. Use config editor (`app/config/`) to map fields and configure signatures
4. Test with main application (`app/main/`) using live preview
5. Verify PDF selection hover preview works correctly

### Debugging PDF Issues

- Check browser console for pdf-lib errors
- Verify YAML syntax and field mappings in config editor
- Test PDF selection hover preview for proper rendering
- Use network tab to check PDF loading (path: `../formulare/filename.pdf`)
- Ensure caching headers are set to `no-cache` for development
- Check live preview functionality with real-time updates

### Working with Signatures

- Signature positioning uses PDF coordinates (bottom-left origin)
- Use config editor's signature positioning tool with coordinate helpers
- Test signature placement in live preview mode
- Coordinates are stored in YAML under signature field configuration
- Support both canvas drawing and image upload methods

### UI/UX Development

- **Layout Issues**: Check for `live-preview-active` class conflicts when switching views
- **Navigation**: Ensure sidebar menu items and action buttons trigger correct functions
- **Form Controls**: Use `.checkbox-container` and `.radio-container` classes for proper alignment
- **Notifications**: Use `showNotification()` function instead of old status bar methods
- **Responsive**: Test mobile layout with stacked preview panels

## Issue Management

- use tea to manage issues

## Docker Usage

- denk daran, dass du immer docker nutzt, wenn funktionen getestet werden.

## Container Deployment Notes

- der container muß nicht neu gestartet werden, die änderungen werden per volumen eingebunden
- Der Port ist 8080 vom container