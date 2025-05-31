// js/form-generator.js
// Formular-Generierung und -Verwaltung - Erweitert mit Dropdown-Support

function generateFormForSelectedPDFs() {
    const container = document.getElementById('formSections');
    container.innerHTML = '';
    window.calculatedFields.clear();
    
    console.log('=== DEBUGGING: generateFormForSelectedPDFs ===');
    console.log('Ausgewählte PDFs:', Array.from(window.selectedPDFs));
    console.log('Verfügbare PDF-Felder:', window.pdfFields);
    console.log('PDF-Konfigurationen:', window.pdfConfigs);
    
    if (window.selectedPDFs.size === 0) {
        console.log('FEHLER: Keine PDFs ausgewählt');
        container.innerHTML = '<div class="form-section"><h3>ℹ️ Keine PDFs ausgewählt</h3><p class="description">Bitte gehen Sie zurück und wählen Sie mindestens ein PDF aus.</p></div>';
        return;
    }
    
    const activeFields = new Set();
    const fieldMappings = new Map();
    const fieldCalculations = new Map();
    
    console.log('=== DEBUG: Feldanalyse ===');
    
    window.selectedPDFs.forEach(pdfName => {
        const fields = window.pdfFields.get(pdfName) || [];
        const pdfConfig = window.pdfConfigs.get(pdfName) || {};
        
        console.log(`\n--- PDF: ${pdfName} ---`);
        console.log(`Gefundene Felder (${fields.length}):`, fields);
        console.log(`Konfiguration:`, pdfConfig);
        console.log(`Hat Konfiguration:`, Object.keys(pdfConfig).length > 0);
        console.log(`Hat Feld-Konfiguration:`, !!(pdfConfig.fields && Object.keys(pdfConfig.fields).length > 0));
        
        if (fields.length === 0) {
            console.warn(`WARNUNG: PDF ${pdfName} hat keine Felder!`);
        }
        
        fields.forEach(field => {
            const fieldConf = pdfConfig.fields?.[field] || {};
            const hiddenForPDFs = fieldConf.hidden_for_pdfs || [];
            
            console.log(`  Feld: ${field}`);
            console.log(`    Konfiguration:`, fieldConf);
            console.log(`    Versteckt für PDFs:`, hiddenForPDFs);
            
            // Feld ist sichtbar, wenn:
            // 1. Keine Konfiguration vorhanden ist (dann alle Felder anzeigen)
            // 2. Konfiguration vorhanden ist UND Feld nicht für dieses PDF versteckt ist
            const shouldShowField = !pdfConfig.fields || 
                                   Object.keys(pdfConfig.fields).length === 0 || 
                                   !hiddenForPDFs.some(hiddenPdf => pdfName.includes(hiddenPdf));
            
            console.log(`    Soll angezeigt werden:`, shouldShowField);
            
            if (shouldShowField) {
                const mappedName = fieldConf.mapping || field;
                console.log(`    → Wird gemappt auf: ${mappedName}`);
                
                activeFields.add(mappedName);
                
                if (!fieldMappings.has(mappedName)) {
                    fieldMappings.set(mappedName, []);
                }
                fieldMappings.get(mappedName).push(field);
                
                // Berechnung speichern, falls vorhanden
                if (fieldConf.berechnung) {
                    fieldCalculations.set(mappedName, fieldConf.berechnung);
                    window.calculatedFields.add(mappedName);
                    console.log(`    → Hat Berechnung: ${fieldConf.berechnung}`);
                }
            } else {
                console.log(`    → Wird versteckt`);
            }
        });
    });
    
    console.log('\n=== ERGEBNIS ===');
    console.log('Aktive Felder:', Array.from(activeFields));
    console.log('Anzahl aktive Felder:', activeFields.size);
    console.log('Berechnete Felder:', Array.from(window.calculatedFields));
    
    window.currentFieldMappings = fieldMappings;
    window.currentFieldCalculations = fieldCalculations;
    
    if (activeFields.size === 0) {
        console.error('FEHLER: Keine aktiven Felder gefunden!');
        container.innerHTML = '<div class="form-section"><h3>⚠️ Keine Felder verfügbar</h3><p class="description">Debug: Keine Felder wurden aus den ausgewählten PDFs extrahiert. Prüfen Sie die Browser-Konsole für Details.</p></div>';
        return;
    }
    
    const groupedFields = organizeFieldsByGroups(activeFields);
    console.log('Gruppierte Felder:', groupedFields);
    
    let sectionsCreated = 0;
    for (const [groupName, fields] of Object.entries(groupedFields)) {
        if (fields.length === 0) continue;
        
        console.log(`Erstelle Sektion für Gruppe: ${groupName} mit ${fields.length} Feldern`);
        
        const section = document.createElement('div');
        section.className = 'form-section';
        
        const groupConfig = getGroupConfig(groupName);
        const groupTitle = groupConfig.title || groupName;
        const groupDescription = groupConfig.description || '';
        
        let sectionHTML = `
            <h3>${groupTitle}</h3>
            ${groupDescription ? `<div class="description">${groupDescription}</div>` : ''}
            <div class="form-grid">
        `;
        
        fields.forEach(fieldName => {
            console.log(`  → Generiere Feld: ${fieldName}`);
            sectionHTML += generateFormField(fieldName);
        });
        
        sectionHTML += '</div>';
        section.innerHTML = sectionHTML;
        container.appendChild(section);
        sectionsCreated++;
    }
    
    console.log(`Insgesamt ${sectionsCreated} Sektionen erstellt`);
    
    // Versteckte Daten anzeigen
    updateHiddenDataSection();
    
    // Event-Listener für Berechnungen hinzufügen
    setTimeout(() => {
        addCalculationEventListeners();
        calculateAllFields();
    }, 100);
    
    console.log('=== DEBUGGING ENDE ===\n');
}

function getGroupConfig(groupName) {
    // Suche in allen PDF-Konfigurationen nach Gruppenkonfiguration
    for (const [pdfName, config] of window.pdfConfigs.entries()) {
        if (window.selectedPDFs.has(pdfName) && config.groups && config.groups[groupName]) {
            return config.groups[groupName];
        }
    }
    return {};
}

function organizeFieldsByGroups(activeFields) {
    const grouped = {};
    const fieldsArray = Array.from(activeFields);
    
    // Sammle alle Gruppenkonfigurationen und deren Reihenfolge
    const allGroupConfigs = new Map();
    const groupOrders = new Map();
    
    window.selectedPDFs.forEach(pdfName => {
        const config = window.pdfConfigs.get(pdfName) || {};
        if (config.groups) {
            Object.keys(config.groups).forEach(groupName => {
                if (!allGroupConfigs.has(groupName)) {
                    allGroupConfigs.set(groupName, config.groups[groupName]);
                }
            });
            
            // Extrahiere Reihenfolge aus der YAML-Struktur (Reihenfolge der Schlüssel)
            const groupKeys = Object.keys(config.groups);
            groupOrders.set(pdfName, groupKeys);
        }
    });
    
    // Bestimme die finale Gruppen-Reihenfolge
    let finalGroupOrder = [];
    
    // Sammle alle verfügbaren Gruppenreihenfolgen
    const allOrders = Array.from(groupOrders.values());
    if (allOrders.length > 0) {
        // Verwende die erste verfügbare Reihenfolge als Basis
        finalGroupOrder = [...allOrders[0]];
        
        // Ergänze um Gruppen aus anderen Konfigurationen
        allOrders.forEach(order => {
            order.forEach(groupName => {
                if (!finalGroupOrder.includes(groupName)) {
                    finalGroupOrder.push(groupName);
                }
            });
        });
    }
    
    // Fallback auf Standard-Reihenfolge
    const defaultOrder = ['Persönliche Daten', 'Kontaktdaten', 'Unternehmen', 'Zeiträume', 'Einverständnis', 'Sonstige'];
    defaultOrder.forEach(groupName => {
        if (!finalGroupOrder.includes(groupName)) {
            finalGroupOrder.push(groupName);
        }
    });
    
    console.log('Finale Gruppen-Reihenfolge:', finalGroupOrder);
    
    // Felder den Gruppen zuordnen mit Berücksichtigung der Feld-Reihenfolge
    fieldsArray.forEach(fieldName => {
        let group = 'Sonstige';
        
        // Suche in allen ausgewählten PDF-Konfigurationen
        for (const [pdfName, config] of window.pdfConfigs.entries()) {
            if (window.selectedPDFs.has(pdfName) && config.fields && Object.keys(config.fields).length > 0) {
                // Direkte Suche nach Feldkonfiguration
                const directFieldConf = config.fields?.[fieldName];
                if (directFieldConf && directFieldConf.group) {
                    group = directFieldConf.group;
                    console.log(`Feld ${fieldName} → Gruppe: ${group} (direkt aus ${pdfName})`);
                    break;
                } else {
                    // Suche nach Original-Feld, das auf diesen Namen mappt
                    for (const [originalField, fieldConfig] of Object.entries(config.fields || {})) {
                        if (fieldConfig.mapping === fieldName && fieldConfig.group) {
                            group = fieldConfig.group;
                            console.log(`Feld ${fieldName} → Gruppe: ${group} (via mapping von ${originalField} aus ${pdfName})`);
                            break;
                        }
                    }
                }
                if (group !== 'Sonstige') break;
            }
        }
        
        if (!grouped[group]) {
            grouped[group] = [];
        }
        grouped[group].push(fieldName);
    });
    
    // Sortiere Felder innerhalb jeder Gruppe basierend auf Konfiguration
    Object.keys(grouped).forEach(groupName => {
        grouped[groupName] = sortFieldsInGroup(grouped[groupName], groupName);
    });
    
    // Erstelle das finale sortierte Objekt basierend auf der Gruppen-Reihenfolge
    const sortedGrouped = {};
    finalGroupOrder.forEach(groupName => {
        if (grouped[groupName] && grouped[groupName].length > 0) {
            sortedGrouped[groupName] = grouped[groupName];
        }
    });
    
    // Füge übrige Gruppen hinzu, die nicht in der Reihenfolge stehen
    Object.keys(grouped).forEach(groupName => {
        if (!sortedGrouped[groupName] && grouped[groupName].length > 0) {
            sortedGrouped[groupName] = grouped[groupName];
        }
    });
    
    return sortedGrouped;
}

function sortFieldsInGroup(fields, groupName) {
    console.log(`Sortiere Felder für Gruppe: ${groupName}, Felder:`, fields);
    
    // Sammle alle Feld-Reihenfolgen aus den YAML-extrahierten Ordnungen
    const fieldOrders = new Map();
    
    window.selectedPDFs.forEach(pdfName => {
        // Verwende die aus YAML extrahierte Reihenfolge
        if (window.yamlFieldOrders && window.yamlFieldOrders.has(pdfName)) {
            const yamlOrder = window.yamlFieldOrders.get(pdfName);
            if (yamlOrder[groupName]) {
                fieldOrders.set(pdfName, yamlOrder[groupName]);
                console.log(`YAML-Reihenfolge für ${pdfName}, Gruppe ${groupName}:`, yamlOrder[groupName]);
            }
        } else {
            // Fallback: Verwende die Reihenfolge aus der Konfiguration (unzuverlässig)
            const config = window.pdfConfigs.get(pdfName) || {};
            if (config.fields) {
                const groupFields = [];
                
                Object.keys(config.fields).forEach(fieldName => {
                    const fieldConfig = config.fields[fieldName];
                    if (fieldConfig.group === groupName) {
                        groupFields.push(fieldName);
                    }
                    // Auch gemappte Felder berücksichtigen
                    if (fieldConfig.mapping && fields.includes(fieldConfig.mapping) && fieldConfig.group === groupName) {
                        if (!groupFields.includes(fieldConfig.mapping)) {
                            groupFields.push(fieldConfig.mapping);
                        }
                    }
                });
                
                if (groupFields.length > 0) {
                    fieldOrders.set(pdfName + '_fallback', groupFields);
                    console.log(`Fallback-Reihenfolge für ${pdfName}, Gruppe ${groupName}:`, groupFields);
                }
            }
        }
    });
    
    console.log(`Feld-Reihenfolgen für Gruppe ${groupName}:`, Array.from(fieldOrders.entries()));
    
    // Bestimme die finale Feld-Reihenfolge
    let finalFieldOrder = [];
    
    // Verwende die erste verfügbare Reihenfolge als Basis
    const allFieldOrders = Array.from(fieldOrders.values());
    if (allFieldOrders.length > 0) {
        // Bevorzuge YAML-basierte Reihenfolgen vor Fallback-Reihenfolgen
        const yamlOrders = Array.from(fieldOrders.entries()).filter(([key, _]) => !key.includes('_fallback'));
        if (yamlOrders.length > 0) {
            finalFieldOrder = [...yamlOrders[0][1]];
            console.log(`Verwende YAML-basierte Reihenfolge von ${yamlOrders[0][0]}`);
        } else {
            finalFieldOrder = [...allFieldOrders[0]];
            console.log(`Verwende Fallback-Reihenfolge`);
        }
        
        // Ergänze um Felder aus anderen Konfigurationen
        allFieldOrders.forEach(order => {
            order.forEach(fieldName => {
                if (fields.includes(fieldName) && !finalFieldOrder.includes(fieldName)) {
                    finalFieldOrder.push(fieldName);
                }
            });
        });
    }
    
    // Füge übrige Felder hinzu, die nicht in der Reihenfolge stehen
    fields.forEach(fieldName => {
        if (!finalFieldOrder.includes(fieldName)) {
            finalFieldOrder.push(fieldName);
        }
    });
    
    // Entferne Felder, die nicht in der aktuellen Feldliste stehen
    finalFieldOrder = finalFieldOrder.filter(fieldName => fields.includes(fieldName));
    
    console.log(`Finale Feld-Reihenfolge für Gruppe ${groupName}:`, finalFieldOrder);
    
    return finalFieldOrder;
}

function generateFormField(fieldName) {
    let title = fieldName;
    let description = '';
    let type = 'text';
    let options = [];
    let isCalculated = window.calculatedFields.has(fieldName);
    
    // Automatische Typerkennung basierend auf Feldname
    if (fieldName.toLowerCase().includes('datum') || fieldName.toLowerCase().includes('date')) {
        type = 'date';
    } else if (fieldName.toLowerCase().includes('email') || fieldName.toLowerCase().includes('mail')) {
        type = 'email';
    } else if (fieldName.toLowerCase().includes('telefon') || fieldName.toLowerCase().includes('phone')) {
        type = 'tel';
    }
    
    // Suche in allen ausgewählten PDF-Konfigurationen für erweiterte Konfiguration
    for (const [pdfName, config] of window.pdfConfigs.entries()) {
        if (window.selectedPDFs.has(pdfName) && config.fields && Object.keys(config.fields).length > 0) {
            // Direkte Suche nach Feldkonfiguration
            const directFieldConf = config.fields?.[fieldName];
            if (directFieldConf) {
                title = directFieldConf.title || fieldName;
                description = directFieldConf.description || '';
                type = directFieldConf.type || type; // Verwende erkannten Typ als Fallback
                options = directFieldConf.options || [];
                break;
            } else {
                // Suche nach Original-Feld, das auf diesen Namen mappt
                for (const [originalField, fieldConfig] of Object.entries(config.fields || {})) {
                    if (fieldConfig.mapping === fieldName) {
                        title = fieldConfig.title || fieldName;
                        description = fieldConfig.description || '';
                        type = fieldConfig.type || type; // Verwende erkannten Typ als Fallback
                        options = fieldConfig.options || [];
                        break;
                    }
                }
            }
            if (title !== fieldName || description || options.length > 0) break;
        }
    }
    
    const calculatedClass = isCalculated ? 'calculated-field' : '';
    const calculatedBadge = isCalculated ? '<span class="calculated-badge">🧮 Berechnet</span>' : '';
    const readonlyAttr = isCalculated ? 'readonly' : '';
    
    // Spezielle Behandlung für Checkboxen
    if (type === 'checkbox') {
        return `
            <div class="form-group">
                <div style="display: flex; align-items: flex-start; gap: 12px;">
                    <input type="checkbox" id="${fieldName}" name="${fieldName}" value="1" style="margin-top: 4px; transform: scale(1.2);">
                    <div style="flex: 1;">
                        <label for="${fieldName}" style="margin-bottom: 0; cursor: pointer; font-weight: 600; color: #555;">${title}${calculatedBadge}</label>
                        ${description ? `<div class="field-description" style="margin-top: 4px;">${description}</div>` : ''}
                    </div>
                </div>
            </div>
        `;
    }
    
    // Spezielle Behandlung für Radio Buttons
    if (type === 'radio' && options.length > 0) {
        let radioHTML = `
            <div class="form-group">
                <label>${title}${calculatedBadge}</label>
                ${description ? `<div class="field-description">${description}</div>` : ''}
                <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 8px;">
        `;
        
        options.forEach((option, index) => {
            const isFirst = index === 0;
            radioHTML += `
                <div style="display: flex; align-items: center; gap: 8px;">
                    <input type="radio" id="${fieldName}_${index}" name="${fieldName}" value="${option}" 
                           ${isFirst ? 'checked' : ''} style="transform: scale(1.2);">
                    <label for="${fieldName}_${index}" style="margin: 0; cursor: pointer;">${option}</label>
                </div>
            `;
        });
        
        radioHTML += `
                </div>
            </div>
        `;
        return radioHTML;
    }
    
    // Spezielle Behandlung für Dropdown/Select
    if (type === 'select' && options.length > 0) {
        let selectHTML = `
            <div class="form-group">
                <label for="${fieldName}">${title}${calculatedBadge}</label>
                ${description ? `<div class="field-description">${description}</div>` : ''}
                <select id="${fieldName}" name="${fieldName}" class="${calculatedClass}" ${readonlyAttr}>
        `;
        
        options.forEach((option, index) => {
            const isFirst = index === 0;
            selectHTML += `<option value="${option}" ${isFirst ? 'selected' : ''}>${option}</option>`;
        });
        
        selectHTML += `
                </select>
            </div>
        `;
        return selectHTML;
    }
    
    // Standard-Felder (text, email, tel, date, number)
    return `
        <div class="form-group">
            <label for="${fieldName}">${title}${calculatedBadge}</label>
            ${description ? `<div class="field-description">${description}</div>` : ''}
            <input type="${type}" id="${fieldName}" name="${fieldName}" class="${calculatedClass}" ${readonlyAttr}>
        </div>
    `;
}