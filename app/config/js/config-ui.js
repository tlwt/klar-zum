// config/js/config-ui.js
// Erweiterte UI Management für Config Editor mit Unterschrift-Positionierung und Feldverschiebung

function populatePDFSelector() {
    const selector = document.getElementById('pdfSelector');
    window.availablePDFs.forEach(pdf => {
        const option = document.createElement('option');
        option.value = pdf.name;
        option.textContent = `${pdf.name} (${pdf.fields.length} Felder)`;
        selector.appendChild(option);
    });
}

async function loadPDFConfig() {
    const selector = document.getElementById('pdfSelector');
    const selectedPDF = selector.value;
    
    if (!selectedPDF) {
        document.getElementById('configEditor').style.display = 'none';
        return;
    }
    
    console.log('Lade PDF Konfiguration für:', selectedPDF);
    
    window.currentPDF = window.availablePDFs.find(pdf => pdf.name === selectedPDF);
    if (!window.currentPDF) {
        console.error('PDF nicht gefunden:', selectedPDF);
        return;
    }
    
    await loadExistingConfig(selectedPDF);
    
    document.getElementById('configEditor').style.display = 'grid';
    
    document.getElementById('groupProperties').classList.remove('active');
    document.getElementById('fieldProperties').classList.remove('active');
    
    initializeEditor();
}

function initializeEditor() {
    console.log('Initialisiere Editor...');
    
    buildGroupsOrder();
    buildFieldsOrder();
    renderGroups();
    renderFields();
    initializeSortable();
    
    console.log('Editor erfolgreich initialisiert');
}

function renderGroups() {
    const container = document.getElementById('groupsList');
    container.innerHTML = '';
    
    window.groupsOrder.forEach(groupName => {
        const fieldCount = window.fieldsOrder[groupName] ? window.fieldsOrder[groupName].length : 0;
        
        const div = document.createElement('div');
        div.className = 'group-item';
        div.dataset.groupName = groupName;
        div.innerHTML = `
            <span class="drag-handle">⋮⋮</span>
            <span class="group-name">${groupName}</span>
            <span class="group-count">${fieldCount}</span>
        `;
        div.onclick = () => selectGroup(groupName);
        container.appendChild(div);
    });
}

function renderFields() {
    const container = document.getElementById('fieldsList');
    const unassignedContainer = document.getElementById('unassignedFieldsList');
    const unassignedSection = document.getElementById('unassignedFields');
    
    container.innerHTML = '';
    unassignedContainer.innerHTML = '';
    
    if (!window.currentGroup) {
        container.innerHTML = '<div style="text-align: center; color: #666; padding: 20px;">Gruppe auswählen</div>';
        unassignedSection.style.display = 'none';
        return;
    }
    
    const fields = window.fieldsOrder[window.currentGroup] || [];
    
    fields.forEach(fieldName => {
        const fieldConfig = window.currentConfig.fields[fieldName] || {};
        
        const div = document.createElement('div');
        div.className = 'field-item';
        div.dataset.fieldName = fieldName;
        
        let badges = '';
        if (fieldConfig.type && fieldConfig.type !== 'text') {
            let typeDisplay = fieldConfig.type;
            if (fieldConfig.type === 'signature') {
                typeDisplay = '✍️ Unterschrift';
            }
            badges += `<span class="field-type field-type-${fieldConfig.type}">${typeDisplay}</span>`;
        }
        if (fieldConfig.mapping) {
            badges += `<span class="field-mapped">→ ${fieldConfig.mapping}</span>`;
        }
        if (fieldConfig.hidden_for_pdfs && fieldConfig.hidden_for_pdfs.length > 0) {
            badges += `<span class="field-hidden">versteckt</span>`;
        }
        if (fieldConfig.virtual_field) {
            badges += `<span class="field-virtual">virtuell</span>`;
        }
        
        // Kontextmenü für Feldoperationen
        const contextMenu = `
            <div class="field-actions">
                <button onclick="selectField('${fieldName}')" class="action-btn action-edit" title="Bearbeiten">✏️</button>
                <button onclick="showMoveFieldDialog('${fieldName}')" class="action-btn action-move" title="Verschieben">📋</button>
                ${fieldConfig.virtual_field ? 
                    `<button onclick="removeVirtualField('${fieldName}')" class="action-btn action-delete" title="Löschen">🗑️</button>` : 
                    `<button onclick="removeFieldFromGroup('${fieldName}')" class="action-btn action-remove" title="Aus Gruppe entfernen">➖</button>`
                }
            </div>
        `;
        
        div.innerHTML = `
            <span class="drag-handle">⋮⋮</span>
            <span class="field-name">${fieldName}</span>
            ${badges}
            ${contextMenu}
        `;
        
        div.onclick = (e) => {
            if (!e.target.closest('.field-actions')) {
                selectField(fieldName);
            }
        };
        container.appendChild(div);
    });
    
    // Add Virtual Field Button
    const addVirtualDiv = document.createElement('div');
    addVirtualDiv.className = 'add-virtual-field';
    addVirtualDiv.innerHTML = `
        <button onclick="addVirtualField('${window.currentGroup}')" class="add-virtual-btn">
            ➕ Virtuelles Feld hinzufügen
        </button>
    `;
    container.appendChild(addVirtualDiv);
    
    // Nicht zugewiesene Felder (nur anzeigen wenn nicht in 'Sonstige' Gruppe)
    if (window.currentGroup !== 'Sonstige') {
        const unassignedFields = window.currentPDF.fields.filter(fieldName => {
            const fieldConfig = window.currentConfig.fields[fieldName] || {};
            const isUnassigned = !fieldConfig.group || fieldConfig.group === 'Sonstige';
            return isUnassigned;
        });
        
        if (unassignedFields.length > 0) {
            unassignedFields.forEach(fieldName => {
                const div = document.createElement('div');
                div.className = 'field-item unassigned-field';
                div.dataset.fieldName = fieldName;
                div.innerHTML = `
                    <span class="field-name">${fieldName}</span>
                    <button onclick="assignFieldToGroup('${fieldName}', '${window.currentGroup}')" 
                            class="action-btn action-add" title="Zur Gruppe hinzufügen">
                        ➕
                    </button>
                `;
                unassignedContainer.appendChild(div);
            });
            unassignedSection.style.display = 'block';
        } else {
            unassignedSection.style.display = 'none';
        }
    } else {
        unassignedSection.style.display = 'none';
    }
}

function selectGroup(groupName) {
    window.currentGroup = groupName;
    window.currentField = null;
    
    // Aktiven Zustand setzen
    document.querySelectorAll('.group-item').forEach(item => {
        item.classList.remove('active');
    });
    document.querySelector(`[data-group-name="${groupName}"]`).classList.add('active');
    
    renderFields();
    showGroupProperties(groupName);
    
    document.getElementById('selectedGroupName').textContent = `(${groupName})`;
}

function selectField(fieldName) {
    window.currentField = fieldName;
    
    // Aktiven Zustand setzen
    document.querySelectorAll('.field-item').forEach(item => {
        item.classList.remove('active');
    });
    document.querySelector(`[data-field-name="${fieldName}"]`).classList.add('active');
    
    showFieldProperties(fieldName);
}

function showGroupProperties(groupName) {
    document.getElementById('groupProperties').classList.add('active');
    document.getElementById('fieldProperties').classList.remove('active');
    
    const groupConfig = window.currentConfig.groups[groupName] || {};
    document.getElementById('groupTitle').value = groupConfig.title || '';
    document.getElementById('groupDescription').value = groupConfig.description || '';
}

function showFieldProperties(fieldName) {
    document.getElementById('fieldProperties').classList.add('active');
    document.getElementById('groupProperties').classList.remove('active');
    
    const fieldConfig = window.currentConfig.fields[fieldName] || {};
    document.getElementById('fieldTitle').value = fieldConfig.title || '';
    document.getElementById('fieldDescription').value = fieldConfig.description || '';
    document.getElementById('fieldType').value = fieldConfig.type || 'text';
    document.getElementById('fieldMapping').value = fieldConfig.mapping || '';
    document.getElementById('fieldCalculation').value = fieldConfig.berechnung || '';
    document.getElementById('fieldHidden').checked = (fieldConfig.hidden_for_pdfs && fieldConfig.hidden_for_pdfs.length > 0) || false;
    
    // Unterschrift-spezifische Felder
    const signatureWidth = document.getElementById('signatureWidth');
    const signatureHeight = document.getElementById('signatureHeight');
    const signatureX = document.getElementById('signatureX');
    const signatureY = document.getElementById('signatureY');
    const signaturePage = document.getElementById('signaturePage');
    
    console.log('🔍 DEBUG: Loading signature properties for field:', fieldName);
    console.log('🔍 DEBUG: Field config signature values:', {
        signature_width: fieldConfig.signature_width,
        signature_height: fieldConfig.signature_height,
        signature_x: fieldConfig.signature_x,
        signature_y: fieldConfig.signature_y,
        signature_page: fieldConfig.signature_page
    });
    
    if (signatureWidth) {
        signatureWidth.value = fieldConfig.signature_width || '200';
        console.log('🔍 DEBUG: Set signatureWidth to:', signatureWidth.value);
    }
    if (signatureHeight) {
        signatureHeight.value = fieldConfig.signature_height || '100';
        console.log('🔍 DEBUG: Set signatureHeight to:', signatureHeight.value);
    }
    if (signatureX) {
        signatureX.value = fieldConfig.signature_x || '50';
        console.log('🔍 DEBUG: Set signatureX to:', signatureX.value);
    }
    if (signatureY) {
        signatureY.value = fieldConfig.signature_y || '100';
        console.log('🔍 DEBUG: Set signatureY to:', signatureY.value);
    }
    if (signaturePage) {
        signaturePage.value = fieldConfig.signature_page || '1';
        console.log('🔍 DEBUG: Set signaturePage to:', signaturePage.value);
    }
    
    // Optionen anzeigen/verstecken und Hilfetexte aktualisieren
    const fieldType = fieldConfig.type || 'text';
    toggleOptionsField(fieldType);
    toggleSignatureFields(fieldType);
    
    if ((fieldType === 'radio' || fieldType === 'select') && fieldConfig.options) {
        document.getElementById('fieldOptions').value = fieldConfig.options.join('\n');
    } else {
        document.getElementById('fieldOptions').value = '';
    }
}

function toggleOptionsField(fieldType) {
    const optionsField = document.getElementById('fieldOptions');
    const optionsHelp = document.getElementById('optionsHelp');
    const optionsLabel = document.querySelector('label[for="fieldOptions"]');
    
    if (fieldType === 'radio' || fieldType === 'select') {
        optionsField.style.display = 'block';
        optionsHelp.style.display = 'block';
        
        if (fieldType === 'radio') {
            optionsLabel.textContent = 'Radio Button Optionen:';
            optionsHelp.textContent = 'Jede Option in einer neuen Zeile. Die erste Option wird als Standard ausgewählt.';
        } else if (fieldType === 'select') {
            optionsLabel.textContent = 'Dropdown Optionen:';
            optionsHelp.textContent = 'Jede Option in einer neuen Zeile. Die erste Option wird als Standard ausgewählt.';
        }
    } else {
        optionsField.style.display = 'none';
        optionsHelp.style.display = 'none';
        optionsLabel.textContent = 'Optionen:';
    }
}

function toggleSignatureFields(fieldType) {
    const signatureFields = document.getElementById('signatureFields');
    if (signatureFields) {
        if (fieldType === 'signature') {
            signatureFields.style.display = 'block';
        } else {
            signatureFields.style.display = 'none';
        }
    }
}

// NEUE FUNKTION: Dialog zum Verschieben von Feldern
function showMoveFieldDialog(fieldName) {
    const availableGroups = window.groupsOrder.filter(group => group !== window.currentGroup);
    
    if (availableGroups.length === 0) {
        showConfigStatus('Keine anderen Gruppen verfügbar', 'error');
        return;
    }
    
    const groupOptions = availableGroups.map(group => 
        `<option value="${group}">${group}</option>`
    ).join('');
    
    const dialog = document.createElement('div');
    dialog.className = 'move-field-dialog';
    dialog.innerHTML = `
        <div class="dialog-overlay" onclick="closeMoveFieldDialog()">
            <div class="dialog-content" onclick="event.stopPropagation()">
                <h3>Feld verschieben</h3>
                <p>Feld "<strong>${fieldName}</strong>" verschieben von "<strong>${window.currentGroup}</strong>" zu:</p>
                <select id="targetGroupSelect" class="dialog-select">
                    ${groupOptions}
                </select>
                <div class="dialog-buttons">
                    <button onclick="executeMoveField('${fieldName}')" class="btn btn-primary">Verschieben</button>
                    <button onclick="closeMoveFieldDialog()" class="btn btn-secondary">Abbrechen</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(dialog);
}

function executeMoveField(fieldName) {
    const targetGroup = document.getElementById('targetGroupSelect').value;
    if (targetGroup) {
        moveFieldToGroup(fieldName, targetGroup);
        closeMoveFieldDialog();
        
        // Zur Zielgruppe wechseln
        selectGroup(targetGroup);
        selectField(fieldName);
    }
}

function closeMoveFieldDialog() {
    const dialog = document.querySelector('.move-field-dialog');
    if (dialog) {
        dialog.remove();
    }
}

function addVirtualField(groupName) {
    const fieldName = prompt('Name des virtuellen Feldes:');
    if (!fieldName || fieldName.trim() === '') return;
    
    const trimmedName = fieldName.trim();
    
    if (window.currentConfig.fields[trimmedName]) {
        alert('Ein Feld mit diesem Namen existiert bereits!');
        return;
    }
    
    window.currentConfig.fields[trimmedName] = {
        group: groupName,
        virtual_field: true,
        type: 'text',
        title: trimmedName
    };
    
    if (!window.fieldsOrder[groupName]) {
        window.fieldsOrder[groupName] = [];
    }
    window.fieldsOrder[groupName].push(trimmedName);
    
    renderGroups();
    renderFields();
    selectField(trimmedName);
    showConfigStatus('Virtuelles Feld erstellt: ' + trimmedName, 'success');
}

function removeVirtualField(fieldName) {
    if (!confirm(`Virtuelles Feld "${fieldName}" wirklich löschen?`)) {
        return;
    }
    
    delete window.currentConfig.fields[fieldName];
    
    Object.keys(window.fieldsOrder).forEach(groupName => {
        window.fieldsOrder[groupName] = window.fieldsOrder[groupName].filter(name => name !== fieldName);
    });
    
    window.currentField = null;
    renderGroups();
    renderFields();
    document.getElementById('fieldProperties').classList.remove('active');
    
    showConfigStatus('Virtuelles Feld gelöscht: ' + fieldName, 'success');
}

function initializeSortable() {
    // Sortable für Gruppen
    new Sortable(document.getElementById('groupsList'), {
        animation: 150,
        ghostClass: 'sortable-ghost',
        chosenClass: 'sortable-chosen',
        onEnd: function(evt) {
            const newOrder = Array.from(evt.to.children)
                .map(el => el.dataset.groupName)
                .filter(name => name && name !== 'undefined');
            window.groupsOrder = newOrder;
            saveCurrentProperties();
        }
    });
    
    // Sortable für Felder
    new Sortable(document.getElementById('fieldsList'), {
        animation: 150,
        ghostClass: 'sortable-ghost',
        chosenClass: 'sortable-chosen',
        filter: '.add-virtual-field',
        onEnd: function(evt) {
            if (window.currentGroup) {
                const newOrder = Array.from(evt.to.children)
                    .map(el => el.dataset.fieldName)
                    .filter(name => name && name !== 'undefined');
                window.fieldsOrder[window.currentGroup] = newOrder;
                saveCurrentProperties();
            }
        }
    });
}

function addNewGroup() {
    const groupName = prompt('Name der neuen Gruppe:');
    if (!groupName || groupName.trim() === '') return;
    
    const trimmedName = groupName.trim();
    if (window.groupsOrder.includes(trimmedName)) {
        alert('Eine Gruppe mit diesem Namen existiert bereits!');
        return;
    }
    
    window.currentConfig.groups[trimmedName] = {
        title: trimmedName,
        description: ''
    };
    window.groupsOrder.push(trimmedName);
    window.fieldsOrder[trimmedName] = [];
    
    renderGroups();
    selectGroup(trimmedName);
    showConfigStatus('Neue Gruppe erstellt: ' + trimmedName, 'success');
}

function deleteGroup() {
    if (!window.currentGroup) return;
    
    if (window.currentGroup === 'Sonstige') {
        alert('Die Gruppe "Sonstige" kann nicht gelöscht werden!');
        return;
    }
    
    if (!confirm(`Gruppe "${window.currentGroup}" wirklich löschen?\n\nAlle Felder werden zur Gruppe "Sonstige" verschoben.`)) {
        return;
    }
    
    const fieldsToMove = window.fieldsOrder[window.currentGroup] || [];
    fieldsToMove.forEach(fieldName => {
        if (window.currentConfig.fields[fieldName]) {
            window.currentConfig.fields[fieldName].group = 'Sonstige';
        }
    });
    
    if (!window.fieldsOrder['Sonstige']) window.fieldsOrder['Sonstige'] = [];
    window.fieldsOrder['Sonstige'].push(...fieldsToMove);
    
    delete window.currentConfig.groups[window.currentGroup];
    delete window.fieldsOrder[window.currentGroup];
    window.groupsOrder = window.groupsOrder.filter(name => name !== window.currentGroup);
    
    window.currentGroup = null;
    window.currentField = null;
    
    renderGroups();
    renderFields();
    document.getElementById('groupProperties').classList.remove('active');
    document.getElementById('fieldProperties').classList.remove('active');
    
    showConfigStatus('Gruppe gelöscht', 'success');
}

function saveAndDownloadConfig() {
    if (!window.currentPDF) {
        showConfigStatus('Kein PDF ausgewählt!', 'error');
        return;
    }
    
    const config = buildFinalConfig();
    const yamlString = jsyaml.dump(config, {
        indent: 2,
        lineWidth: -1,
        noRefs: true,
        sortKeys: false
    });
    
    const blob = new Blob([yamlString], { type: 'text/yaml' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = window.currentPDF.name.replace('.pdf', '.yaml');
    link.click();
    
    console.log('Generierte Konfiguration:', config);
    
    showConfigStatus('YAML-Konfiguration wurde heruntergeladen!', 'success');
}

function previewConfig() {
    if (!window.currentPDF) {
        showConfigStatus('Kein PDF ausgewählt!', 'error');
        return;
    }
    
    const config = buildFinalConfig();
    const yamlString = jsyaml.dump(config, {
        indent: 2,
        lineWidth: -1,
        noRefs: true,
        sortKeys: false
    });
    
    const previewWindow = window.open('', '_blank', 'width=800,height=600');
    previewWindow.document.write(`
        <html>
        <head>
            <title>Konfiguration Vorschau - ${window.currentPDF.name}</title>
            <style>
                body { font-family: monospace; margin: 20px; background: #f5f5f5; }
                pre { background: white; padding: 20px; border-radius: 8px; border: 1px solid #ddd; overflow: auto; }
                h1 { color: #333; }
            </style>
        </head>
        <body>
            <h1>Konfiguration für ${window.currentPDF.name}</h1>
            <pre>${yamlString}</pre>
        </body>
        </html>
    `);
}

function showConfigStatus(message, type = 'success') {
    const status = document.getElementById('status');
    status.textContent = message;
    status.className = `status ${type}`;
    status.style.display = 'block';
    
    setTimeout(() => {
        status.style.display = 'none';
    }, 5000);
}

// Event-Listener für Eigenschaften-Änderungen
document.addEventListener('DOMContentLoaded', function() {
    // Gruppen-Eigenschaften
    const groupTitle = document.getElementById('groupTitle');
    const groupDescription = document.getElementById('groupDescription');
    
    if (groupTitle) groupTitle.addEventListener('input', saveCurrentProperties);
    if (groupDescription) groupDescription.addEventListener('input', saveCurrentProperties);
    
    // Feld-Eigenschaften
    const fieldTitle = document.getElementById('fieldTitle');
    const fieldDescription = document.getElementById('fieldDescription');
    const fieldType = document.getElementById('fieldType');
    const fieldMapping = document.getElementById('fieldMapping');
    const fieldCalculation = document.getElementById('fieldCalculation');
    const fieldOptions = document.getElementById('fieldOptions');
    const fieldHidden = document.getElementById('fieldHidden');
    
    if (fieldTitle) fieldTitle.addEventListener('input', saveCurrentProperties);
    if (fieldDescription) fieldDescription.addEventListener('input', saveCurrentProperties);
    if (fieldType) fieldType.addEventListener('change', function() {
        toggleOptionsField(this.value);
        toggleSignatureFields(this.value);
        saveCurrentProperties();
    });
    if (fieldMapping) fieldMapping.addEventListener('input', saveCurrentProperties);
    if (fieldCalculation) fieldCalculation.addEventListener('input', saveCurrentProperties);
    if (fieldOptions) fieldOptions.addEventListener('input', saveCurrentProperties);
    if (fieldHidden) fieldHidden.addEventListener('change', saveCurrentProperties);
    
    // Unterschrift-spezifische Event-Listener
    const signatureWidth = document.getElementById('signatureWidth');
    const signatureHeight = document.getElementById('signatureHeight');
    const signatureX = document.getElementById('signatureX');
    const signatureY = document.getElementById('signatureY');
    const signaturePage = document.getElementById('signaturePage');
    
    if (signatureWidth) signatureWidth.addEventListener('input', saveCurrentProperties);
    if (signatureHeight) signatureHeight.addEventListener('input', saveCurrentProperties);
    if (signatureX) signatureX.addEventListener('input', saveCurrentProperties);
    if (signatureY) signatureY.addEventListener('input', saveCurrentProperties);
    if (signaturePage) signaturePage.addEventListener('input', saveCurrentProperties);
});