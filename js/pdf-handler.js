// js/pdf-handler.js
// PDF-Verarbeitung und -Verwaltung - Vereinfachte Setzlogik basierend auf Demo

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

// VEREINFACHTE SETZLOGIK basierend auf dem Demo-Skript
function setFieldValue(field, value, fieldName) {
    try {
        console.log(`Setze Feld ${fieldName} (${field.constructor.name}) auf Wert: "${value}"`);
        
        if (field instanceof PDFLib.PDFTextField) {
            field.setText(String(value));
            console.log(`✓ TextField ${fieldName} gesetzt`);
            return true;
        } 
        else if (field instanceof PDFLib.PDFCheckBox) {
            const shouldCheck = value === '1' || value === 'true' || value === true || 
                               value === 'on' || value === 'Ja' || value === 'ja' || 
                               value === 'YES' || value === 'yes' || value === 'checked';
            
            if (shouldCheck) {
                field.check();
                console.log(`✓ CheckBox ${fieldName} aktiviert`);
            } else {
                field.uncheck();
                console.log(`✓ CheckBox ${fieldName} deaktiviert`);
            }
            return true;
        } 
        else if (field instanceof PDFLib.PDFRadioGroup) {
            const options = field.getOptions();
            const valueStr = String(value);
            
            // Versuche zuerst exakte Übereinstimmung
            if (options.includes(valueStr)) {
                field.select(valueStr);
                console.log(`✓ RadioGroup ${fieldName} auf "${valueStr}" gesetzt`);
                return true;
            }
            
            // Versuche fallback auf ersten Wert wenn verfügbar
            if (options.length > 0) {
                field.select(options[0]);
                console.log(`✓ RadioGroup ${fieldName} auf ersten Wert "${options[0]}" gesetzt (Fallback)`);
                return true;
            }
            
            console.warn(`RadioGroup ${fieldName}: Keine passenden Optionen gefunden`);
            return false;
        } 
        else if (field instanceof PDFLib.PDFDropdown) {
            const options = field.getOptions();
            const valueStr = String(value);
            
            // Versuche zuerst exakte Übereinstimmung
            if (options.includes(valueStr)) {
                field.select(valueStr);
                console.log(`✓ Dropdown ${fieldName} auf "${valueStr}" gesetzt`);
                return true;
            }
            
            // Spezielle Logik für Übung/Uebung aus dem Demo
            const target = options.find(v => /übung|uebung/i.test(v)) || options[0];
            if (target) {
                field.select(target);
                console.log(`✓ Dropdown ${fieldName} auf "${target}" gesetzt (Fallback)`);
                return true;
            }
            
            console.warn(`Dropdown ${fieldName}: Keine passenden Optionen gefunden`);
            return false;
        } 
        else if (field instanceof PDFLib.PDFOptionList) {
            const options = field.getOptions();
            if (options.length > 0) {
                field.select(options[0]);
                console.log(`✓ OptionList ${fieldName} auf ersten Wert gesetzt`);
                return true;
            }
            return false;
        } 
        else {
            console.warn(`Unbekannter Feldtyp für ${fieldName}: ${field.constructor.name}`);
            // Fallback: Versuche setText wenn verfügbar
            if (typeof field.setText === 'function') {
                field.setText(String(value));
                console.log(`✓ Unbekannter Typ ${fieldName} mit setText gesetzt`);
                return true;
            }
            return false;
        }
    } catch (error) {
        console.warn(`Fehler beim Setzen von Feld ${fieldName}:`, error);
        return false;
    }
}

async function fillAndDownloadPDF(pdf, data) {
    try {
        const pdfBytes = await pdf.document.save();
        const pdfDoc = await PDFLib.PDFDocument.load(pdfBytes);
        const form = pdfDoc.getForm();
        
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
        
        // Hauptlogik: Iteriere über alle PDF-Felder und versuche sie zu setzen
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
                console.log(`\n--- VERARBEITE FELD: ${fieldName} ---`);
                console.log(`Wert: "${value}"`);
                
                try {
                    const field = form.getField(fieldName);
                    if (field) {
                        // NEUE VEREINFACHTE SETZLOGIK aus dem Demo
                        const success = setFieldValue(field, value, fieldName);
                        if (success) {
                            filledFields++;
                        }
                    } else {
                        console.warn(`Feld ${fieldName} nicht im PDF gefunden`);
                    }
                } catch (error) {
                    console.warn(`Fehler beim Zugriff auf Feld ${fieldName}:`, error);
                }
            }
        });
        
        // Versuche auch direkte Feldsuche für bessere Abdeckung
        allFields.forEach(field => {
            const fieldName = field.getName();
            if (formData[fieldName] && formData[fieldName].toString().trim() !== '') {
                const value = formData[fieldName];
                console.log(`\n--- DIREKTE FELDSUCHE: ${fieldName} ---`);
                console.log(`Wert: "${value}"`);
                
                // Überspringe wenn bereits verarbeitet
                if (!pdf.fields.includes(fieldName)) {
                    const success = setFieldValue(field, value, fieldName);
                    if (success) {
                        filledFields++;
                    }
                }
            }
        });
        
        // Form-Updates
        try {
            const helveticaFont = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);
            form.updateFieldAppearances(helveticaFont);
        } catch (error) {
            console.warn('Fehler beim Aktualisieren der Appearances:', error);
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