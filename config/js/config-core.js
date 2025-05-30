// config/js/config-core.js
// Core Konfiguration Logic

// Config-spezifische globale Variablen
window.currentPDF = null;
window.currentConfig = { fields: {}, groups: {} };
window.currentGroup = null;
window.currentField = null;
window.groupsOrder = [];
window.fieldsOrder = {};

async function loadExistingConfig(pdfName) {
    try {
        const configName = pdfName.replace('.pdf', '.yaml');
        const response = await fetch(`../formulare/${encodeURIComponent(configName)}`);
        if (response.ok) {
            const yamlText = await response.text();
            window.currentConfig = jsyaml.load(yamlText) || { fields: {}, groups: {} };
            
            // Extrahiere die ursprüngliche Feldreihenfolge aus dem YAML-Text
            extractFieldOrderFromYaml(yamlText);
            
            showConfigStatus('Existierende Konfiguration geladen', 'success');
        } else {
            // Neue Konfiguration mit Standard-Gruppen
            window.currentConfig = {
                fields: {},
                groups: {
                    'Persönliche Daten': {
                        title: '👤 Persönliche Angaben',
                        description: 'Grundlegende persönliche Informationen'
                    },
                    'Kontaktdaten': {
                        title: '📞 Kontaktinformationen', 
                        description: 'Wie können wir Sie erreichen?'
                    },
                    'Dienstleistung': {
                        title: '🎖️ Dienstleistungsangaben',
                        description: 'Informationen zur Dienstleistung'
                    },
                    'Einverständnis': {
                        title: '✅ Einverständniserklärungen',
                        description: 'Erforderliche Zustimmungen'
                    },
                    'Sonstige': {
                        title: '📋 Sonstige Felder',
                        description: 'Weitere Informationen'
                    }
                }
            };
            showConfigStatus('Neue Konfiguration erstellt', 'success');
        }
    } catch (error) {
        window.currentConfig = { fields: {}, groups: {} };
        showConfigStatus('Fehler beim Laden der Konfiguration: ' + error.message, 'error');
    }
}

function extractFieldOrderFromYaml(yamlText) {
    // Extrahiere die Feldreihenfolge aus dem ursprünglichen YAML-Text
    const lines = yamlText.split('\n');
    let inFieldsSection = false;
    let currentGroup = '';
    const extractedOrder = {};
    
    for (const line of lines) {
        if (line.trim() === 'fields:') {
            inFieldsSection = true;
            continue;
        }
        
        if (inFieldsSection) {
            // Ende der fields-Sektion erreicht
            if (line.trim() !== '' && !line.startsWith(' ') && !line.startsWith('\t')) {
                break;
            }
            
            // Feld-Definition (beginnt mit 2 Leerzeichen, gefolgt von Feldname:)
            const fieldMatch = line.match(/^  ([^:]+):/);
            if (fieldMatch) {
                const fieldName = fieldMatch[1].trim();
                
                // Suche nach der Gruppenzugehörigkeit in den folgenden Zeilen
                // oder verwende die bereits bekannte Gruppe
                if (window.currentConfig.fields[fieldName] && window.currentConfig.fields[fieldName].group) {
                    currentGroup = window.currentConfig.fields[fieldName].group;
                } else {
                    currentGroup = 'Sonstige'; // Fallback
                }
                
                if (!extractedOrder[currentGroup]) {
                    extractedOrder[currentGroup] = [];
                }
                extractedOrder[currentGroup].push(fieldName);
            }
            
            // Gruppe aus dem field-Eintrag extrahieren
            const groupMatch = line.match(/^\s+group:\s*(.+)$/);
            if (groupMatch) {
                currentGroup = groupMatch[1].trim();
            }
        }
    }
    
    // Übernehme die extrahierte Reihenfolge in fieldsOrder
    Object.keys(extractedOrder).forEach(groupName => {
        if (!window.fieldsOrder[groupName]) {
            window.fieldsOrder[groupName] = [];
        }
        window.fieldsOrder[groupName] = extractedOrder[groupName];
    });
}

function buildGroupsOrder() {
    window.groupsOrder = Object.keys(window.currentConfig.groups || {});
    // Standard-Reihenfolge falls keine Gruppen vorhanden
    if (window.groupsOrder.length === 0) {
        window.groupsOrder = ['Persönliche Daten', 'Kontaktdaten', 'Dienstleistung', 'Einverständnis', 'Sonstige'];
        window.groupsOrder.forEach(groupName => {
            if (!window.currentConfig.groups) window.currentConfig.groups = {};
            if (!window.currentConfig.groups[groupName]) {
                window.currentConfig.groups[groupName] = {
                    title: groupName,
                    description: ''
                };
            }
        });
    }
}

function buildFieldsOrder() {
    // Wenn bereits eine Feldreihenfolge aus YAML extrahiert wurde, verwende diese
    if (Object.keys(window.fieldsOrder).length > 0) {
        // Ergänze fehlende Felder zur 'Sonstige' Gruppe
        const allFields = [...window.currentPDF.fields];
        const assignedFields = new Set();
        
        // Sammle alle bereits zugewiesenen Felder
        Object.values(window.fieldsOrder).forEach(fields => {
            fields.forEach(field => assignedFields.add(field));
        });
        
        // Füge nicht zugewiesene Felder zur 'Sonstige' Gruppe hinzu
        if (!window.fieldsOrder['Sonstige']) {
            window.fieldsOrder['Sonstige'] = [];
        }
        
        allFields.forEach(fieldName => {
            if (!assignedFields.has(fieldName)) {
                window.fieldsOrder['Sonstige'].push(fieldName);
                // Feld-Konfiguration erstellen falls nicht vorhanden
                if (!window.currentConfig.fields[fieldName]) {
                    window.currentConfig.fields[fieldName] = {
                        group: 'Sonstige'
                    };
                } else {
                    window.currentConfig.fields[fieldName].group = 'Sonstige';
                }
            }
        });
        
        return; // Früher Ausstieg, da Reihenfolge bereits existiert
    }
    
    // Fallback: Alte Logik für neue Konfigurationen
    window.fieldsOrder = {};
    
    // Alle PDF-Felder als Basis
    const allFields = [...window.currentPDF.fields];
    
    // Bereits gruppierte Felder sammeln
    const assignedFields = new Set();
    
    window.groupsOrder.forEach(groupName => {
        window.fieldsOrder[groupName] = [];
        
        // Felder zu Gruppen zuordnen
        allFields.forEach(fieldName => {
            const fieldConfig = window.currentConfig.fields[fieldName] || {};
            if (fieldConfig.group === groupName) {
                window.fieldsOrder[groupName].push(fieldName);
                assignedFields.add(fieldName);
            }
        });
    });
    
    // Nicht zugewiesene Felder zur 'Sonstige' Gruppe hinzufügen
    if (!window.fieldsOrder['Sonstige']) {
        window.fieldsOrder['Sonstige'] = [];
    }
    
    allFields.forEach(fieldName => {
        if (!assignedFields.has(fieldName)) {
            window.fieldsOrder['Sonstige'].push(fieldName);
            // Feld-Konfiguration erstellen falls nicht vorhanden
            if (!window.currentConfig.fields[fieldName]) {
                window.currentConfig.fields[fieldName] = {
                    group: 'Sonstige'
                };
            } else {
                window.currentConfig.fields[fieldName].group = 'Sonstige';
            }
        }
    });
}

function saveCurrentProperties() {
    // Gruppen-Eigenschaften speichern
    if (window.currentGroup && document.getElementById('groupProperties').classList.contains('active')) {
        const groupConfig = window.currentConfig.groups[window.currentGroup] || {};
        groupConfig.title = document.getElementById('groupTitle').value;
        groupConfig.description = document.getElementById('groupDescription').value;
        window.currentConfig.groups[window.currentGroup] = groupConfig;
    }
    
    // Feld-Eigenschaften speichern
    if (window.currentField && document.getElementById('fieldProperties').classList.contains('active')) {
        const fieldConfig = window.currentConfig.fields[window.currentField] || {};
        fieldConfig.title = document.getElementById('fieldTitle').value;
        fieldConfig.description = document.getElementById('fieldDescription').value;
        fieldConfig.type = document.getElementById('fieldType').value;
        fieldConfig.mapping = document.getElementById('fieldMapping').value;
        fieldConfig.berechnung = document.getElementById('fieldCalculation').value;
        fieldConfig.group = window.currentGroup;
        
        // Radio Button Optionen
        if (fieldConfig.type === 'radio') {
            const optionsText = document.getElementById('fieldOptions').value.trim();
            if (optionsText) {
                fieldConfig.options = optionsText.split('\n').map(opt => opt.trim()).filter(opt => opt.length > 0);
            }
        } else {
            delete fieldConfig.options;
        }
        
        // Hidden-Status
        const isHidden = document.getElementById('fieldHidden').checked;
        if (isHidden) {
            fieldConfig.hidden_for_pdfs = [window.currentPDF.name];
        } else {
            delete fieldConfig.hidden_for_pdfs;
        }
        
        // Leere Werte entfernen
        Object.keys(fieldConfig).forEach(key => {
            if (fieldConfig[key] === '' || fieldConfig[key] === null || fieldConfig[key] === undefined) {
                delete fieldConfig[key];
            }
        });
        
        window.currentConfig.fields[window.currentField] = fieldConfig;
        
        // Felder neu rendern um Badges zu aktualisieren
        renderFields();
    }
}

function buildFinalConfig() {
    saveCurrentProperties();
    
    const finalConfig = {
        groups: {},
        fields: {}
    };
    
    // Gruppen in richtiger Reihenfolge (basierend auf groupsOrder)
    window.groupsOrder.forEach(groupName => {
        if (window.currentConfig.groups[groupName]) {
            finalConfig.groups[groupName] = { ...window.currentConfig.groups[groupName] };
        }
    });
    
    // Felder mit Gruppenzuordnung und in der richtigen Reihenfolge BEIBEHALTEN
    window.groupsOrder.forEach(groupName => {
        const fieldsInGroup = window.fieldsOrder[groupName] || [];
        fieldsInGroup.forEach(fieldName => {
            if (window.currentConfig.fields[fieldName]) {
                const fieldConfig = { ...window.currentConfig.fields[fieldName] };
                fieldConfig.group = groupName;
                finalConfig.fields[fieldName] = fieldConfig;
            }
        });
    });
    
    // Füge übrige Felder hinzu, die nicht in fieldsOrder stehen
    Object.keys(window.currentConfig.fields).forEach(fieldName => {
        if (!finalConfig.fields[fieldName]) {
            const fieldConfig = { ...window.currentConfig.fields[fieldName] };
            // Gruppe basierend auf fieldsOrder setzen
            let foundGroup = 'Sonstige';
            for (const [groupName, fields] of Object.entries(window.fieldsOrder)) {
                if (fields.includes(fieldName)) {
                    foundGroup = groupName;
                    break;
                }
            }
            fieldConfig.group = foundGroup;
            finalConfig.fields[fieldName] = fieldConfig;
        }
    });
    
    return finalConfig;
}

function assignFieldToGroup(fieldName, groupName) {
    // Feld aus alter Gruppe entfernen
    Object.keys(window.fieldsOrder).forEach(group => {
        window.fieldsOrder[group] = window.fieldsOrder[group].filter(name => name !== fieldName);
    });
    
    // Feld zur neuen Gruppe hinzufügen
    if (!window.fieldsOrder[groupName]) window.fieldsOrder[groupName] = [];
    window.fieldsOrder[groupName].push(fieldName);
    
    // Feld-Konfiguration aktualisieren
    if (!window.currentConfig.fields[fieldName]) {
        window.currentConfig.fields[fieldName] = {};
    }
    window.currentConfig.fields[fieldName].group = groupName;
    
    renderGroups();
    renderFields();
    showConfigStatus(`Feld "${fieldName}" zu Gruppe "${groupName}" hinzugefügt`, 'success');
}