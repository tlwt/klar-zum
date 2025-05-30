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
                try {
                    const field = form.getField(fieldName);
                    if (field) {
                        // Unterscheide zwischen verschiedenen Feldtypen
                        if (field.constructor.name === 'PDFCheckBox') {
                            // Checkbox: setze check/uncheck basierend auf Wert
                            if (value === '1' || value === 'true' || value === true || value === 'on') {
                                field.check();
                            } else {
                                field.uncheck();
                            }
                        } else if (field.constructor.name === 'PDFRadioGroup') {
                            // Radio Group: verwende erweiterte Behandlung basierend auf Testskript
                            try {
                                field.select(String(value));
                                console.log(`Radio Group ${fieldName} auf Wert '${value}' gesetzt`);
                            } catch (radioError) {
                                console.warn(`Radio Group ${fieldName} Wert '${value}' nicht gefunden:`, radioError);
                                // Erweiterte Behandlung über AcroField wie im Testskript
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
                    // Erweiterte Fallback-Behandlung basierend auf Testskript
                    try {
                        // Methode 1: Versuche als Radio Group
                        const radioGroup = form.getRadioGroup(fieldName);
                        if (radioGroup) {
                            radioGroup.select(String(value));
                            console.log(`Radio Group ${fieldName} (via getRadioGroup) auf Wert '${value}' gesetzt`);
                            filledFields++;
                        } else {
                            // Methode 2: Suche nach Feldnamen-Varianten (für Radio Groups ohne direkte Zuordnung)
                            let fieldFound = false;
                            
                            // Teste verschiedene mögliche Feldnamen
                            const variations = [
                                fieldName,
                                fieldName.toLowerCase(),
                                fieldName.toUpperCase(),
                                value, // Der Wert selbst könnte der Feldname sein (z.B. "Ja", "Nein")
                                value.toLowerCase(),
                                value.toUpperCase()
                            ];
                            
                            for (const variation of variations) {
                                try {
                                    const varField = form.getField(variation);
                                    if (varField) {
                                        console.log(`Feld-Variation gefunden: ${variation} für ${fieldName}`);
                                        
                                        // Checkbox-Behandlung für Radio-ähnliche Felder
                                        if (varField.constructor.name === 'PDFCheckBox') {
                                            if (variation === value || 
                                                (value === 'Ja' && (variation === 'Ja' || variation === 'ja')) ||
                                                (value === 'Nein' && (variation === 'Nein' || variation === 'nein'))) {
                                                varField.check();
                                                console.log(`Checkbox ${variation} aktiviert für Wert ${value}`);
                                            } else {
                                                varField.uncheck();
                                                console.log(`Checkbox ${variation} deaktiviert für Wert ${value}`);
                                            }
                                            fieldFound = true;
                                            filledFields++;
                                            break;
                                        }
                                        
                                        // AcroField direkt setzen wie im Testskript
                                        const acroField = varField.acroField;
                                        if (acroField) {
                                            acroField.V = PDFLib.PDFName.of(String(value));
                                            console.log(`AcroField.V für ${variation} gesetzt`);
                                            
                                            if (acroField.dict) {
                                                acroField.dict.set(PDFLib.PDFName.of('V'), PDFLib.PDFName.of(String(value)));
                                                console.log(`AcroField.dict.V für ${variation} gesetzt`);
                                            }
                                        }
                                        
                                        // Zusätzliche Checkbox-Methoden falls verfügbar
                                        if (typeof varField.check === 'function') {
                                            if (value === 'Ja' || value === 'ja' || value === '1' || value === 'true') {
                                                varField.check();
                                                console.log(`${variation} aktiviert`);
                                            } else {
                                                varField.uncheck();
                                                console.log(`${variation} deaktiviert`);
                                            }
                                        }
                                        
                                        fieldFound = true;
                                        filledFields++;
                                        break;
                                    }
                                } catch (varError) {
                                    // Variation nicht gefunden, weiter versuchen
                                    continue;
                                }
                            }
                            
                            if (!fieldFound) {
                                console.warn(`Feld ${fieldName} konnte nicht ausgefüllt werden:`, error);
                            }
                        }
                    } catch (radioError) {
                        console.warn(`Alle Fallback-Methoden für ${fieldName} fehlgeschlagen:`, error);
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