// js/config.js
// Globale Variablen und Konfiguration

// Explizit am window-Objekt definieren für globalen Zugriff
window.availablePDFs = [];
window.pdfFields = new Map();
window.pdfConfigs = new Map(); // Individuelle Konfigurationen pro PDF
window.selectedPDFs = new Set();
window.calculatedFields = new Set(); // Felder mit Berechnungen
window.hiddenData = {}; // Daten, die nicht in Formularen verwendet werden

window.appSettings = {
    fileNamePattern: '[Nachname], [Vorname] - [PDF] - [Datum]',
    emailAddress: '',
    emailSubject: 'Formularunterlagen - [Nachname], [Vorname]',
    emailBody: 'Sehr geehrte Damen und Herren,\n\nanbei übersende ich Ihnen die ausgefüllten Formularunterlagen.\n\nMit freundlichen Grüßen'
};