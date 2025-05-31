// js/pdf-handler.js
// PDF-Verarbeitung und -Verwaltung - Aktualisiert für config.yaml

function extractFieldOrderFromYaml(yamlText, pdfName) {
    // Extrahiere die Feldreihenfolge aus dem ursprünglichen YAML-Text
    const lines = yamlText.split('\n');
    let inFieldsSection = false;
    const extractedOrder = {};
    const fieldToGroupMap = {};
    const fieldOrder = []; // Originale Reihenfolge aller Felder
    
    console.log(`=== YAML-PARSING für ${pdfName} ===`);
    
    // Erst alle Felder sammeln und deren Gruppen bestimmen
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        if (line.trim() === 'fields:') {
            inFieldsSection = true;
            console.log('Fields-Sektion gefunden');
            continue;
        }
        
        if (inFieldsSection) {
            // Ende der fields-Sektion erreicht
            if (line.trim() !== '' && !line.startsWith(' ') && !line.startsWith('\t')) {
                console.log('Ende der Fields-Sektion erreicht');
                break;
            }
            
            // Feld-Definition (beginnt mit 2 Leerzeichen, gefolgt von Feldname:)
            const fieldMatch = line.match(/^  ([^:]+):/);
            if (fieldMatch) {
                const fieldName = fieldMatch[1].trim();
                fieldOrder.push(fieldName); // Originale Reihenfolge speichern
                console.log(`Feld gefunden: ${fieldName} (Position ${fieldOrder.length})`);
                
                let fieldGroup = 'Sonstige'; // Fallback
                
                // Suche nach der group-Zeile für dieses Feld
                for (let j = i + 1; j < lines.length; j++) {
                    const nextLine = lines[j];
                    
                    // Wenn wir das nächste Feld erreichen, stoppe die Suche
                    if (nextLine.match(/^  [^:]+:/)) {
                        break;
                    }
                    
                    // Gruppe gefunden
                    const groupMatch = nextLine.match(/^\s+group:\s*(.+)$/);
                    if (groupMatch) {
                        fieldGroup = groupMatch[1].trim();
                        console.log(`  → Gruppe: ${fieldGroup}`);
                        break;
                    }
                }
                
                fieldToGroupMap[fieldName] = fieldGroup;
            }
        }
    }
    
    // Jetzt die Felder in der ursprünglichen Reihenfolge zu ihren Gruppen zuordnen
    fieldOrder.forEach(fieldName => {
        const groupName = fieldToGroupMap[fieldName] || 'Sonstige';
        
        if (!extractedOrder[groupName]) {
            extractedOrder[groupName] = [];
        }
        extractedOrder[groupName].push(fieldName);
    });
    
    // Zusätzlich: Gruppen-Reihenfolge aus groups-Sektion extrahieren
    const groupOrder = [];
    let inGroupsSection = false;
    
    for (const line of lines) {
        if (line.trim() === 'groups:') {
            inGroupsSection = true;
            continue;
        }
        
        if (inGroupsSection) {
            if (line.trim() !== '' && !line.startsWith(' ') && !line.startsWith('\t')) {
                break;
            }
            
            const groupMatch = line.match(/^  ([^:]+):/);
            if (groupMatch) {
                const groupName = groupMatch[1].trim();
                if (!groupOrder.includes(groupName)) {
                    groupOrder.push(groupName);
                    console.log(`Gruppe gefunden: ${groupName} (Position ${groupOrder.length})`);
                }
            }
        }
    }
    
    // Speichere beide Ordnungen in globalen Maps
    if (!window.yamlFieldOrders) {
        window.yamlFieldOrders = new Map();
    }
    if (!window.yamlGroupOrders) {
        window.yamlGroupOrders = new Map();
    }
    
    window.yamlFieldOrders.set(pdfName, extractedOrder);
    window.yamlGroupOrders.set(pdfName, groupOrder);
    
    console.log(`YAML-Feldreihenfolge für ${pdfName} extrahiert:`, extractedOrder);
    console.log(`YAML-Gruppenreihenfolge für ${pdfName} extrahiert:`, groupOrder);
    console.log(`=== ENDE YAML-PARSING ===\n`);
    
    return extractedOrder;
}

async function loadPDFConfigForFile(pdfName) {
    try {
        const configName = pdfName.replace('.pdf', '.yaml');
        const response = await fetch(`./formulare/${encodeURIComponent(configName)}`);
        if (response.ok) {
            const yamlText = await response.text();
            const config = jsyaml.load(yamlText);
            window.pdfConfigs.set(pdfName, config);
            
            // Extrahiere Feldreihenfolge aus YAML-Text
            extractFieldOrderFromYaml(yamlText, pdfName);
            
            console.log(`Konfiguration für ${pdfName} geladen:`, config);
            return true;
        }
    } catch (error) {
        console.log(`Keine Konfiguration für ${pdfName} gefunden oder Fehler beim Laden`);
    }
    window.pdfConfigs.set(pdfName, {});
    return false;
}

async function loadPDFsFromDirectory() {
    try {
        // Lade config.yaml für PDF-Liste
        const configResponse = await fetch('./config.yaml');
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
                const response = await fetch(`./formulare/${encodeURIComponent(pdfName)}`);
                if (response.ok) {
                    const arrayBuffer = await response.arrayBuffer();
                    const pdfDoc = await PDFLib.PDFDocument.load(arrayBuffer);
                    const fields = await extractFieldsFromPDF(pdfDoc, pdfName);
                    
                    // Lade individuelle Konfiguration für dieses PDF
                    const hasConfig = await loadPDFConfigForFile(pdfName);
                    
                    window.availablePDFs.push({
                        name: pdfName,
                        path: `./formulare/${pdfName}`,
                        document: pdfDoc,
                        fields: fields,
                        hasConfig: hasConfig,
                        description: pdfInfo.description || '',
                        category: pdfInfo.category || 'Sonstige'
                    });
                    
                    window.pdfFields.set(pdfName, fields);
                    console.log(`✓ PDF geladen: ${pdfName}`);
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

async function extractFieldsFromPDF(pdfDoc, pdfName) {
    const extractedFields = [];
    
    try {
        const form = pdfDoc.getForm();
        const fields = form.getFields();
        
        for (const field of fields) {
            const fieldName = field.getName();
            extractedFields.push(fieldName);
            
            // Prüfe ob es sich um eine Radio Button Gruppe handelt
            if (field.constructor.name === 'PDFRadioGroup') {
                try {
                    const options = field.getOptions();
                    console.log(`Radio Group ${fieldName} gefunden mit Optionen:`, options);
                } catch (error) {
                    console.warn(`Fehler beim Auslesen der Radio Group Optionen für ${fieldName}:`, error);
                }
            }
        }
    } catch (error) {
        console.log(`Keine Formularfelder in ${pdfName} gefunden`);
    }
    
    if (extractedFields.length === 0) {
        if (pdfName.includes('5120') || pdfName.includes('Arbeitgeber') || pdfName.includes('EV')) {
            extractedFields.push(
                'Nachname', 'Vorname', 'DienstgradDerReserve', 'Personalnummer', 'Personenkennziffer',
                'StrasseHausnummerPostleitzahlOrt', 'Datum', 'Telefon', 'Fax', 'EMail',
                'AnschriftDienstleistungstruppenteil', 'Dienstleistungsdienststelle', 'OrtStandortDerDienstleistungsstelle',
                'EinverstaendnisZurAbleistung', 'Strafverfahren', 'KurzfristigeHeranziehung', 'HeranziehungsbescheidWiderspruch',
                'Mandatstraegerin', 'BeamtenArbeitsverhältnisBMVg', 'BeamtenArbeitsverhaeltnisOeffentlich',
                'Arbeitsverhaeltnis', 'Selbststaendig', 'KeinArbeitsverhaeltnis', 'PensionaerSchueler',
                'WiederverwendungBerufssoldatin', 'AnreiseGutscheine', 'InteressenskollisionAusgeschlossen',
                'UnternehmenGeschaeftsverbindungen', 'UnternehmenBewerber', 'OrganisationWirtschaft',
                'OrganisationInteressenvertreter', 'UebungZusammenhangBundeswehrauftrag'
            );
        }
    }
    
    return [...new Set(extractedFields)];
}

async function fillAndDownloadPDF(pdf, data) {
    try {
        const pdfBytes = await pdf.document.save();
        const pdfDoc = await PDFLib.PDFDocument.load(pdfBytes);
        const form = pdfDoc.getForm();
        
        const helveticaFont = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);
        
        try {
            const acroForm = pdfDoc.catalog.getOrCreateAcroForm();
            acroForm.dict.set(
                PDFLib.PDFName.of('DR'),
                pdfDoc.context.obj({ 
                    Font: pdfDoc.context.obj({ 
                        Helv: helveticaFont.ref 
                    }) 
                })
            );
        } catch (error) {
            console.warn('Fehler beim Setzen der Default Resources:', error);
        }
        
        let filledFields = 0;
        const formData = getAllFormData();
        const pdfConfig = window.pdfConfigs.get(pdf.name) || {};
        
        // DEBUG: Alle Felder im PDF anzeigen
        console.log('\n=== PDF FELDANALYSE ===');
        console.log(`PDF: ${pdf.name}`);
        const allFields = form.getFields();
        console.log(`Gefundene Felder im PDF (${allFields.length}):`);
        allFields.forEach((field, index) => {
            const fieldName = field.getName();
            const fieldType = field.constructor.name;
            console.log(`  ${index + 1}. "${fieldName}" (${fieldType})`);
            
            // Spezielle Info für Radio Groups
            if (fieldType === 'PDFRadioGroup') {
                try {
                    const options = field.getOptions();
                    console.log(`     Optionen: [${options.join(', ')}]`);
                } catch (e) {
                    console.log(`     Optionen: Fehler beim Auslesen`);
                }
            }
        });
        console.log('=== ENDE FELDANALYSE ===\n');
        
        pdf.fields.forEach(fieldName => {
            let value = null;
            
            // Prüfe direkte Übereinstimmung
            if (formData[fieldName] && formData[fieldName].toString().trim() !== '') {
                value = formData[fieldName];
            } else {
                // Prüfe Mapping aus der PDF-spezifischen Konfiguration
                const fieldConf = pdfConfig.fields?.[fieldName] || {};
                if (fieldConf.mapping && formData[fieldConf.mapping] && formData[fieldConf.mapping].toString().trim() !== '') {
                    value = formData[fieldConf.mapping];
                }
            }
            
            if (value !== null && value !== undefined) {
                const fieldConf = pdfConfig.fields?.[fieldName] || {};
                console.log(`\n--- VERARBEITE FELD: ${fieldName} ---`);
                console.log(`Wert: "${value}"`);
                console.log(`PDF-Config für Feld:`, fieldConf);
                
                try {
                    const field = form.getField(fieldName);
                    if (field) {
                        const fieldType = field.constructor.name;
                        console.log(`Feld gefunden: ${fieldName} (${fieldType})`);
                        
                        // Unterscheide zwischen verschiedenen Feldtypen
                        if (field.constructor.name === 'PDFCheckBox') {
                            // Checkbox: erweiterte Behandlung
                            const shouldCheck = value === '1' || value === 'true' || value === true || 
                                              value === 'on' || value === 'Ja' || value === 'ja' || 
                                              value === 'YES' || value === 'yes' || value === 'checked';
                            
                            if (shouldCheck) {
                                try {
                                    field.check();
                                    console.log(`✓ Checkbox ${fieldName} aktiviert`);
                                } catch (checkError) {
                                    console.warn(`Standard check() fehlgeschlagen für ${fieldName}:`, checkError);
                                }
                                
                                // Zusätzliche direkte Wert-Setzung für problematische PDFs
                                try {
                                    const acroField = field.acroField;
                                    if (acroField && acroField.dict) {
                                        acroField.dict.set(PDFLib.PDFName.of('V'), PDFLib.PDFName.of('Yes'));
                                        acroField.dict.set(PDFLib.PDFName.of('AS'), PDFLib.PDFName.of('Yes'));
                                        console.log(`✓ Zusätzliche acroField-Werte für Checkbox ${fieldName} gesetzt`);
                                    }
                                } catch (acroError) {
                                    console.warn(`Acro-Fallback für Checkbox ${fieldName} fehlgeschlagen:`, acroError);
                                }
                            } else {
                                try {
                                    field.uncheck();
                                    console.log(`✓ Checkbox ${fieldName} deaktiviert`);
                                } catch (uncheckError) {
                                    console.warn(`Standard uncheck() fehlgeschlagen für ${fieldName}:`, uncheckError);
                                }
                                
                                // Zusätzliche direkte Wert-Setzung für problematische PDFs
                                try {
                                    const acroField = field.acroField;
                                    if (acroField && acroField.dict) {
                                        acroField.dict.set(PDFLib.PDFName.of('V'), PDFLib.PDFName.of('Off'));
                                        acroField.dict.set(PDFLib.PDFName.of('AS'), PDFLib.PDFName.of('Off'));
                                        console.log(`✓ Zusätzliche acroField-Werte für Checkbox ${fieldName} gesetzt (unchecked)`);
                                    }
                                } catch (acroError) {
                                    console.warn(`Acro-Fallback für Checkbox ${fieldName} fehlgeschlagen:`, acroError);
                                }
                            }
                        } else if (field.constructor.name === 'PDFRadioGroup') {
                            // Radio Group: verwende erweiterte Behandlung
                            try {
                                field.select(String(value));
                                console.log(`Radio Group ${fieldName} auf Wert '${value}' gesetzt`);
                            } catch (radioError) {
                                console.warn(`Radio Group ${fieldName} Wert '${value}' nicht gefunden:`, radioError);
                                // Erweiterte Behandlung über AcroField
                                try {
                                    const acroField = field.acroField;
                                    if (acroField) {
                                        acroField.V = PDFLib.PDFName.of(String(value));
                                        console.log(`Radio Group ${fieldName} acroField.V gesetzt`);
                                        
                                        if (acroField.dict) {
                                            acroField.dict.set(PDFLib.PDFName.of('V'), PDFLib.PDFName.of(String(value)));
                                            console.log(`Radio Group ${fieldName} dict.V gesetzt`);
                                        }
                                    }
                                } catch (acroError) {
                                    console.warn(`AcroField Fallback für ${fieldName} fehlgeschlagen:`, acroError);
                                }
                            }
                        } else {
                            // Textfeld: setze Text
                            field.setText(String(value));
                        }
                        
                        try {
                            const fieldDict = field.acroField.dict;
                            fieldDict.set(PDFLib.PDFName.of('DA'), PDFLib.PDFString.of('/Helv 12 Tf 0 g'));
                        } catch (daError) {
                            console.warn(`Default Appearance für ${fieldName} konnte nicht gesetzt werden:`, daError);
                        }
                        
                        filledFields++;
                    }
                } catch (error) {
                    // Generische Fallback-Behandlung für fehlende Felder
                    console.log(`Feld ${fieldName} mit Standard-Methode nicht gefunden, verwende Fallback-Logik...`);
                    
                    let fieldFound = false;
                    
                    // Durchsuche ALLE Felder im PDF und wende die Methoden an
                    const allFields = form.getFields();
                    allFields.forEach(testField => {
                        const testFieldName = testField.getName();
                        
                        // Prüfe ob dieser PDF-Feldname zu unserem gesuchten Feld passt
                        if (testFieldName === fieldName || 
                            testFieldName.toLowerCase() === fieldName.toLowerCase() ||
                            testFieldName.includes(fieldName) ||
                            fieldName.includes(testFieldName)) {
                            
                            console.log(`Mögliches Feld gefunden: "${testFieldName}" für gesuchtes Feld "${fieldName}"`);
                            
                            try {
                                // Checkbox-Behandlung
                                if (typeof testField.check === 'function' && typeof testField.uncheck === 'function') {
                                    if (value === 'Ja' || value === 'ja' || value === '1' || value === 'true' || value === true) {
                                        testField.check();
                                        console.log(`✓ Checkbox ${testFieldName} aktiviert (${value})`);
                                    } else {
                                        testField.uncheck();
                                        console.log(`✓ Checkbox ${testFieldName} deaktiviert (${value})`);
                                    }
                                    fieldFound = true;
                                }
                                
                                // AcroField direkt setzen
                                const acroField = testField.acroField;
                                if (acroField) {
                                    if (typeof testField.check === 'function') {
                                        // Checkbox
                                        const shouldCheck = value === 'Ja' || value === 'ja' || value === '1' || value === 'true' || value === true;
                                        acroField.dict.set(PDFLib.PDFName.of('V'), PDFLib.PDFName.of(shouldCheck ? 'Yes' : 'Off'));
                                        acroField.dict.set(PDFLib.PDFName.of('AS'), PDFLib.PDFName.of(shouldCheck ? 'Yes' : 'Off'));
                                        console.log(`✓ acroField für Checkbox ${testFieldName} gesetzt auf "${shouldCheck ? 'Yes' : 'Off'}"`);
                                    } else {
                                        // Anderes Feld
                                        acroField.V = PDFLib.PDFName.of(String(value));
                                        console.log(`✓ acroField.V für ${testFieldName} gesetzt auf "${value}"`);
                                        
                                        if (acroField.dict) {
                                            acroField.dict.set(PDFLib.PDFName.of('V'), PDFLib.PDFName.of(String(value)));
                                            console.log(`✓ dict.V für ${testFieldName} gesetzt auf "${value}"`);
                                        }
                                    }
                                    fieldFound = true;
                                }
                                
                                // setText falls vorhanden
                                if (typeof testField.setText === 'function') {
                                    testField.setText(String(value));
                                    console.log(`✓ setText() für ${testFieldName} ausgeführt mit "${value}"`);
                                    fieldFound = true;
                                }
                                
                            } catch (e) {
                                console.warn(`❌ Fehler bei Fallback-Methode für ${testFieldName}:`, e.message);
                            }
                        }
                    });
                    
                    if (fieldFound) {
                        console.log(`✓ Feld ${fieldName} erfolgreich über Fallback-Logik gesetzt`);
                        filledFields++;
                    } else {
                        console.warn(`❌ Feld ${fieldName} konnte auch mit Fallback-Logik nicht gesetzt werden`);
                    }
                }
            }
        });
        
        try {
            form.updateFieldAppearances(helveticaFont);
        } catch (error) {
            console.warn('Fehler beim Aktualisieren der Appearances:', error);
            try {
                form.flatten();
            } catch (flattenError) {
                console.warn('Fehler beim Flatten:', flattenError);
            }
        }
        
        try {
            const acroForm = pdfDoc.catalog.getOrCreateAcroForm();
            acroForm.dict.set(PDFLib.PDFName.of('NeedAppearances'), PDFLib.PDFBool.False);
        } catch (error) {
            console.warn('Fehler beim Setzen von NeedAppearances:', error);
        }
        
        const finalPdfBytes = await pdfDoc.save({
            useObjectStreams: false
        });
        
        const blob = new Blob([finalPdfBytes], { type: 'application/pdf' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        
        const customFileName = generateFileName(pdf.name, data);
        link.download = customFileName;
        link.click();
        
        URL.revokeObjectURL(link.href);
        
        console.log(`${filledFields} Felder erfolgreich ausgefüllt in ${pdf.name}`);
        
    } catch (error) {
        console.error('Fehler beim Ausfüllen des PDFs:', error);
        throw error;
    }
}

function generateFileName(pdfName, data) {
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];
    
    let fileName = window.appSettings.fileNamePattern;
    
    fileName = fileName.replace(/\[PDF\]/g, pdfName.replace('.pdf', ''));
    fileName = fileName.replace(/\[Datum\]/g, dateStr);
    
    Object.keys(data).forEach(fieldName => {
        const regex = new RegExp(`\\[${fieldName}\\]`, 'g');
        fileName = fileName.replace(regex, data[fieldName] || '');
    });
    
    fileName = fileName.replace(/[^a-zA-Z0-9äöüÄÖÜß\s,.-]/g, '_');
    fileName = fileName.replace(/\s+/g, ' ').trim();
    
    return fileName + '.pdf';
}