// config/js/config-app.js
// Config App Initialisierung - Erweitert mit verbesserter Felderkennung

window.availablePDFs = [];

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
        
        // Direkter Ansatz: Button sofort anzeigen wenn allowConfigWrite true ist
        const saveDirectBtn = document.getElementById('saveDirectBtn');
        console.log('🔧 DIREKT: saveDirectBtn gefunden:', !!saveDirectBtn);
        console.log('🔧 DIREKT: allowConfigWrite:', window.globalConfig?.allowConfigWrite);
        
        if (saveDirectBtn && window.globalConfig?.allowConfigWrite === true) {
            saveDirectBtn.style.display = 'inline-block';
            console.log('🔧 DIREKT: Button angezeigt!');
        } else {
            console.log('🔧 DIREKT: Button NICHT angezeigt');
        }
        
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
        
        // Speichere globale Konfiguration für spätere Verwendung
        window.globalConfig = config;
        
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
            
            // Automatische Typerkennung initialisieren falls nicht vorhanden
            if (!window.currentConfig) window.currentConfig = { fields: {}, groups: {} };
            if (!window.currentConfig.fields) window.currentConfig.fields = {};
            
            if (!window.currentConfig.fields[fieldName]) {
                window.currentConfig.fields[fieldName] = {};
            }
            
            // Automatische Unterschrift-Erkennung
            const signaturePatterns = [
                /unterschrift/i,
                /signature/i,
                /sign/i,
                /datum.*ort/i,
                /ort.*datum/i
            ];
            
            if (signaturePatterns.some(pattern => pattern.test(fieldName))) {
                window.currentConfig.fields[fieldName].type = 'signature';
                window.currentConfig.fields[fieldName].group = 'Unterschriften';
                console.log(`${fieldName} automatisch als Unterschrift erkannt`);
            }
            
            // Radio Button/Checkbox Erkennung erweitert
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
                                if (field.constructor.name === 'PDFRadioGroup') {
                                    options.push(...field.getOptions());
                                }
                            } catch (e) {
                                console.log('PDFRadioGroup.getOptions() fehlgeschlagen, versuche Fallback-Optionen');
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
                                } else {
                                    // Standard Ja/Nein für unbekannte Radio Buttons
                                    options.push('Ja', 'Nein');
                                }
                            }
                            
                            if (options.length > 0) {
                                console.log(`Radio Button ${fieldName} Optionen:`, options);
                                window.currentConfig.fields[fieldName].type = 'radio';
                                window.currentConfig.fields[fieldName].options = options;
                                window.currentConfig.fields[fieldName].group = window.currentConfig.fields[fieldName].group || 'Einverständnis';
                            }
                        }
                    }
                }
            } catch (acroError) {
                console.log(`Fehler beim Analysieren des AcroFields für ${fieldName}:`, acroError);
            }
        }
        
    } catch (error) {
        console.log(`Keine Formularfelder in ${pdfName} gefunden oder Fehler beim Parsen:`, error);
    }
    
    // Fallback für bekannte PDFs ohne erkennbare Felder
    if (extractedFields.length === 0) {
        console.log(`Verwende Fallback-Felder für ${pdfName}`);
        
        if (pdfName.includes('5120') || pdfName.includes('Einverständnis') || pdfName.includes('EV')) {
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
            
            // Automatische Konfiguration für bekannte Feldtypen
            const fieldConfigurations = {
                // Radio Button Gruppen
                'Ueberschrift': {
                    type: 'radio',
                    options: ['einer Übung nach § 61 SG', 'eines Wehrdienstes zur temporären Verbesserung der personellen Einsatzbereitschaft nach § 63b SG'],
                    group: 'Einverständnis'
                },
                'EinverstaendnisZurAbleistung': {
                    type: 'radio',
                    options: ['einer Übung nach § 61 SG', 'eines Wehrdienstes zur temporären Verbesserung der personellen Einsatzbereitschaft nach § 63b SG'],
                    group: 'Einverständnis'
                },
                'Strafverfahren': {
                    type: 'radio',
                    options: ['Ja', 'Nein'],
                    group: 'Einverständnis'
                },
                'WiederverwendungBerufssoldatin': {
                    type: 'radio',
                    options: ['Ja', 'Nein'],
                    group: 'Dienstleistung'
                },
                'AnreiseGutscheine': {
                    type: 'radio',
                    options: ['Ja', 'Nein'],
                    group: 'Dienstleistung'
                },
                
                // Dropdown Gruppen
                'DienstgradDerReserve': {
                    type: 'select',
                    options: ['Leutnant d.R.', 'Oberleutnant d.R.', 'Hauptmann d.R.', 'Major d.R.', 'Oberstleutnant d.R.', 'Oberst d.R.'],
                    group: 'Persönliche Daten'
                },
                
                // Unterschriftenfelder
                'UnterschriftReservist': {
                    type: 'signature',
                    group: 'Unterschriften',
                    signature_width: 200,
                    signature_height: 100
                },
                'DatumOrtUnterschrift': {
                    type: 'signature',
                    group: 'Unterschriften',
                    signature_width: 200,
                    signature_height: 100
                },
                
                // E-Mail Feld
                'EMail': {
                    type: 'email',
                    group: 'Kontaktdaten'
                },
                
                // Telefon Feld
                'Telefon': {
                    type: 'tel',
                    group: 'Kontaktdaten'
                },
                
                // Datum Felder
                'Datum': {
                    type: 'date',
                    group: 'Persönliche Daten'
                }
            };
            
            // Konfigurationen anwenden
            Object.keys(fieldConfigurations).forEach(fieldName => {
                if (!window.currentConfig.fields) window.currentConfig.fields = {};
                window.currentConfig.fields[fieldName] = fieldConfigurations[fieldName];
                
                if (!fallbackFields.includes(fieldName)) {
                    fallbackFields.push(fieldName);
                }
            });
            
            extractedFields.push(...fallbackFields);
        }
    }
    
    return [...new Set(extractedFields)];
}

// Neue Funktionen für direktes Speichern
function checkDirectSavePermission(config) {
    console.log('🔍 DEBUG: Prüfe Direct Save Permission');
    console.log('🔍 DEBUG: Config object:', config);
    console.log('🔍 DEBUG: allowConfigWrite value:', config?.allowConfigWrite);
    console.log('🔍 DEBUG: allowConfigWrite type:', typeof config?.allowConfigWrite);
    
    const allowConfigWrite = config?.allowConfigWrite === true;
    console.log('🔍 DEBUG: allowConfigWrite boolean:', allowConfigWrite);
    
    const saveDirectBtn = document.getElementById('saveDirectBtn');
    console.log('🔍 DEBUG: saveDirectBtn element:', saveDirectBtn);
    console.log('🔍 DEBUG: saveDirectBtn exists:', !!saveDirectBtn);
    
    if (saveDirectBtn) {
        console.log('🔍 DEBUG: Button current style.display:', saveDirectBtn.style.display);
        console.log('🔍 DEBUG: Button current visibility:', window.getComputedStyle(saveDirectBtn).display);
    }
    
    if (allowConfigWrite && saveDirectBtn) {
        saveDirectBtn.style.display = 'inline-block';
        console.log('✅ ERFOLG: Button wird angezeigt');
        console.log('🔍 DEBUG: Button style nach Änderung:', saveDirectBtn.style.display);
    } else {
        console.log('❌ FEHLER: Button wird NICHT angezeigt');
        if (!allowConfigWrite) console.log('  - Grund: allowConfigWrite ist', allowConfigWrite);
        if (!saveDirectBtn) console.log('  - Grund: saveDirectBtn Element nicht gefunden');
    }
}

async function saveConfigDirect() {
    if (!window.currentConfig || !window.currentPDF) {
        showConfigStatus('Keine Konfiguration zum Speichern ausgewählt. Bitte wählen Sie zuerst ein PDF aus.', 'error');
        return;
    }
    
    // Prüfe nochmals die Berechtigung
    if (!window.globalConfig?.allowConfigWrite) {
        showConfigStatus('Direktes Speichern ist nicht erlaubt (allowConfigWrite: false)', 'error');
        return;
    }
    
    try {
        const config = buildFinalConfig();
        const yamlContent = jsyaml.dump(config, {
            indent: 2,
            lineWidth: -1,
            noRefs: true,
            sortKeys: false
        });
        const configName = window.currentPDF.name.replace('.pdf', '.yaml');
        
        // Erstelle FormData für den Upload
        const formData = new FormData();
        const blob = new Blob([yamlContent], { type: 'text/yaml' });
        formData.append('file', blob, configName);
        
        // Versuche die Datei zu speichern
        // Option 1: Verwende PHP-Endpoint (falls verfügbar)
        let response;
        try {
            response = await fetch(`../save-config.php/${encodeURIComponent(configName)}`, {
                method: 'PUT',
                body: yamlContent,
                headers: {
                    'Content-Type': 'text/yaml',
                },
            });
        } catch (phpError) {
            // Option 2: Direkter PUT auf formulare/ (funktioniert nur mit entsprechendem Server)
            response = await fetch(`../formulare/${encodeURIComponent(configName)}`, {
                method: 'PUT',
                body: yamlContent,
                headers: {
                    'Content-Type': 'text/yaml',
                },
            });
        }
        
        if (response.ok) {
            showConfigStatus(`✅ Konfiguration ${configName} erfolgreich gespeichert!`, 'success');
        } else {
            // Fallback: Download anbieten
            throw new Error(`Server-Antwort: ${response.status} ${response.statusText}`);
        }
        
    } catch (error) {
        console.warn('Direktes Speichern fehlgeschlagen:', error);
        showConfigStatus(`⚠️ Direktes Speichern nicht möglich: ${error.message}. Verwenden Sie den Download-Button.`, 'warning');
        
        // Fallback auf Download
        setTimeout(() => {
            saveAndDownloadConfig();
        }, 2000);
    }
}