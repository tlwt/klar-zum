// js/form-generator.js
// Formular-Generierung und -Verwaltung - Erweitert mit Dropdown- und Unterschrift-Support

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
        
        // Unterschrift-Felder initialisieren
        initializeAllSignatureFields();
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
    const defaultOrder = ['Persönliche Daten', 'Kontaktdaten', 'Unternehmen', 'Zeiträume', 'Einverständnis', 'Unterschrift', 'Sonstige'];
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
    } else if (fieldName.toLowerCase().includes('unterschrift') || fieldName.toLowerCase().includes('signature')) {
        type = 'signature';
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
    
    // Spezielle Behandlung für Unterschrift
    if (type === 'signature') {
        return `
            <div class="form-group signature-field">
                <label>${title}${calculatedBadge}</label>
                ${description ? `<div class="field-description">${description}</div>` : ''}
                
                <div class="signature-mode-tabs">
                    <button type="button" class="signature-tab active" onclick="switchSignatureMode('draw', '${fieldName}')">✏️ Zeichnen</button>
                    <button type="button" class="signature-tab" onclick="switchSignatureMode('upload', '${fieldName}')">📁 Hochladen</button>
                </div>
                
                <div id="signature-draw-${fieldName}" class="signature-content active">
                    <div class="signature-preview">
                        <canvas id="signature-canvas-${fieldName}" class="signature-canvas" width="400" height="150"></canvas>
                    </div>
                    <div class="signature-controls">
                        <button type="button" onclick="clearSignature('${fieldName}')">🗑️ Löschen</button>
                        <button type="button" onclick="undoSignature('${fieldName}')">↶ Rückgängig</button>
                    </div>
                </div>
                
                <div id="signature-upload-${fieldName}" class="signature-content">
                    <div class="signature-preview" id="signature-preview-${fieldName}">
                        <div class="signature-placeholder">Klicken Sie hier oder ziehen Sie ein Bild hinein</div>
                    </div>
                    <div class="signature-controls">
                        <label for="signature-file-${fieldName}" style="margin: 0;">
                            <button type="button">📁 Datei auswählen</button>
                        </label>
                        <input type="file" id="signature-file-${fieldName}" accept="image/*" onchange="uploadSignature('${fieldName}', this)">
                        <button type="button" onclick="clearSignature('${fieldName}')">🗑️ Löschen</button>
                    </div>
                </div>
                
                <input type="hidden" id="${fieldName}" name="${fieldName}" value="" class="signature-data">
            </div>
        `;
    }
    
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

// Unterschrift-Verwaltung
function initializeAllSignatureFields() {
    document.querySelectorAll('.signature-field').forEach(field => {
        const hiddenInput = field.querySelector('.signature-data');
        if (hiddenInput) {
            const fieldId = hiddenInput.id;
            initializeSignature(fieldId);
        }
    });
}

function initializeSignature(fieldId) {
    if (!window.signatures) {
        window.signatures = new Map();
    }
    
    if (!window.signatures.has(fieldId)) {
        window.signatures.set(fieldId, new SignatureManager(fieldId));
    }
    
    // Drag & Drop für Upload-Bereich
    const preview = document.getElementById(`signature-preview-${fieldId}`);
    if (preview) {
        preview.addEventListener('dragover', (e) => {
            e.preventDefault();
            preview.style.borderColor = '#5a7c47';
            preview.style.backgroundColor = '#f0f8ff';
        });
        
        preview.addEventListener('dragleave', (e) => {
            e.preventDefault();
            preview.style.borderColor = '#ccc';
            preview.style.backgroundColor = 'white';
        });
        
        preview.addEventListener('drop', (e) => {
            e.preventDefault();
            preview.style.borderColor = '#ccc';
            preview.style.backgroundColor = 'white';
            
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                const input = document.getElementById(`signature-file-${fieldId}`);
                input.files = files;
                uploadSignature(fieldId, input);
            }
        });
        
        preview.addEventListener('click', () => {
            const activeMode = document.querySelector(`#signature-upload-${fieldId}.active`);
            if (activeMode) {
                document.getElementById(`signature-file-${fieldId}`).click();
            }
        });
    }
}

// Globale Unterschrift-Funktionen
window.switchSignatureMode = function(mode, fieldId) {
    // Tab-Aktivierung
    document.querySelectorAll(`#signature-draw-${fieldId}, #signature-upload-${fieldId}`).forEach(content => {
        content.classList.remove('active');
    });
    
    document.querySelectorAll(`[onclick*="switchSignatureMode"][onclick*="${fieldId}"]`).forEach(tab => {
        tab.classList.remove('active');
    });
    
    document.getElementById(`signature-${mode}-${fieldId}`).classList.add('active');
    event.target.classList.add('active');
};

window.clearSignature = function(fieldId) {
    // Canvas löschen
    if (window.signatures && window.signatures.has(fieldId)) {
        window.signatures.get(fieldId).clear();
    }
    
    // Upload-Preview löschen
    const preview = document.getElementById(`signature-preview-${fieldId}`);
    if (preview) {
        preview.innerHTML = '<div class="signature-placeholder">Klicken Sie hier oder ziehen Sie ein Bild hinein</div>';
        preview.classList.remove('has-signature');
    }
    
    // Hidden input löschen
    const hiddenInput = document.getElementById(fieldId);
    if (hiddenInput) {
        hiddenInput.value = '';
        hiddenInput.dispatchEvent(new Event('change'));
    }
};

window.undoSignature = function(fieldId) {
    if (window.signatures && window.signatures.has(fieldId)) {
        window.signatures.get(fieldId).undo();
    }
};

window.uploadSignature = function(fieldId, input) {
    const file = input.files[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
        alert('Bitte wählen Sie eine Bilddatei aus.');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const dataUrl = e.target.result;
        
        // Preview aktualisieren
        const preview = document.getElementById(`signature-preview-${fieldId}`);
        if (preview) {
            preview.innerHTML = `<img src="${dataUrl}" alt="Unterschrift">`;
            preview.classList.add('has-signature');
        }
        
        // Hidden input aktualisieren
        const hiddenInput = document.getElementById(fieldId);
        if (hiddenInput) {
            hiddenInput.value = dataUrl;
            hiddenInput.dispatchEvent(new Event('change'));
        }
        
        // Canvas aktualisieren (falls im Draw-Modus)
        if (window.signatures && window.signatures.has(fieldId)) {
            window.signatures.get(fieldId).setImageData(dataUrl);
        }
    };
    reader.readAsDataURL(file);
};

// SignatureManager Klasse
class SignatureManager {
    constructor(fieldId) {
        this.fieldId = fieldId;
        this.canvas = document.getElementById(`signature-canvas-${fieldId}`);
        this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
        this.isDrawing = false;
        this.paths = [];
        this.currentPath = [];
        
        if (this.canvas) {
            this.setupCanvas();
        }
    }
    
    setupCanvas() {
        const scale = window.devicePixelRatio || 1;
        
        this.canvas.width = 400 * scale;
        this.canvas.height = 150 * scale;
        this.canvas.style.width = '400px';
        this.canvas.style.height = '150px';
        
        this.ctx.scale(scale, scale);
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.ctx.strokeStyle = '#000';
        this.ctx.lineWidth = 2;
        
        // Event Listeners
        this.canvas.addEventListener('mousedown', (e) => this.startDrawing(e));
        this.canvas.addEventListener('mousemove', (e) => this.draw(e));
        this.canvas.addEventListener('mouseup', () => this.stopDrawing());
        this.canvas.addEventListener('mouseout', () => this.stopDrawing());
        
        // Touch Events
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const mouseEvent = new MouseEvent('mousedown', {
                clientX: touch.clientX,
                clientY: touch.clientY
            });
            this.canvas.dispatchEvent(mouseEvent);
        });
        
        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const mouseEvent = new MouseEvent('mousemove', {
                clientX: touch.clientX,
                clientY: touch.clientY
            });
            this.canvas.dispatchEvent(mouseEvent);
        });
        
        this.canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            const mouseEvent = new MouseEvent('mouseup', {});
            this.canvas.dispatchEvent(mouseEvent);
        });
    }
    
    getCanvasPosition(e) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }
    
    startDrawing(e) {
        this.isDrawing = true;
        const pos = this.getCanvasPosition(e);
        this.currentPath = [pos];
        this.ctx.beginPath();
        this.ctx.moveTo(pos.x, pos.y);
    }
    
    draw(e) {
        if (!this.isDrawing) return;
        
        const pos = this.getCanvasPosition(e);
        this.currentPath.push(pos);
        this.ctx.lineTo(pos.x, pos.y);
        this.ctx.stroke();
    }
    
    stopDrawing() {
        if (!this.isDrawing) return;
        this.isDrawing = false;
        
        if (this.currentPath.length > 1) {
            this.paths.push([...this.currentPath]);
            this.updateSignatureData();
        }
        this.currentPath = [];
    }
    
    clear() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.paths = [];
        this.updateSignatureData();
    }
    
    undo() {
        if (this.paths.length > 0) {
            this.paths.pop();
            this.redrawCanvas();
            this.updateSignatureData();
        }
    }
    
    redrawCanvas() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.paths.forEach(path => {
            if (path.length > 1) {
                this.ctx.beginPath();
                this.ctx.moveTo(path[0].x, path[0].y);
                for (let i = 1; i < path.length; i++) {
                    this.ctx.lineTo(path[i].x, path[i].y);
                }
                this.ctx.stroke();
            }
        });
    }
    
    updateSignatureData() {
        const dataUrl = this.canvas.toDataURL('image/png');
        const hiddenInput = document.getElementById(this.fieldId);
        if (hiddenInput) {
            hiddenInput.value = dataUrl;
            hiddenInput.dispatchEvent(new Event('change'));
        }
    }
    
    setImageData(dataUrl) {
        const img = new Image();
        img.onload = () => {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            
            // Bild proportional einpassen
            const canvasRatio = this.canvas.width / this.canvas.height;
            const imgRatio = img.width / img.height;
            
            let drawWidth, drawHeight, offsetX = 0, offsetY = 0;
            
            if (imgRatio > canvasRatio) {
                drawWidth = this.canvas.width;
                drawHeight = drawWidth / imgRatio;
                offsetY = (this.canvas.height - drawHeight) / 2;
            } else {
                drawHeight = this.canvas.height;
                drawWidth = drawHeight * imgRatio;
                offsetX = (this.canvas.width - drawWidth) / 2;
            }
            
            this.ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
            this.updateSignatureData();
        };
        img.src = dataUrl;
    }
}