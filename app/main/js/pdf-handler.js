// js/pdf-handler.js
// Erweiterte PDF-Verarbeitung mit präziser Unterschrift-Positionierung

// Erweiterte Funktion zum Einbetten von Unterschriften mit konfigurierbarer Position
async function embedSignatureInPDF(pdfDoc, fieldName, base64Data, currentPdfName) {
    try {
        // console.log(`Versuche Unterschrift für Feld ${fieldName} in PDF ${currentPdfName} einzubetten...`);
        
        // Base64-Daten zu Bytes konvertieren
        const base64String = base64Data.split(',')[1];
        const imageBytes = Uint8Array.from(atob(base64String), c => c.charCodeAt(0));
        
        // Bild in PDF einbetten
        let embeddedImage;
        if (base64Data.includes('data:image/png')) {
            embeddedImage = await pdfDoc.embedPng(imageBytes);
        } else if (base64Data.includes('data:image/jpeg') || base64Data.includes('data:image/jpg')) {
            embeddedImage = await pdfDoc.embedJpg(imageBytes);
        } else {
            console.warn(`Unbekanntes Bildformat für Unterschrift ${fieldName}`);
            return false;
        }
        
        // Suche nach Konfiguration für dieses Feld im aktuellen PDF
        const signatureConfig = getSignatureConfig(fieldName, currentPdfName);
        // console.log(`Unterschrift-Konfiguration für ${fieldName}:`, signatureConfig);
        
        const pages = pdfDoc.getPages();
        
        // Bestimme Zielseite
        let targetPage;
        if (signatureConfig.page && signatureConfig.page <= pages.length) {
            targetPage = pages[signatureConfig.page - 1]; // 1-basiert zu 0-basiert
        } else {
            targetPage = pages[pages.length - 1]; // Fallback: letzte Seite
        }
        
        const { width: pageWidth, height: pageHeight } = targetPage.getSize();
        
        // Bestimme maximale Größe aus Konfiguration
        const maxSignatureWidth = signatureConfig.width || 200;
        const maxSignatureHeight = signatureConfig.height || 100;
        
        // Berechne das ursprüngliche Seitenverhältnis der Unterschrift
        const imageWidth = embeddedImage.width;
        const imageHeight = embeddedImage.height;
        const aspectRatio = imageWidth / imageHeight;
        
        // Berechne die tatsächliche Größe unter Beibehaltung des Seitenverhältnisses
        let signatureWidth, signatureHeight;
        
        if (maxSignatureWidth / aspectRatio <= maxSignatureHeight) {
            // Breite ist der limitierende Faktor
            signatureWidth = maxSignatureWidth;
            signatureHeight = maxSignatureWidth / aspectRatio;
        } else {
            // Höhe ist der limitierende Faktor
            signatureHeight = maxSignatureHeight;
            signatureWidth = maxSignatureHeight * aspectRatio;
        }
        
        // console.log(`🔍 Unterschrift-Größenberechnung für ${fieldName}:`);
        // console.log(`  Original Bildgröße: ${imageWidth} x ${imageHeight} (Verhältnis: ${aspectRatio.toFixed(2)})`);
        // console.log(`  Max konfiguriert: ${maxSignatureWidth} x ${maxSignatureHeight}`);
        // console.log(`  Finale Größe: ${signatureWidth.toFixed(1)} x ${signatureHeight.toFixed(1)}`);
        
        let x, y;
        
        if (signatureConfig.x !== undefined && signatureConfig.y !== undefined) {
            // Verwende explizit konfigurierte Koordinaten
            x = signatureConfig.x;
            y = signatureConfig.y;
            
            // Debug: Zeige alle wichtigen Infos
            // console.log(`🔍 PDF-Koordinaten Debug für ${fieldName}:`);
            // console.log(`  Seitengröße: ${pageWidth} x ${pageHeight} Punkte`);
            // console.log(`  Konfiguriert: X=${x}, Y=${y}`);
            // console.log(`  PDF-Koordinatensystem: Ursprung unten links, Y-Achse nach oben`);
        } else {
            // Intelligente Standardpositionierung basierend auf Feldname
            const position = getIntelligentSignaturePosition(fieldName, pageWidth, pageHeight, signatureWidth, signatureHeight);
            x = position.x;
            y = position.y;
            // console.log(`Verwende intelligente Position für ${fieldName}: X=${x}, Y=${y}`);
        }
        
        // Validiere Koordinaten (stelle sicher, dass Unterschrift auf der Seite bleibt)
        x = Math.max(0, Math.min(x, pageWidth - signatureWidth));
        y = Math.max(0, Math.min(y, pageHeight - signatureHeight));
        
        // Bild auf der Seite platzieren mit korrektem Seitenverhältnis
        targetPage.drawImage(embeddedImage, {
            x: x,
            y: y,
            width: signatureWidth,
            height: signatureHeight
        });
        
        const pageNumber = pages.indexOf(targetPage) + 1;
        // console.log(`✓ Unterschrift ${fieldName} erfolgreich platziert auf Seite ${pageNumber} bei X=${x}, Y=${y}`);
        
        return true;
        
    } catch (error) {
        console.error(`Fehler beim Einbetten der Unterschrift ${fieldName}:`, error);
        return false;
    }
}

// Neue Funktion: Hole Unterschrift-Konfiguration für ein Feld eines spezifischen PDFs
function getSignatureConfig(fieldName, currentPdfName) {
    // console.log(`🔍 Suche Unterschrift-Konfiguration für ${fieldName} in PDF ${currentPdfName}`);
    
    // Suche nur in der Konfiguration des aktuellen PDFs
    const config = window.pdfConfigs.get(currentPdfName);
    if (config && config.fields) {
        // Direkte Suche nach dem Feldnamen
        const fieldConfig = config.fields[fieldName];
        if (fieldConfig && fieldConfig.type === 'signature') {
            // console.log(`✅ Gefunden: Direkte Konfiguration für ${fieldName} in ${currentPdfName}`, fieldConfig);
            return {
                width: fieldConfig.signature_width || 200,
                height: fieldConfig.signature_height || 100,
                x: fieldConfig.signature_x,
                y: fieldConfig.signature_y,
                page: fieldConfig.signature_page || 1
            };
        }
        
        // Suche auch nach gemappten Feldern in diesem PDF
        for (const [originalField, originalConfig] of Object.entries(config.fields)) {
            if (originalConfig.mapping === fieldName && originalConfig.type === 'signature') {
                // console.log(`✅ Gefunden: Gemappte Konfiguration für ${fieldName} -> ${originalField} in ${currentPdfName}`, originalConfig);
                return {
                    width: originalConfig.signature_width || 200,
                    height: originalConfig.signature_height || 100,
                    x: originalConfig.signature_x,
                    y: originalConfig.signature_y,
                    page: originalConfig.signature_page || 1
                };
            }
        }
    }
    
    // console.log(`⚠️ Keine Unterschrift-Konfiguration für ${fieldName} in ${currentPdfName} gefunden, verwende Standard`);
    
    // Fallback: Standard-Konfiguration
    return {
        width: 200,
        height: 100,
        x: undefined, // Wird durch intelligente Positionierung bestimmt
        y: undefined,
        page: 1
    };
}

// Hilfsfunktion: Koordinaten-Umrechnung von Browser zu PDF
function convertBrowserToPdfCoordinates(browserX, browserY, pageWidth, pageHeight) {
    // Browser: Ursprung oben links, Y nach unten
    // PDF: Ursprung unten links, Y nach oben
    return {
        x: browserX,
        y: pageHeight - browserY  // Y-Achse umkehren
    };
}

// Hilfsfunktion: Pixel zu Punkte umrechnen (falls nötig)
function pixelsToPoints(pixels) {
    // 1 Punkt = 1/72 Zoll, typischerweise ~0.75 Pixel bei 96 DPI
    return pixels * 0.75;
}

// Neue Funktion: Intelligente Positionierung von Unterschriften
function getIntelligentSignaturePosition(fieldName, pageWidth, pageHeight, signatureWidth, signatureHeight) {
    const fieldNameLower = fieldName.toLowerCase();
    
    // Standardabstände vom Rand
    const marginLeft = 50;
    const marginRight = 50;
    const marginBottom = 80;
    const marginTop = 80;
    
    // Basierend auf Feldname intelligente Position bestimmen
    if (fieldNameLower.includes('datum') && fieldNameLower.includes('ort')) {
        // "Datum, Ort" meist links unten
        return {
            x: marginLeft,
            y: marginBottom
        };
    } else if (fieldNameLower.includes('unterschrift') || fieldNameLower.includes('signature')) {
        // Unterschriften meist rechts unten
        return {
            x: pageWidth - signatureWidth - marginRight,
            y: marginBottom
        };
    } else if (fieldNameLower.includes('signature1') || fieldNameLower.includes('sig1')) {
        // Erste Unterschrift links
        return {
            x: marginLeft,
            y: marginBottom + 60 // Etwas höher als Datum/Ort
        };
    } else if (fieldNameLower.includes('signature2') || fieldNameLower.includes('sig2')) {
        // Zweite Unterschrift rechts
        return {
            x: pageWidth - signatureWidth - marginRight,
            y: marginBottom + 60
        };
    } else {
        // Standard: unten rechts
        return {
            x: pageWidth - signatureWidth - marginRight,
            y: marginBottom
        };
    }
}

// Erweiterte setFieldValue Funktion mit verbesserter Unterschrift-Behandlung
async function setFieldValue(field, value, fieldName, pdfDoc, currentPdfName) {
    try {
        // console.log(`Setze Feld ${fieldName} (${field.constructor.name}) auf Wert: "${value}" in PDF ${currentPdfName}`);
        
        // Spezielle Behandlung für Unterschrift (Base64-Bilder)
        if (fieldName.toLowerCase().includes('unterschrift') || fieldName.toLowerCase().includes('signature')) {
            if (value && value.startsWith('data:image/')) {
                return await embedSignatureInPDF(pdfDoc, fieldName, value, currentPdfName);
            } else {
                // console.log(`Unterschrift-Feld ${fieldName} hat keine gültigen Bilddaten`);
                return false;
            }
        }
        
        // WICHTIG: Versuche zuerst form.getTextField() auch wenn instanceof fehlschlägt
        try {
            const textField = pdfDoc.getForm().getTextField(fieldName);
            textField.setText(String(value));
            // Update Appearances für bessere Kompatibilität
            try {
                textField.updateAppearances();
            } catch (e) {
                // console.log(`Konnte Appearances für ${fieldName} nicht updaten:`, e.message);
            }
            // console.log(`✓ TextField ${fieldName} über form.getTextField() gesetzt`);
            return true;
        } catch (getTextFieldError) {
            // Fallback auf instanceof check
            if (field instanceof PDFLib.PDFTextField) {
                field.setText(String(value));
                // Update Appearances für bessere Kompatibilität
                try {
                    field.updateAppearances();
                } catch (e) {
                    // console.log(`Konnte Appearances für ${fieldName} nicht updaten:`, e.message);
                }
                // console.log(`✓ TextField ${fieldName} über instanceof gesetzt`);
                return true;
            }
        }
        
        // Versuche CheckBox über form.getCheckBox()
        try {
            const checkBox = pdfDoc.getForm().getCheckBox(fieldName);
            const shouldCheck = value === '1' || value === 'true' || value === true || 
                               value === 'on' || value === 'Ja' || value === 'ja' || 
                               value === 'YES' || value === 'yes' || value === 'checked';
            
            if (shouldCheck) {
                checkBox.check();
                // console.log(`✓ CheckBox ${fieldName} über form.getCheckBox() aktiviert`);
            } else {
                checkBox.uncheck();
                // console.log(`✓ CheckBox ${fieldName} über form.getCheckBox() deaktiviert`);
            }
            return true;
        } catch (getCheckBoxError) {
            // Fallback auf instanceof check
            if (field instanceof PDFLib.PDFCheckBox) {
                const shouldCheck = value === '1' || value === 'true' || value === true || 
                                   value === 'on' || value === 'Ja' || value === 'ja' || 
                                   value === 'YES' || value === 'yes' || value === 'checked';
                
                if (shouldCheck) {
                    field.check();
                    // console.log(`✓ CheckBox ${fieldName} über instanceof aktiviert`);
                } else {
                    field.uncheck();
                    // console.log(`✓ CheckBox ${fieldName} über instanceof deaktiviert`);
                }
                return true;
            }
        }
        
        // Versuche RadioGroup über form.getRadioGroup()
        try {
            const radioGroup = pdfDoc.getForm().getRadioGroup(fieldName);
            const options = radioGroup.getOptions();
            const valueStr = String(value);
            
            // Versuche zuerst exakte Übereinstimmung
            if (options.includes(valueStr)) {
                radioGroup.select(valueStr);
                // console.log(`✓ RadioGroup ${fieldName} über form.getRadioGroup() auf "${valueStr}" gesetzt`);
                return true;
            }
            
            // Versuche fallback auf ersten Wert wenn verfügbar
            if (options.length > 0) {
                radioGroup.select(options[0]);
                // console.log(`✓ RadioGroup ${fieldName} über form.getRadioGroup() auf ersten Wert "${options[0]}" gesetzt (Fallback)`);
                return true;
            }
            
            console.warn(`RadioGroup ${fieldName}: Keine passenden Optionen gefunden`);
            return false;
        } catch (getRadioGroupError) {
            // Fallback auf instanceof check
            if (field instanceof PDFLib.PDFRadioGroup) {
                const options = field.getOptions();
                const valueStr = String(value);
                
                // Versuche zuerst exakte Übereinstimmung
                if (options.includes(valueStr)) {
                    field.select(valueStr);
                    // console.log(`✓ RadioGroup ${fieldName} über instanceof auf "${valueStr}" gesetzt`);
                    return true;
                }
                
                // Versuche fallback auf ersten Wert wenn verfügbar
                if (options.length > 0) {
                    field.select(options[0]);
                    // console.log(`✓ RadioGroup ${fieldName} über instanceof auf ersten Wert "${options[0]}" gesetzt (Fallback)`);
                    return true;
                }
                
                console.warn(`RadioGroup ${fieldName}: Keine passenden Optionen gefunden`);
                return false;
            }
        }
        
        // Versuche Dropdown über form.getDropdown()
        try {
            const dropdown = pdfDoc.getForm().getDropdown(fieldName);
            const options = dropdown.getOptions();
            const valueStr = String(value);
            
            // Versuche zuerst exakte Übereinstimmung
            if (options.includes(valueStr)) {
                dropdown.select(valueStr);
                // console.log(`✓ Dropdown ${fieldName} über form.getDropdown() auf "${valueStr}" gesetzt`);
                return true;
            }
            
            // Spezielle Logik für Übung/Uebung
            const target = options.find(v => /übung|uebung/i.test(v)) || options[0];
            if (target) {
                dropdown.select(target);
                // console.log(`✓ Dropdown ${fieldName} über form.getDropdown() auf "${target}" gesetzt (Fallback)`);
                return true;
            }
            
            console.warn(`Dropdown ${fieldName}: Keine passenden Optionen gefunden`);
            return false;
        } catch (getDropdownError) {
            // Fallback auf instanceof check
            if (field instanceof PDFLib.PDFDropdown) {
                const options = field.getOptions();
                const valueStr = String(value);
                
                // Versuche zuerst exakte Übereinstimmung
                if (options.includes(valueStr)) {
                    field.select(valueStr);
                    // console.log(`✓ Dropdown ${fieldName} über instanceof auf "${valueStr}" gesetzt`);
                    return true;
                }
                
                // Spezielle Logik für Übung/Uebung
                const target = options.find(v => /übung|uebung/i.test(v)) || options[0];
                if (target) {
                    field.select(target);
                    // console.log(`✓ Dropdown ${fieldName} über instanceof auf "${target}" gesetzt (Fallback)`);
                    return true;
                }
                
                console.warn(`Dropdown ${fieldName}: Keine passenden Optionen gefunden`);
                return false;
            }
        }
        
        // Fallback für andere Feldtypen
        if (field instanceof PDFLib.PDFOptionList) {
            const options = field.getOptions();
            if (options.length > 0) {
                field.select(options[0]);
                // console.log(`✓ OptionList ${fieldName} auf ersten Wert gesetzt`);
                return true;
            }
            return false;
        }
        
        // Letzter Fallback: Versuche setText wenn verfügbar
        console.warn(`Unbekannter Feldtyp für ${fieldName}: ${field.constructor.name}`);
        if (typeof field.setText === 'function') {
            field.setText(String(value));
            // console.log(`✓ Unbekannter Typ ${fieldName} mit setText gesetzt`);
            return true;
        }
        
        return false;
    } catch (error) {
        console.warn(`Fehler beim Setzen von Feld ${fieldName}:`, error);
        return false;
    }
}

// Erweiterte fillAndDownloadPDF Funktion mit verbesserter Unterschrift-Behandlung
async function fillAndDownloadPDF(pdf, data, flatten = true) {
    try {
        // Lade Original-PDF direkt vom Server statt gespeichertes Dokument zu verwenden
        const response = await fetch(pdf.path);
        if (!response.ok) {
            throw new Error(`Konnte PDF nicht laden: ${pdf.path}`);
        }
        const pdfBytes = await response.arrayBuffer();
        const pdfDoc = await PDFLib.PDFDocument.load(pdfBytes, { ignoreEncryption: true });
        const form = pdfDoc.getForm();
        
        // WICHTIG: Setze NeedAppearances Flag für PDFs die es benötigen
        try {
            const acroForm = pdfDoc.catalog.lookup(PDFLib.PDFName.of('AcroForm'));
            if (acroForm) {
                acroForm.set(PDFLib.PDFName.of('NeedAppearances'), PDFLib.PDFBool.True);
                // console.log('✓ NeedAppearances Flag gesetzt');
            }
        } catch (e) {
            console.log('Konnte NeedAppearances Flag nicht setzen:', e.message);
        }
        
        let filledFields = 0;
        const formData = getAllFormData();
        const pdfConfig = window.pdfConfigs.get(pdf.name) || {};
        
        // console.log('\n=== PDF FELDANALYSE ===');
        // console.log(`PDF: ${pdf.name}`);
        const allFields = form.getFields();
        // console.log(`Gefundene Felder im PDF (${allFields.length}):`);
        
        // DEBUG: Zeige alle verfügbaren Daten
        // console.log('Verfügbare formData Keys:', Object.keys(formData).filter(k => formData[k]));
        // console.log('Beispiel - Nachname:', formData['Nachname']);
        
        // Hauptlogik: Iteriere über alle PDF-Felder und versuche sie zu setzen
        for (const fieldName of pdf.fields) {
            let value = null;
            
            // DEBUG für Nachname
            // if (fieldName === 'Nachname') {
            //     console.log('DEBUG Nachname - formData[Nachname]:', formData['Nachname']);
            //     console.log('DEBUG Nachname - fieldName:', fieldName);
            //     console.log('DEBUG Nachname - pdfConfig.fields:', pdfConfig.fields);
            // }
            
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
                // console.log(`\n--- VERARBEITE FELD: ${fieldName} ---`);
                // console.log(`Wert: "${value}"`);
                
                try {
                    const field = form.getField(fieldName);
                    if (field) {
                        const success = await setFieldValue(field, value, fieldName, pdfDoc, pdf.name);
                        if (success) {
                            filledFields++;
                        }
                    } else {
                        console.warn(`Feld ${fieldName} nicht im PDF gefunden`);
                        
                        // Spezielle Behandlung für Unterschrift-Felder ohne Formularfeld
                        if (fieldName.toLowerCase().includes('unterschrift') || fieldName.toLowerCase().includes('signature')) {
                            if (value && value.startsWith('data:image/')) {
                                const success = await embedSignatureInPDF(pdfDoc, fieldName, value, pdf.name);
                                if (success) {
                                    filledFields++;
                                    // console.log(`✓ Unterschrift ${fieldName} als Bild eingefügt`);
                                }
                            }
                        }
                    }
                } catch (error) {
                    console.warn(`Fehler beim Zugriff auf Feld ${fieldName}:`, error);
                    
                    // Spezielle Behandlung für Unterschrift-Felder bei Fehlern
                    if (fieldName.toLowerCase().includes('unterschrift') || fieldName.toLowerCase().includes('signature')) {
                        if (value && value.startsWith('data:image/')) {
                            try {
                                const success = await embedSignatureInPDF(pdfDoc, fieldName, value, pdf.name);
                                if (success) {
                                    filledFields++;
                                    // console.log(`✓ Unterschrift ${fieldName} als Bild eingefügt (Fallback)`);
                                }
                            } catch (signatureError) {
                                console.warn(`Fehler beim Einbetten der Unterschrift ${fieldName}:`, signatureError);
                            }
                        }
                    }
                }
            }
        }
        
        // Versuche auch direkte Feldsuche für bessere Abdeckung
        for (const field of allFields) {
            const fieldName = field.getName();
            if (formData[fieldName] && formData[fieldName].toString().trim() !== '') {
                const value = formData[fieldName];
                // console.log(`\n--- DIREKTE FELDSUCHE: ${fieldName} ---`);
                
                // Überspringe wenn bereits verarbeitet
                if (!pdf.fields.includes(fieldName)) {
                    const success = await setFieldValue(field, value, fieldName, pdfDoc, pdf.name);
                    if (success) {
                        filledFields++;
                    }
                }
            }
        }
        
        // Behandle Unterschrift-Felder die nicht als PDF-Formularfelder existieren
        // console.log('\n=== ERWEITERTE UNTERSCHRIFT-BEHANDLUNG ===');
        for (const [fieldName, fieldValue] of Object.entries(formData)) {
            if ((fieldName.toLowerCase().includes('unterschrift') || fieldName.toLowerCase().includes('signature')) && 
                fieldValue && fieldValue.startsWith('data:image/')) {
                
                // console.log(`Verarbeite Unterschrift-Feld: ${fieldName}`);
                
                // Prüfe ob diese Unterschrift für dieses PDF konfiguriert ist
                const signatureConfig = getSignatureConfig(fieldName, pdf.name);
                if (signatureConfig.x === undefined && signatureConfig.y === undefined) {
                    // console.log(`⏭️ Unterschrift ${fieldName} ist nicht für ${pdf.name} konfiguriert - überspringe`);
                    continue;
                }
                
                // Prüfe ob bereits als Formularfeld verarbeitet
                let alreadyProcessed = false;
                try {
                    const field = form.getField(fieldName);
                    if (field) {
                        alreadyProcessed = true;
                        // console.log(`Unterschrift ${fieldName} bereits als Formularfeld verarbeitet`);
                    }
                } catch (e) {
                    // Feld existiert nicht als Formularfeld - das ist ok
                }
                
                if (!alreadyProcessed) {
                    try {
                        const success = await embedSignatureInPDF(pdfDoc, fieldName, fieldValue, pdf.name);
                        if (success) {
                            filledFields++;
                            // console.log(`✓ Unterschrift ${fieldName} als separates Bild eingefügt`);
                        }
                    } catch (signatureError) {
                        console.warn(`Fehler beim Einbetten der separaten Unterschrift ${fieldName}:`, signatureError);
                    }
                }
            }
        }
        
        // GENERISCHER FALLBACK (für unerkannte Felder)
        // console.log('\n=== GENERISCHER FALLBACK ===');
        allFields.forEach(field => {
            const fieldName = field.getName();
            
            // Überspringe bereits verarbeitete Felder
            if (pdf.fields.includes(fieldName)) return;
            if (formData[fieldName] && formData[fieldName].toString().trim() !== '') return;
            
            try {
                if (field instanceof PDFLib.PDFTextField) {
                    field.setText('Beispiel');
                    // console.log(`✓ Fallback TextField ${fieldName} auf "Beispiel" gesetzt`);
                } else if (field instanceof PDFLib.PDFCheckBox) {
                    field.check();
                    // console.log(`✓ Fallback CheckBox ${fieldName} aktiviert`);
                } else if (field instanceof PDFLib.PDFRadioGroup) {
                    const options = field.getOptions();
                    if (options.length > 0) {
                        field.select(options[0]);
                        // console.log(`✓ Fallback RadioGroup ${fieldName} auf ersten Wert gesetzt`);
                    }
                } else if (field instanceof PDFLib.PDFDropdown) {
                    const options = field.getOptions();
                    const target = options.find(v => /übung|uebung/i.test(v)) || options[0];
                    if (target) {
                        field.select(target);
                        // console.log(`✓ Fallback Dropdown ${fieldName} auf "${target}" gesetzt`);
                    }
                } else if (field instanceof PDFLib.PDFOptionList) {
                    const options = field.getOptions();
                    if (options.length > 0) {
                        field.select(options[0]);
                        // console.log(`✓ Fallback OptionList ${fieldName} auf ersten Wert gesetzt`);
                    }
                }
            } catch (fallbackError) {
                // Stille Ignorierung von Fallback-Fehlern
            }
        });
        
        // Form-Updates
        try {
            const helveticaFont = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);
            form.updateFieldAppearances(helveticaFont);
        } catch (error) {
            console.warn('Fehler beim Aktualisieren der Appearances:', error);
        }
        
        // WICHTIG: Update alle Form Field Appearances VOR dem Speichern
        try {
            const allFields = form.getFields();
            for (const field of allFields) {
                if (field.constructor.name === 'PDFTextField' || 
                    field.constructor.name === 'PDFCheckBox' || 
                    field.constructor.name === 'PDFRadioGroup' || 
                    field.constructor.name === 'PDFDropdown') {
                    try {
                        field.updateAppearances();
                    } catch (e) {
                        // Ignoriere Fehler beim Appearance Update
                    }
                }
            }
            // console.log('✓ Alle Field Appearances VOR dem Speichern aktualisiert');
        } catch (e) {
            console.log('Fehler beim globalen Appearance Update:', e.message);
        }
        
        // Flatten PDF if requested
        if (flatten) {
            try {
                form.flatten();
                // console.log('✓ PDF-Formular wurde geflacht (flatten)');
            } catch (error) {
                console.warn('Fehler beim Flatten des PDFs:', error);
                console.log('📝 Speichere PDF ohne Flatten wegen Kompatibilitätsproblemen');
                // Setze flatten auf false für dieses PDF
                flatten = false;
            }
        }
        
        const finalPdfBytes = await pdfDoc.save({
            useObjectStreams: false,
            addDefaultFont: false
        });
        
        // Verwende FileSaver.js
        const customFileName = generateFileName(pdf.name, data, flatten);
        const blob = new Blob([finalPdfBytes], { type: 'application/pdf' });
        
        // console.log(`📥 Starte Download für ${pdf.name} (${customFileName})`);
        // console.log(`📦 Blob-Größe: ${blob.size} bytes`);
        
        // Direkter Download ohne Verzögerung für parallele Downloads
        try {
            saveAs(blob, customFileName);
            // console.log(`✅ Download gestartet für ${customFileName}`);
        } catch (downloadError) {
            console.error(`❌ Download-Fehler für ${customFileName}:`, downloadError);
            throw downloadError;
        }
        
        const modeText = flatten ? 'geflacht (nicht bearbeitbar)' : 'bearbeitbar';
        // console.log(`${filledFields} Felder erfolgreich ausgefüllt in ${pdf.name} (${modeText})`);
        
    } catch (error) {
        console.error('Fehler beim Ausfüllen des PDFs:', error);
        throw error;
    }
}

async function fillPDFForZip(pdf, data, flatten = true) {
    try {
        // Lade Original-PDF direkt vom Server (gleiche Logik wie fillAndDownloadPDF)
        const response = await fetch(pdf.path);
        if (!response.ok) {
            throw new Error(`Konnte PDF nicht laden: ${pdf.path}`);
        }
        const pdfBytes = await response.arrayBuffer();
        const pdfDoc = await PDFLib.PDFDocument.load(pdfBytes, { ignoreEncryption: true });
        const form = pdfDoc.getForm();
        
        // WICHTIG: Setze NeedAppearances Flag für PDFs die es benötigen
        try {
            const acroForm = pdfDoc.catalog.lookup(PDFLib.PDFName.of('AcroForm'));
            if (acroForm) {
                acroForm.set(PDFLib.PDFName.of('NeedAppearances'), PDFLib.PDFBool.True);
                // console.log('✓ NeedAppearances Flag gesetzt für ZIP');
            }
        } catch (e) {
            console.log('Konnte NeedAppearances Flag nicht setzen für ZIP:', e.message);
        }
        
        let filledFields = 0;
        const formData = data; // Verwende die übergebenen Daten anstatt getAllFormData() erneut aufzurufen
        const pdfConfig = window.pdfConfigs.get(pdf.name) || {};
        
        // console.log('🔍 ZIP: Verwende übergebene Formulardaten:', Object.keys(formData).length, 'Felder');
        // console.log(`\n=== PDF FELDANALYSE FÜR ZIP (${pdf.name}) ===`);
        const allFields = form.getFields();
        // console.log(`Gefundene Felder im PDF (${allFields.length}):`);
        
        // SCHRITT 1: ALLE VERFÜGBAREN FELDER (gleiche Logik wie fillAndDownloadPDF)
        // allFields.forEach(field => {
        //     const fieldName = field.getName();
        //     console.log(`📋 PDF-Feld: ${fieldName} (${field.constructor.name})`);
        // });

        // MAPPING-SYSTEM (aus fillAndDownloadPDF)
        const fieldMappings = new Map();
        
        // Baue Mapping-System auf
        if (pdfConfig.fields) {
            Object.entries(pdfConfig.fields).forEach(([pdfFieldName, config]) => {
                if (config.mapping) {
                    if (!fieldMappings.has(config.mapping)) {
                        fieldMappings.set(config.mapping, []);
                    }
                    fieldMappings.get(config.mapping).push(pdfFieldName);
                    // console.log(`🔗 Mapping: ${config.mapping} → ${pdfFieldName}`);
                }
            });
        }

        // ALLE VERFÜGBAREN DATEN VERARBEITEN (mit Mapping-Support)
        for (const [dataKey, dataValue] of Object.entries(formData)) {
            if (!dataValue || dataValue.toString().trim() === '') continue;
            
            const valueStr = dataValue.toString();
            
            // Direkte Feldsuche
            let targetFields = [];
            
            // 1. Direkte Übereinstimmung
            try {
                const directField = form.getField(dataKey);
                if (directField) {
                    targetFields.push(dataKey);
                }
            } catch (e) {
                // Feld existiert nicht direkt
            }
            
            // 2. Über Mapping-System
            if (fieldMappings.has(dataKey)) {
                const mappedFields = fieldMappings.get(dataKey);
                mappedFields.forEach(mappedField => {
                    try {
                        const field = form.getField(mappedField);
                        if (field && !targetFields.includes(mappedField)) {
                            targetFields.push(mappedField);
                        }
                    } catch (e) {
                        // Gemapptes Feld existiert nicht
                    }
                });
            }
            
            // Setze Werte für alle gefundenen Zielfelder
            for (const targetFieldName of targetFields) {
                try {
                    const field = form.getField(targetFieldName);
                    
                    if (field instanceof PDFLib.PDFTextField) {
                        field.setText(valueStr);
                        filledFields++;
                        // console.log(`✓ TextField ${targetFieldName} = "${valueStr}" (via ${dataKey})`);
                    } else if (field instanceof PDFLib.PDFCheckBox) {
                        if (valueStr === '1' || valueStr === 'true' || valueStr === 'on' || valueStr === 'checked') {
                            field.check();
                            filledFields++;
                            // console.log(`✓ CheckBox ${targetFieldName} aktiviert (via ${dataKey})`);
                        }
                    } else if (field instanceof PDFLib.PDFRadioGroup) {
                        const options = field.getOptions();
                        if (options.includes(valueStr)) {
                            field.select(valueStr);
                            filledFields++;
                            // console.log(`✓ RadioGroup ${targetFieldName} = "${valueStr}" (via ${dataKey})`);
                        }
                    } else if (field instanceof PDFLib.PDFDropdown) {
                        const options = field.getOptions();
                        if (options.includes(valueStr)) {
                            field.select(valueStr);
                            filledFields++;
                            // console.log(`✓ Dropdown ${targetFieldName} = "${valueStr}" (via ${dataKey})`);
                        }
                    }
                } catch (fieldError) {
                    console.warn(`Fehler beim Setzen von ${targetFieldName}:`, fieldError);
                }
            }
        }
        
        // SCHRITT 1.5: DIREKTE FELDSUCHE (wie in normaler PDF-Generierung)
        // console.log('\n=== DIREKTE FELDSUCHE FÜR ZIP ===');
        for (const field of allFields) {
            const fieldName = field.getName();
            if (formData[fieldName] && formData[fieldName].toString().trim() !== '') {
                const value = formData[fieldName];
                // console.log(`\n--- ZIP DIREKTE FELDSUCHE: ${fieldName} ---`);
                
                // Überspringe wenn bereits verarbeitet
                if (!pdf.fields.includes(fieldName)) {
                    try {
                        if (field instanceof PDFLib.PDFTextField) {
                            field.setText(value.toString());
                            filledFields++;
                            // console.log(`✓ ZIP Direkte TextField ${fieldName} = "${value}"`);
                        } else if (field instanceof PDFLib.PDFCheckBox) {
                            const shouldCheck = value === '1' || value === 'true' || value === true || 
                                               value === 'on' || value === 'Ja' || value === 'ja' || 
                                               value === 'YES' || value === 'yes' || value === 'checked';
                            if (shouldCheck) {
                                field.check();
                                filledFields++;
                                // console.log(`✓ ZIP Direkte CheckBox ${fieldName} aktiviert`);
                            }
                        } else if (field instanceof PDFLib.PDFRadioGroup) {
                            const options = field.getOptions();
                            if (options.includes(value.toString())) {
                                field.select(value.toString());
                                filledFields++;
                                // console.log(`✓ ZIP Direkte RadioGroup ${fieldName} = "${value}"`);
                            }
                        } else if (field instanceof PDFLib.PDFDropdown) {
                            const options = field.getOptions();
                            if (options.includes(value.toString())) {
                                field.select(value.toString());
                                filledFields++;
                                // console.log(`✓ ZIP Direkte Dropdown ${fieldName} = "${value}"`);
                            }
                        }
                    } catch (directFieldError) {
                        console.warn(`Fehler bei direkter Feldsuche ${fieldName} für ZIP:`, directFieldError);
                    }
                }
            }
        }
        
        // SCHRITT 2: UNTERSCHRIFT-FELDER (Verarbeite PDF-Felder direkt für korrekte Mappings)
        // console.log('\n=== UNTERSCHRIFT-VERARBEITUNG FÜR ZIP ===');
        // console.log('🔍 Alle Formulardaten für ZIP:', Object.keys(formData));
        // console.log('🔍 Unterschrift-Felder in Formulardaten:', Object.keys(formData).filter(key => 
        //     key.toLowerCase().includes('unterschrift') || key.toLowerCase().includes('signature')));
        
        // Durchlaufe alle PDF-Felder die Unterschriften sind
        if (pdfConfig.fields) {
            for (const [pdfFieldName, fieldConfig] of Object.entries(pdfConfig.fields)) {
                if ((pdfFieldName.toLowerCase().includes('signature') || 
                     pdfFieldName.toLowerCase().includes('unterschrift')) &&
                    fieldConfig.type === 'signature') {
                    
                    // console.log(`\n--- Verarbeite PDF-Unterschrift-Feld: ${pdfFieldName} ---`);
                    
                    // Bestimme welches Formularfeld verwendet werden soll
                    const formFieldName = fieldConfig.mapping || pdfFieldName;
                    const fieldValue = formData[formFieldName];
                    
                    // console.log(`  Mapping: ${pdfFieldName} → ${formFieldName}`);
                    // console.log(`  Wert vorhanden: ${!!fieldValue}`);
                    
                    if (fieldValue && fieldValue.toString().trim() !== '') {
                        let alreadyProcessed = false;
                        
                        // Versuche als PDF-Formularfeld
                        try {
                            const field = form.getField(pdfFieldName);
                            if (field instanceof PDFLib.PDFTextField) {
                                field.setText('[Unterschrift eingefügt]');
                                filledFields++;
                                alreadyProcessed = true;
                                // console.log(`✓ ZIP: Unterschrift-TextField ${pdfFieldName} gesetzt`);
                            }
                        } catch (e) {
                            // console.log(`  ${pdfFieldName} ist kein PDF-Formularfeld`);
                        }
                        
                        // Wenn nicht als Formularfeld verarbeitet, als Bild einbetten
                        if (!alreadyProcessed) {
                            try {
                                const success = await embedSignatureInPDF(pdfDoc, pdfFieldName, fieldValue, pdf.name);
                                if (success) {
                                    filledFields++;
                                    // console.log(`✓ ZIP: Unterschrift ${pdfFieldName} als Bild eingefügt (von ${formFieldName})`);
                                }
                            } catch (signatureError) {
                                console.warn(`Fehler beim Einbetten der Unterschrift ${pdfFieldName}:`, signatureError);
                            }
                        }
                    } else {
                        // console.log(`  ⏭️ Keine Daten für ${formFieldName}`);
                    }
                }
            }
        }
        
        // SCHRITT 2.5: ERWEITERTE UNTERSCHRIFT-BEHANDLUNG (wie in normaler PDF-Generierung)
        // console.log('\n=== ERWEITERTE UNTERSCHRIFT-BEHANDLUNG FÜR ZIP ===');
        // console.log('🔍 Suche nach Base64 Unterschriften...');
        const base64Signatures = Object.entries(formData).filter(([key, value]) => 
            (key.toLowerCase().includes('unterschrift') || key.toLowerCase().includes('signature')) && 
            value && value.startsWith && value.startsWith('data:image/'));
        // console.log(`🔍 Gefundene Base64 Unterschriften (${base64Signatures.length}):`, base64Signatures.map(([key, value]) => 
        //     `${key} (${value.substring(0, 50)}...)`));
            
        for (const [fieldName, fieldValue] of Object.entries(formData)) {
            if ((fieldName.toLowerCase().includes('unterschrift') || fieldName.toLowerCase().includes('signature')) && 
                fieldValue && fieldValue.startsWith('data:image/')) {
                
                // console.log(`Verarbeite erweiterte Unterschrift-Feld: ${fieldName}`);
                
                // Prüfe ob diese Unterschrift für dieses PDF konfiguriert ist
                const signatureConfig = getSignatureConfig(fieldName, pdf.name);
                if (signatureConfig.x === undefined && signatureConfig.y === undefined) {
                    // console.log(`⏭️ ZIP: Unterschrift ${fieldName} ist nicht für ${pdf.name} konfiguriert - überspringe`);
                    continue;
                }
                
                // Prüfe ob bereits als Formularfeld verarbeitet
                let alreadyProcessed = false;
                try {
                    const field = form.getField(fieldName);
                    if (field) {
                        alreadyProcessed = true;
                        // console.log(`ZIP: Unterschrift ${fieldName} bereits als Formularfeld verarbeitet`);
                    }
                } catch (e) {
                    // Feld existiert nicht als Formularfeld - das ist ok
                }
                
                if (!alreadyProcessed) {
                    try {
                        const success = await embedSignatureInPDF(pdfDoc, fieldName, fieldValue, pdf.name);
                        if (success) {
                            filledFields++;
                            // console.log(`✓ ZIP: Erweiterte Unterschrift ${fieldName} als separates Bild eingefügt`);
                        }
                    } catch (signatureError) {
                        console.warn(`Fehler beim Einbetten der erweiterten Unterschrift ${fieldName} für ZIP:`, signatureError);
                    }
                }
            }
        }
        
        // SCHRITT 3: FORMULAR FLACHWANDELN (FALLS GEWÜNSCHT)
        if (flatten) {
            try {
                form.flatten();
                // console.log('✓ Formular geflacht für ZIP');
            } catch (flattenError) {
                console.warn('⚠️ Warnung: Formular konnte nicht geflacht werden:', flattenError);
            }
        }
        
        // SCHRITT 4: PDF-BYTES GENERIEREN UND ALS BLOB ZURÜCKGEBEN
        // console.log('📦 Generiere PDF-Bytes für ZIP...');
        const filledPdfBytes = await pdfDoc.save();
        const blob = new Blob([filledPdfBytes], { type: 'application/pdf' });
        
        const modeText = flatten ? 'geflacht (nicht bearbeitbar)' : 'bearbeitbar';
        // console.log(`${filledFields} Felder erfolgreich ausgefüllt in ${pdf.name} für ZIP (${modeText})`);
        
        return blob;
        
    } catch (error) {
        console.error('Fehler beim Ausfüllen des PDFs für ZIP:', error);
        throw error;
    }
}

function extractFieldOrderFromYaml(yamlText, pdfName) {
    const lines = yamlText.split('\n');
    let inFieldsSection = false;
    const extractedOrder = {};
    const fieldToGroupMap = {};
    const fieldOrder = [];
    
    // console.log(`=== YAML-PARSING für ${pdfName} ===`);
    
    // Erst alle Felder sammeln und deren Gruppen bestimmen
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        if (line.trim() === 'fields:') {
            inFieldsSection = true;
            // console.log('Fields-Sektion gefunden');
            continue;
        }
        
        if (inFieldsSection) {
            if (line.trim() !== '' && !line.startsWith(' ') && !line.startsWith('\t')) {
                // console.log('Ende der Fields-Sektion erreicht');
                break;
            }
            
            // Nur echte Feldnamen erfassen (Zeilen mit genau 2 Leerzeichen gefolgt von Feldname:)
            const fieldMatch = line.match(/^  ([^:]+):\s*$/);
            if (fieldMatch) {
                const fieldName = fieldMatch[1].trim();
                // Überspringe bekannte Metadaten-Schlüssel
                if (!['group', 'type', 'description', 'options', 'mapping', 'hidden_for_pdfs', 'title', 'signature_width', 'signature_height', 'signature_x', 'signature_y', 'signature_page', 'berechnung'].includes(fieldName)) {
                    fieldOrder.push(fieldName);
                
                    let fieldGroup = 'Sonstige';
                
                // Suche nach der group-Zeile für dieses Feld
                for (let j = i + 1; j < lines.length; j++) {
                    const nextLine = lines[j];
                    
                    if (nextLine.match(/^  [^:]+:/)) {
                        break;
                    }
                    
                    const groupMatch = nextLine.match(/^\s+group:\s*(.+)$/);
                    if (groupMatch) {
                        fieldGroup = groupMatch[1].trim();
                        // console.log(`  → Gruppe: ${fieldGroup}`);
                        break;
                    }
                }
                
                    fieldToGroupMap[fieldName] = fieldGroup;
                }
            }
        }
    }
    
    // Felder in der ursprünglichen Reihenfolge zu ihren Gruppen zuordnen
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
                    // console.log(`Gruppe gefunden: ${groupName} (Position ${groupOrder.length})`);
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
    
    // console.log(`YAML-Feldreihenfolge für ${pdfName} extrahiert:`, extractedOrder);
    // console.log(`YAML-Gruppenreihenfolge für ${pdfName} extrahiert:`, groupOrder);
    // console.log(`=== ENDE YAML-PARSING ===\n`);
    
    return extractedOrder;
}

async function loadPDFConfigForFile(pdfName) {
    try {
        const configName = pdfName.replace('.pdf', '.yaml');
        const response = await fetch(`../formulare/${encodeURIComponent(configName)}`);
        if (response.ok) {
            const yamlText = await response.text();
            const config = jsyaml.load(yamlText);
            window.pdfConfigs.set(pdfName, config);
            
            // Extrahiere Feldreihenfolge aus YAML-Text
            extractFieldOrderFromYaml(yamlText, pdfName);
            
            // console.log(`Konfiguration für ${pdfName} geladen:`, config);
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
        // console.log('🔍 Versuche config.yaml zu laden von:', '../config.yaml');
        // console.log('🌐 Aktuelle URL:', window.location.href);
        
        // Lade config.yaml für PDF-Liste
        const configResponse = await fetch('../config.yaml');
        // console.log('📄 Config response status:', configResponse.status);
        
        if (!configResponse.ok) {
            throw new Error(`config.yaml nicht gefunden (Status: ${configResponse.status}). URL: ${window.location.href}`);
        }
        
        const configText = await configResponse.text();
        const config = jsyaml.load(configText);
        
        if (!config.pdfs || !Array.isArray(config.pdfs)) {
            throw new Error('Keine PDFs in config.yaml definiert');
        }
        
        // console.log(`Lade ${config.pdfs.length} PDFs aus config.yaml`);
        
        for (const pdfInfo of config.pdfs) {
            const pdfName = pdfInfo.name;
            
            try {
                // console.log(`🔄 Lade PDF: ${pdfName}`);
                const response = await fetch(`../formulare/${encodeURIComponent(pdfName)}`);
                if (response.ok) {
                    // console.log(`📥 Response OK für ${pdfName}, Größe: ${response.headers.get('content-length')} bytes`);
                    const arrayBuffer = await response.arrayBuffer();
                    // console.log(`📦 ArrayBuffer erhalten für ${pdfName}, Größe: ${arrayBuffer.byteLength} bytes`);
                    const pdfDoc = await PDFLib.PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
                    // console.log(`✅ PDF-Dokument geladen für ${pdfName}`);
                    const fields = await extractFieldsFromPDF(pdfDoc, pdfName);
                    // console.log(`📝 ${fields.length} Felder extrahiert für ${pdfName}`);
                    
                    // Lade individuelle Konfiguration für dieses PDF
                    const hasConfig = await loadPDFConfigForFile(pdfName);
                    
                    window.availablePDFs.push({
                        name: pdfName,
                        path: `../formulare/${pdfName}`,
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
                console.error(`❌ FEHLER beim Laden von ${pdfName}:`, error);
                console.error(`📊 Details - Response status: ${error.status || 'unknown'}`);
                console.error(`📊 Error type: ${error.constructor.name}`);
                console.error(`📊 Error message: ${error.message}`);
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
    
    // Fallback-Modus wenn pdfDoc null ist (beschädigtes PDF)
    if (!pdfDoc) {
        // console.log(`Verwende Fallback-Felder für ${pdfName}`);
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
        return [...new Set(extractedFields)];
    }
    
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
                    // console.log(`Radio Group ${fieldName} gefunden mit Optionen:`, options);
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

function generateFileName(pdfName, data, flatten = true) {
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
    
    // Add suffix for mode
    const suffix = flatten ? '_flach' : '_bearbeitbar';
    
    return fileName + suffix + '.pdf';
}