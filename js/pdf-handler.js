// js/pdf-handler.js
// PDF-Verarbeitung und -Verwaltung

async function loadPDFConfigForFile(pdfName) {
    try {
        const configName = pdfName.replace('.pdf', '.yaml');
        const response = await fetch(`./formulare/${encodeURIComponent(configName)}`);
        if (response.ok) {
            const yamlText = await response.text();
            const config = jsyaml.load(yamlText);
            window.pdfConfigs.set(pdfName, config);
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
    const dirResponse = await fetch('./formulare/');
    if (!dirResponse.ok) {
        throw new Error('Verzeichnis ./formulare/ nicht erreichbar');
    }
    
    const dirHTML = await dirResponse.text();
    const pdfNames = extractPDFNamesFromListing(dirHTML);
    
    if (pdfNames.length === 0) {
        throw new Error('Keine PDF-Dateien gefunden');
    }
    
    for (const pdfName of pdfNames) {
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
                    hasConfig: hasConfig
                });
                
                window.pdfFields.set(pdfName, fields);
            }
        } catch (error) {
            console.warn(`Fehler beim Laden von ${pdfName}:`, error);
        }
    }
    
    if (window.availablePDFs.length === 0) {
        throw new Error('Keine PDF-Formulare konnten geladen werden');
    }
}

function extractPDFNamesFromListing(html) {
    const pdfNames = [];
    const linkRegex = /<a href="([^"]+\.pdf)"/gi;
    let match;
    
    while ((match = linkRegex.exec(html)) !== null) {
        pdfNames.push(decodeURIComponent(match[1]));
    }
    
    return pdfNames;
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
            
            if (value) {
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
                            // Checkbox: setze check/uncheck basierend auf Wert
                            if (value === '1' || value === 'true' || value === true || value === 'on' || value === 'Ja') {
                                field.check();
                                console.log(`✓ Checkbox ${fieldName} aktiviert`);
                            } else {
                                field.uncheck();
                                console.log(`✓ Checkbox ${fieldName} deaktiviert`);
                            }
                        } else if (field.constructor.name === 'PDFRadioGroup') {
                            // Radio Group: verwende erweiterte Behandlung basierend auf test3.html
                            try {
                                field.select(String(value));
                                console.log(`Radio Group ${fieldName} auf Wert '${value}' gesetzt`);
                            } catch (radioError) {
                                console.warn(`Radio Group ${fieldName} Wert '${value}' nicht gefunden:`, radioError);
                                // Erweiterte Behandlung über AcroField wie in test3.html
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
                    // Generische Fallback-Behandlung basierend auf test3.html
                    console.log(`Feld ${fieldName} mit Standard-Methode nicht gefunden, verwende test3.html Logik...`);
                    
                    let fieldFound = false;
                    
                    // test3.html Logik: Durchsuche ALLE Felder im PDF und wende die Methoden an
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
                                // test3.html Methode 1: Checkbox-Behandlung
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
                                
                                // test3.html Methode 2: AcroField direkt setzen
                                const acroField = testField.acroField;
                                if (acroField) {
                                    acroField.V = PDFLib.PDFName.of(String(value));
                                    console.log(`✓ acroField.V für ${testFieldName} gesetzt auf "${value}"`);
                                    
                                    if (acroField.dict) {
                                        acroField.dict.set(PDFLib.PDFName.of('V'), PDFLib.PDFName.of(String(value)));
                                        console.log(`✓ dict.V für ${testFieldName} gesetzt auf "${value}"`);
                                    }
                                    fieldFound = true;
                                }
                                
                                // test3.html Methode 3: setText falls vorhanden
                                if (typeof testField.setText === 'function') {
                                    testField.setText(String(value));
                                    console.log(`✓ setText() für ${testFieldName} ausgeführt mit "${value}"`);
                                    fieldFound = true;
                                }
                                
                            } catch (e) {
                                console.warn(`❌ Fehler bei test3.html Methode für ${testFieldName}:`, e.message);
                            }
                        }
                    });
                    
                    if (fieldFound) {
                        console.log(`✓ Feld ${fieldName} erfolgreich über test3.html Logik gesetzt`);
                        filledFields++;
                    } else {
                        console.warn(`❌ Feld ${fieldName} konnte auch mit test3.html Logik nicht gesetzt werden`);
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