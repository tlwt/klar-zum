// config/js/config-core.js
// Erweiterte Core Konfiguration Logic mit Unterschrift-Positionierung und Feldverschiebung

// Config-spezifische globale Variablen
window.currentPDF = null;
window.currentConfig = { fields: {}, groups: {} };
window.currentGroup = null;
window.currentField = null;
window.groupsOrder = [];
window.fieldsOrder = {};

async function loadExistingConfig(pdfName) {
    // Zurücksetzen der globalen Variablen
    resetConfigState();
    
    try {
        const configName = pdfName.replace('.pdf', '.yaml');
        const response = await fetch(`../formulare/${encodeURIComponent(configName)}`);
        if (response.ok) {
            const yamlText = await response.text();
            window.currentConfig = jsyaml.load(yamlText) || { fields: {}, groups: {} };
            
            // Extrahiere die ursprüngliche Feldreihenfolge aus dem YAML-Text
            extractFieldOrderFromYaml(yamlText);
            
            console.log('Geladene Konfiguration:', window.currentConfig);
            showConfigStatus('Existierende Konfiguration geladen', 'success');
        } else {
            // Neue Konfiguration mit Standard-Gruppen
            createDefaultConfig();
            showConfigStatus('Neue Konfiguration erstellt', 'success');
        }
    } catch (error) {
        createDefaultConfig();
        showConfigStatus('Fehler beim Laden der Konfiguration: ' + error.message, 'error');
    }
}

function resetConfigState() {
    window.currentConfig = { fields: {}, groups: {} };
    window.currentGroup = null;
    window.currentField = null;
    window.groupsOrder = [];
    window.fieldsOrder = {};
    
    console.log('Config State zurückgesetzt');
}

function createDefaultConfig() {
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
            'Unterschriften': {
                title: '✍️ Unterschriften',
                description: 'Erforderliche Unterschriften'
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
}

function extractFieldOrderFromYaml(yamlText) {
    const lines = yamlText.split('\n');
    let inFieldsSection = false;
    const extractedOrder = {};
    const fieldToGroupMap = {};
    
    // Erst alle Felder sammeln und deren Gruppen bestimmen
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        if (line.trim() === 'fields:') {
            inFieldsSection = true;
            continue;
        }
        
        if (inFieldsSection) {
            if (line.trim() !== '' && !line.startsWith(' ') && !line.startsWith('\t')) {
                break;
            }
            
            const fieldMatch = line.match(/^  ([^:]+):/);
            if (fieldMatch) {
                const fieldName = fieldMatch[1].trim();
                const yamlProperties = ['group', 'type', 'options', 'title', 'description', 
                                      'mapping', 'berechnung', 'hidden_for_pdfs', 'virtual_field',
                                      'signature_width', 'signature_height', 'signature_x', 'signature_y',
                                      'signature_page'];
                
                if (yamlProperties.includes(fieldName)) {
                    continue;
                }
                
                let fieldGroup = 'Sonstige';
                
                // Suche nach der group-Zeile für dieses Feld
                for (let j = i + 1; j < lines.length; j++) {
                    const nextLine = lines[j];
                    
                    if (nextLine.match(/^  [^:]+:/) && 
                        !yamlProperties.includes(nextLine.match(/^  ([^:]+):/)?.[1]?.trim())) {
                        break;
                    }
                    
                    const groupMatch = nextLine.match(/^\s+group:\s*(.+)$/);
                    if (groupMatch) {
                        fieldGroup = groupMatch[1].trim();
                        break;
                    }
                }
                
                fieldToGroupMap[fieldName] = fieldGroup;
            }
        }
    }
    
    // Felder in der ursprünglichen Reihenfolge zu ihren Gruppen zuordnen
    inFieldsSection = false;
    for (const line of lines) {
        if (line.trim() === 'fields:') {
            inFieldsSection = true;
            continue;
        }
        
        if (inFieldsSection) {
            if (line.trim() !== '' && !line.startsWith(' ') && !line.startsWith('\t')) {
                break;
            }
            
            const fieldMatch = line.match(/^  ([^:]+):/);
            if (fieldMatch) {
                const fieldName = fieldMatch[1].trim();
                const yamlProperties = ['group', 'type', 'options', 'title', 'description', 
                                      'mapping', 'berechnung', 'hidden_for_pdfs', 'virtual_field',
                                      'signature_width', 'signature_height', 'signature_x', 'signature_y',
                                      'signature_page'];
                
                if (yamlProperties.includes(fieldName)) {
                    continue;
                }
                
                const groupName = fieldToGroupMap[fieldName] || 'Sonstige';
                
                if (!extractedOrder[groupName]) {
                    extractedOrder[groupName] = [];
                }
                extractedOrder[groupName].push(fieldName);
            }
        }
    }
    
    Object.keys(extractedOrder).forEach(groupName => {
        if (!window.fieldsOrder[groupName]) {
            window.fieldsOrder[groupName] = [];
        }
        window.fieldsOrder[groupName] = extractedOrder[groupName];
    });
    
    console.log('YAML-Feldreihenfolge extrahiert:', extractedOrder);
}

function buildGroupsOrder() {
    window.groupsOrder = Object.keys(window.currentConfig.groups || {});
    if (window.groupsOrder.length === 0) {
        window.groupsOrder = ['Persönliche Daten', 'Kontaktdaten', 'Dienstleistung', 'Unterschriften', 'Einverständnis', 'Sonstige'];
        window.groupsOrder.forEach(groupName => {
            if (!window.currentConfig.groups) window.currentConfig.groups = {};
            if (!window.currentConfig.groups[groupName]) {
               const groupTitles = {
                   'Persönliche Daten': '👤 Persönliche Angaben',
                   'Kontaktdaten': '📞 Kontaktinformationen',
                   'Dienstleistung': '🎖️ Dienstleistungsangaben',
                   'Unterschriften': '✍️ Unterschriften',
                   'Einverständnis': '✅ Einverständniserklärungen',
                   'Sonstige': '📋 Sonstige Felder'
               };
               
               window.currentConfig.groups[groupName] = {
                   title: groupTitles[groupName] || groupName,
                   description: ''
               };
           }
       });
   }
}

function buildFieldsOrder() {
   console.log('Baue Feldreihenfolge auf für PDF:', window.currentPDF.name);
   
   if (Object.keys(window.fieldsOrder).length > 0) {
       console.log('Verwende bereits extrahierte Feldreihenfolge');
       const allFields = [...window.currentPDF.fields];
       const assignedFields = new Set();
       
       Object.values(window.fieldsOrder).forEach(fields => {
           fields.forEach(field => assignedFields.add(field));
       });
       
       if (!window.fieldsOrder['Sonstige']) {
           window.fieldsOrder['Sonstige'] = [];
       }
       
       allFields.forEach(fieldName => {
           if (!assignedFields.has(fieldName)) {
               window.fieldsOrder['Sonstige'].push(fieldName);
               if (!window.currentConfig.fields[fieldName]) {
                   window.currentConfig.fields[fieldName] = {
                       group: 'Sonstige'
                   };
               } else {
                   window.currentConfig.fields[fieldName].group = 'Sonstige';
               }
           }
       });
       
       console.log('Finale fieldsOrder (mit YAML):', window.fieldsOrder);
       return;
   }
   
   console.log('Erstelle neue Feldreihenfolge mit intelligenter Zuordnung');
   window.fieldsOrder = {};
   
   const allFields = [...window.currentPDF.fields];
   const assignedFields = new Set();
   
   window.groupsOrder.forEach(groupName => {
       window.fieldsOrder[groupName] = [];
   });
   
   allFields.forEach(fieldName => {
       let targetGroup = 'Sonstige';
       
       if (window.currentConfig.fields[fieldName] && window.currentConfig.fields[fieldName].group) {
           targetGroup = window.currentConfig.fields[fieldName].group;
       } else {
           targetGroup = getSmartFieldGroup(fieldName);
           
           if (!window.currentConfig.fields[fieldName]) {
               window.currentConfig.fields[fieldName] = {};
           }
           window.currentConfig.fields[fieldName].group = targetGroup;
           
           const autoType = getAutoFieldType(fieldName);
           if (autoType.type && autoType.type !== 'text') {
               window.currentConfig.fields[fieldName].type = autoType.type;
               if (autoType.options) {
                   window.currentConfig.fields[fieldName].options = autoType.options;
               }
               if (autoType.signature_width) {
                   window.currentConfig.fields[fieldName].signature_width = autoType.signature_width;
                   window.currentConfig.fields[fieldName].signature_height = autoType.signature_height;
               }
           }
       }
       
       if (!window.fieldsOrder[targetGroup]) {
           window.fieldsOrder[targetGroup] = [];
       }
       
       window.fieldsOrder[targetGroup].push(fieldName);
       assignedFields.add(fieldName);
       
       console.log(`Feld ${fieldName} → Gruppe ${targetGroup}`);
   });
   
   Object.keys(window.currentConfig.fields).forEach(fieldName => {
       if (!assignedFields.has(fieldName)) {
           const fieldConfig = window.currentConfig.fields[fieldName];
           const group = fieldConfig.group || 'Sonstige';
           
           if (!window.fieldsOrder[group]) {
               window.fieldsOrder[group] = [];
           }
           
           window.fieldsOrder[group].push(fieldName);
           console.log(`Virtuelles Feld ${fieldName} → Gruppe ${group}`);
       }
   });
   
   console.log('Finale fieldsOrder (neu erstellt):', window.fieldsOrder);
}

function getSmartFieldGroup(fieldName) {
   const name = fieldName.toLowerCase();
   
   if (name.includes('nachname') || name.includes('vorname') || name.includes('name') ||
       name.includes('dienstgrad') || name.includes('personal') || name.includes('kennnummer') ||
       name.includes('geburt') || name.includes('datum')) {
       return 'Persönliche Daten';
   }
   
   if (name.includes('email') || name.includes('mail') || name.includes('telefon') || 
       name.includes('tel') || name.includes('fax') || name.includes('adresse') || 
       name.includes('strasse') || name.includes('ort') || name.includes('plz') ||
       name.includes('postleitzahl')) {
       return 'Kontaktdaten';
   }
   
   if (name.includes('dienst') || name.includes('truppenteil') || name.includes('standort') ||
       name.includes('einheit') || name.includes('verwendung') || name.includes('heranziehung') ||
       name.includes('widerspruch') || name.includes('anreise') || name.includes('gutschein')) {
       return 'Dienstleistung';
   }
   
   if (name.includes('unterschrift') || name.includes('signature') || name.includes('sign') ||
       (name.includes('datum') && name.includes('ort'))) {
       return 'Unterschriften';
   }
   
   if (name.includes('einverständnis') || name.includes('einverstaendnis') || 
       name.includes('überschrift') || name.includes('ueberschrift') ||
       name.includes('strafverfahren') || name.includes('interessenskollis') ||
       name.includes('unternehmen') || name.includes('organisation') ||
       name.includes('mandats') || name.includes('beamten') || name.includes('arbeits')) {
       return 'Einverständnis';
   }
   
   return 'Sonstige';
}

function getAutoFieldType(fieldName) {
   const name = fieldName.toLowerCase();
   const result = { type: 'text' };
   
   if (name.includes('email') || name.includes('mail')) {
       result.type = 'email';
       return result;
   }
   
   if (name.includes('telefon') || name.includes('tel') || name.includes('fax')) {
       result.type = 'tel';
       return result;
   }
   
   if (name.includes('datum') && !name.includes('ort')) {
       result.type = 'date';
       return result;
   }
   
   if (name.includes('unterschrift') || name.includes('signature') || name.includes('sign') ||
       (name.includes('datum') && name.includes('ort'))) {
       result.type = 'signature';
       result.signature_width = 200;
       result.signature_height = 100;
       // Standardposition (kann vom Benutzer angepasst werden)
       result.signature_x = 50;
       result.signature_y = 100;
       result.signature_page = 1; // Erste Seite als Standard
       return result;
   }
   
   if (name.includes('strafverfahren') || name.includes('anreise') || name.includes('wiederverwendung')) {
       result.type = 'radio';
       result.options = ['Ja', 'Nein'];
       return result;
   }
   
   if (name.includes('ueberschrift') || name.includes('einverstaendnis')) {
       result.type = 'radio';
       result.options = [
           'einer Übung nach § 61 SG', 
           'eines Wehrdienstes zur temporären Verbesserung der personellen Einsatzbereitschaft nach § 63b SG'
       ];
       return result;
   }
   
   if (name.includes('dienstgrad')) {
       result.type = 'select';
       result.options = [
           'Leutnant d.R.', 'Oberleutnant d.R.', 'Hauptmann d.R.', 
           'Major d.R.', 'Oberstleutnant d.R.', 'Oberst d.R.'
       ];
       return result;
   }
   
   return result;
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
       
       // Unterschrift-spezifische Eigenschaften
       if (fieldConfig.type === 'signature') {
           const signatureWidth = document.getElementById('signatureWidth');
           const signatureHeight = document.getElementById('signatureHeight');
           const signatureX = document.getElementById('signatureX');
           const signatureY = document.getElementById('signatureY');
           const signaturePage = document.getElementById('signaturePage');
           
           if (signatureWidth && signatureWidth.value) {
               fieldConfig.signature_width = parseInt(signatureWidth.value);
           }
           if (signatureHeight && signatureHeight.value) {
               fieldConfig.signature_height = parseInt(signatureHeight.value);
           }
           if (signatureX && signatureX.value !== '') {
               fieldConfig.signature_x = parseInt(signatureX.value);
           }
           if (signatureY && signatureY.value !== '') {
               fieldConfig.signature_y = parseInt(signatureY.value);
           }
           if (signaturePage && signaturePage.value) {
               fieldConfig.signature_page = parseInt(signaturePage.value);
           }
       } else {
           // Entferne Unterschrift-Eigenschaften wenn nicht signature Typ
           delete fieldConfig.signature_width;
           delete fieldConfig.signature_height;
           delete fieldConfig.signature_x;
           delete fieldConfig.signature_y;
           delete fieldConfig.signature_page;
       }
       
       // Optionen für Radio Button und Dropdown
       if (fieldConfig.type === 'radio' || fieldConfig.type === 'select') {
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
   
   // Gruppen in richtiger Reihenfolge
   window.groupsOrder.forEach(groupName => {
       if (window.currentConfig.groups[groupName]) {
           finalConfig.groups[groupName] = { ...window.currentConfig.groups[groupName] };
       }
   });
   
   // Felder mit Gruppenzuordnung und in der richtigen Reihenfolge
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
   
   // Füge übrige Felder hinzu
   Object.keys(window.currentConfig.fields).forEach(fieldName => {
       if (!finalConfig.fields[fieldName]) {
           const fieldConfig = { ...window.currentConfig.fields[fieldName] };
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

// NEUE FUNKTION: Feld zwischen Gruppen verschieben
function moveFieldToGroup(fieldName, targetGroupName) {
   console.log(`Verschiebe Feld "${fieldName}" zu Gruppe "${targetGroupName}"`);
   
   // Feld aus alter Gruppe entfernen
   Object.keys(window.fieldsOrder).forEach(groupName => {
       const oldLength = window.fieldsOrder[groupName].length;
       window.fieldsOrder[groupName] = window.fieldsOrder[groupName].filter(name => name !== fieldName);
       if (window.fieldsOrder[groupName].length !== oldLength) {
           console.log(`Feld aus Gruppe "${groupName}" entfernt`);
       }
   });
   
   // Feld zur neuen Gruppe hinzufügen
   if (!window.fieldsOrder[targetGroupName]) window.fieldsOrder[targetGroupName] = [];
   window.fieldsOrder[targetGroupName].push(fieldName);
   
   // Feld-Konfiguration aktualisieren
   if (!window.currentConfig.fields[fieldName]) {
       window.currentConfig.fields[fieldName] = {};
   }
   window.currentConfig.fields[fieldName].group = targetGroupName;
   
   console.log('Aktualisierte fieldsOrder:', window.fieldsOrder);
   renderGroups();
   renderFields();
   showConfigStatus(`Feld "${fieldName}" zu Gruppe "${targetGroupName}" verschoben`, 'success');
}

// NEUE FUNKTION: Feld aus Gruppe entfernen (zur Sonstige verschieben)
function removeFieldFromGroup(fieldName) {
   if (window.currentConfig.fields[fieldName] && window.currentConfig.fields[fieldName].group === 'Sonstige') {
       showConfigStatus('Feld ist bereits in der Gruppe "Sonstige"', 'error');
       return;
   }
   
   moveFieldToGroup(fieldName, 'Sonstige');
   showConfigStatus(`Feld "${fieldName}" aus Gruppe entfernt`, 'success');
}

function assignFieldToGroup(fieldName, groupName) {
   moveFieldToGroup(fieldName, groupName);
}