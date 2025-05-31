// config/js/config-app.js
// Config App Initialisierung - Aktualisiert für config.yaml und Dropdown-Support

window.addEventListener('load', async function() {
    await initializeConfigApp();
});

async function initializeConfigApp() {
    try {
        // Verwende config.yaml anstatt Verzeichnis-Listing
        await loadPDFsFromConfig();
        populatePDFSelector();
        
        document.getElementById('loading').style.display = 'none';
        document.getElementById('mainContent').style.display = 'block';
    } catch (error) {
        console.error('Fehler beim Initialisieren:', error);
        showConfigStatus('Fehler beim Laden der PDF-Formulare: ' + error.message, 'error');
        document.getElementById('loading').style.display = 'none';
        document.getElementById('errorMessage').style.display = 'block';
    }
}

async function loadPDFsFromConfig() {
    try {
        // Lade config.yaml für PDF-Liste (aus Hauptverzeichnis)
        const configResponse = await fetch('../config.yaml');
        if (!configResponse.ok) {
            throw new Error('config.yaml nicht gefunden im Hauptverzeichnis');
        }
        
        const configText = await configResponse.text();
        const config = jsyaml.load(configText);
        
        if (!config.pdfs || !Array.isArray(config.pdfs)) {
            throw new Error('Keine PDFs in config.yaml definiert');
        }
        
        console.log(`Lade ${config.pdfs.length} PDFs aus config.yaml`);
        
        for (const pdfInfo of config.pdfs) {
            const pdfName = pdfInfo.name;
            
            try {
                const response = await fetch(`../formulare/${encodeURIComponent(pdfName)}`);
                if (response.ok) {
                    const arrayBuffer = await response.arrayBuffer();
                    const pdfDoc = await PDFLib.PDFDocument.load(arrayBuffer);
                    const fields = await extractFieldsFromPDFConfig(pdfDoc, pdfName);
                    
                    window.availablePDFs.push({
                        name: pdfName,
                        path: `../formulare/${pdfName}`,
                        fields: fields,
                        description: pdfInfo.description || '',
                        category: pdfInfo.category || 'Sonstige'
                    });
                    
                    console.log(`✓ PDF geladen: ${pdfName} (${fields.length} Felder)`);
                } else {
                    console.warn(`PDF nicht gefunden: ${pdfName}`);
                }
            } catch (error) {
                console.warn(`Fehler beim Laden von ${pdfName}:`, error);
            }
        }
        
        if (window.availablePDFs.length === 0) {
            throw new Error('Keine PDF-Formulare konnten geladen werden');
        }
        
        console.log(`Insgesamt ${window.availablePDFs.length} PDFs erfolgreich geladen`);
        
    } catch (error) {
        console.error('Fehler beim Laden der PDF-Konfiguration:', error);
        throw error;
    }
}

async function extractFieldsFromPDFConfig(pdfDoc, pdfName) {
    const extractedFields = [];
    
    try {
        const form = pdfDoc.getForm();
        const fields = form.getFields();
        
        console.log(`Analysiere ${fields.length} Felder in ${pdfName}`);
        
        for (const field of fields) {
            const fieldName = field.getName();
            console.log(`Feld gefunden: ${fieldName}, Typ: ${field.constructor.name}`);
            
            extractedFields.push(fieldName);
            
            // Erweiterte Radio Button/Checkbox Erkennung für automatische Konfiguration
            try {
                const acroField = field.acroField;
                if (acroField && acroField.dict) {
                    const fieldType = acroField.dict.get(PDFLib.PDFName.of('FT'));
                    const fieldFlags = acroField.dict.get(PDFLib.PDFName.of('Ff'));
                    
                    // Check für Radio Button basierend auf Flags
                    if (fieldType && fieldType.toString() === '/Btn' && fieldFlags) {
                        const flagsValue = fieldFlags.value || 0;
                        const isRadio = (flagsValue & (1 << 15)) !== 0; // Radio Button Flag
                        const isPushButton = (flagsValue & (1 << 16)) !== 0; // Push Button Flag
                        
                        if (isRadio && !isPushButton) {
                            console.log(`${fieldName} ist ein Radio Button (über Flags erkannt)`);
                            
                            // Versuche Optionen zu extrahieren
                            const options = [];
                            try {
                                // Methode 1: Über PDFRadioGroup API
                                if (field.constructor.name === 'PDFRadioGroup') {
                                    options.push(...field.getOptions());
                                }
                            } catch (e) {
                                console.log('PDFRadioGroup.getOptions() fehlgeschlagen, versuche manuelle Extraktion');
                            }
                            
                            // Fallback: Bekannte Optionen für häufige Felder
                            if (options.length === 0) {
                                if (fieldName.toLowerCase().includes('strafverfahren')) {
                                    options.push('Ja', 'Nein');
                                } else if (fieldName.toLowerCase().includes('ueberschrift') || fieldName.toLowerCase().includes('einverstaendnis')) {
                                    options.push('einer Übung nach § 61 SG', 'eines Wehrdienstes zur temporären Verbesserung der personellen Einsatzbereitschaft nach § 63b SG');
                                } else if (fieldName.toLowerCase().includes('anreise')) {
                                    options.push('Ja', 'Nein');
                                } else if (fieldName.toLowerCase().includes('wiederverwendung')) {
                                    options.push('Ja', 'Nein');
                                }
                            }
                            
                            if (options.length > 0) {
                                console.log(`Radio Button ${fieldName} Optionen gefunden:`, options);
                                
                                // Speichere in temporärer Konfiguration für automatische Erkennung
                                if (!window.currentConfig.fields) window.currentConfig.fields = {};
                                if (!window.currentConfig.fields[fieldName]) {
                                    window.currentConfig.fields[fieldName] = {};
                                }
                                window.currentConfig.fields[fieldName].type = 'radio';
                                window.currentConfig.fields[fieldName].options = options;
                                window.currentConfig.fields[fieldName].group = window.currentConfig.fields[fieldName].group || 'Sonstige';
                            }
                        }
                    }
                }
            } catch (acroError) {
                console.log(`Fehler beim Analysieren des AcroFields für ${fieldName}:`, acroError);
            }
        }
        
    } catch (error) {
        console.log(`Keine Formularfelder in ${pdfName} gefunden`);
    }
    
    // Fallback für bekannte PDFs ohne erkennbare Felder
    if (extractedFields.length === 0) {
        if (pdfName.includes('5120') || pdfName.includes('Arbeitgeber') || pdfName.includes('EV')) {
            const fallbackFields = [
                'Nachname', 'Vorname', 'DienstgradDerReserve', 'Personalnummer', 'Personenkennziffer',
                'StrasseHausnummerPostleitzahlOrt', 'Datum', 'Telefon', 'Fax', 'EMail',
                'AnschriftDienstleistungstruppenteil', 'Dienstleistungsdienststelle', 'OrtStandortDerDienstleistungsstelle',
                'KurzfristigeHeranziehung', 'HeranziehungsbescheidWiderspruch',
                'Mandatstraegerin', 'BeamtenArbeitsverhältnisBMVg', 'BeamtenArbeitsverhaeltnisOeffentlich',
                'Arbeitsverhaeltnis', 'Selbststaendig', 'KeinArbeitsverhaeltnis', 'PensionaerSchueler',
                'WiederverwendungBerufssoldatin', 'AnreiseGutscheine', 'InteressenskollisionAusgeschlossen',
                'UnternehmenGeschaeftsverbindungen', 'UnternehmenBewerber', 'OrganisationWirtschaft',
                'OrganisationInteressenvertreter', 'UebungZusammenhangBundeswehrauftrag'
            ];
            
            // Radio Button Gruppen mit Standardoptionen hinzufügen
            const radioGroups = {
                'Ueberschrift': ['einer Übung nach § 61 SG', 'eines Wehrdienstes zur temporären Verbesserung der personellen Einsatzbereitschaft nach § 63b SG'],
                'EinverstaendnisZurAbleistung': ['einer Übung nach § 61 SG', 'eines Wehrdienstes zur temporären Verbesserung der personellen Einsatzbereitschaft nach § 63b SG'],
                'Strafverfahren': ['Ja', 'Nein'],
                'WiederverwendungBerufssoldatin': ['Ja', 'Nein'],
                'AnreiseGutscheine': ['Ja', 'Nein']
            };
            
            // Zusätzliche Dropdown-Beispiele für Demonstration
            const dropdownGroups = {
                'Dienstgrad': ['Leutnant d.R.', 'Oberleutnant d.R.', 'Hauptmann d.R.', 'Major d.R.', 'Oberstleutnant d.R.', 'Oberst d.R.'],
                'Standort': ['Berlin', 'Hamburg', 'München', 'Köln', 'Frankfurt']
            };
            
            Object.keys(radioGroups).forEach(groupName => {
                fallbackFields.push(groupName);
                if (!window.currentConfig.fields) window.currentConfig.fields = {};
                window.currentConfig.fields[groupName] = {
                    type: 'radio',
                    options: radioGroups[groupName],
                    group: 'Einverständnis'
                };
            });
            
            Object.keys(dropdownGroups).forEach(groupName => {
                fallbackFields.push(groupName);
                if (!window.currentConfig.fields) window.currentConfig.fields = {};
                window.currentConfig.fields[groupName] = {
                    type: 'select',
                    options: dropdownGroups[groupName],
                    group: 'Persönliche Daten'
                };
            });
            
            extractedFields.push(...fallbackFields);
        }
    }
    
    return [...new Set(extractedFields)];
}