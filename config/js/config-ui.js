// config/js/config-ui.js
// UI Management für Config Editor

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
    
    window.currentPDF = window.availablePDFs.find(pdf => pdf.name === selectedPDF);
    if (!window.currentPDF) return;
    
    // Versuche existierende Konfiguration zu laden
    await loadExistingConfig(selectedPDF);
    
    // Editor anzeigen und initialisieren
    document.getElementById('configEditor').style.display = 'grid';
    initializeEditor();
}

function initializeEditor() {
    buildGroupsOrder();
    buildFieldsOrder();
    renderGroups();
    renderFields();
    initializeSortable();
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
            badges += `<span class="field-type">${fieldConfig.type}</span>`;
        }
        if (fieldConfig.mapping) {
            badges += `<span class="field-mapped">→ ${fieldConfig.mapping}</span>`;
        }
        if (fieldConfig.hidden_for_pdfs && fieldConfig.hidden_for_pdfs.length > 0) {
            badges += `<span class="field-hidden">versteckt</span>`;
        }
        
        div.innerHTML = `
            <span class="drag-handle">⋮⋮</span>
            <span class="field-name">${fieldName}</span>
            ${badges}
        `;
        div.onclick = () => selectField(fieldName);
        container.appendChild(div);
    });
    
    // Nicht zugewiesene Felder (nur anzeigen wenn nicht in 'Sonstige' Gruppe)
    if (window.currentGroup !== 'Sonstige') {
        const unassignedFields = window.currentPDF.fields.filter(fieldName => {
            const fieldConfig = window.currentConfig.fields[fieldName] || {};
            return !fieldConfig.group || fieldConfig.group === 'Sonstige';
        });
        
        if (unassignedFields.length > 0) {
            unassignedFields.forEach(fieldName => {
                const div = document.createElement('div');
                div.className = 'field-item';
                div.dataset.fieldName = fieldName;
                div.innerHTML = `
                    <span class="field-name">${fieldName}</span>
                    <button onclick="assignFieldToGroup('${fieldName}', '${window.currentGroup}')" 
                            style="padding: 2px 6px; font-size: 0.8em; background: #28a745; color: white; border: none; border-radius: 3px;">
                        ➕ Hinzufügen
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
    
    // Felder für diese Gruppe anzeigen
    renderFields();
    
    // Properties Panel aktualisieren
    showGroupProperties(groupName);
    
    // Gruppenname im Felder-Panel anzeigen
    document.getElementById('selectedGroupName').textContent = `(${groupName})`;
}

function selectField(fieldName) {
    window.currentField = fieldName;
    
    // Aktiven Zustand setzen
    document.querySelectorAll('.field-item').forEach(item => {
        item.classList.remove('active');
    });
    document.querySelector(`[data-field-name="${fieldName}"]`).classList.add('active');
    
    // Properties Panel aktualisieren
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
    
    // Radio Button Optionen anzeigen/verstecken
    const fieldType = fieldConfig.type || 'text';
    toggleRadioOptions(fieldType);
    
    if (fieldType === 'radio' && fieldConfig.options) {
        document.getElementById('fieldOptions').value = fieldConfig.options.join('\n');
    } else {
        document.getElementById('fieldOptions').value = '';
    }
}

function toggleRadioOptions(fieldType) {
    const optionsField = document.getElementById('fieldOptions');
    const optionsHelp = document.getElementById('radioOptionsHelp');
    
    if (fieldType === 'radio') {
        optionsField.style.display = 'block';
        optionsHelp.style.display = 'block';
    } else {
        optionsField.style.display = 'none';
        optionsHelp.style.display = 'none';
    }
}

function initializeSortable() {
    // Sortable für Gruppen
    new Sortable(document.getElementById('groupsList'), {
        animation: 150,
        ghostClass: 'sortable-ghost',
        chosenClass: 'sortable-chosen',
        onEnd: function(evt) {
            const newOrder = Array.from(evt.to.children).map(el => el.dataset.groupName);
            window.groupsOrder = newOrder;
            saveCurrentProperties();
        }
    });
    
    // Sortable für Felder
    new Sortable(document.getElementById('fieldsList'), {
        animation: 150,
        ghostClass: 'sortable-ghost',
        chosenClass: 'sortable-chosen',
        onEnd: function(evt) {
            if (window.currentGroup) {
                const newOrder = Array.from(evt.to.children).map(el => el.dataset.fieldName);
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
    
    // Neue Gruppe hinzufügen
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
    
    // Felder zur 'Sonstige' Gruppe verschieben
    const fieldsToMove = window.fieldsOrder[window.currentGroup] || [];
    fieldsToMove.forEach(fieldName => {
        if (window.currentConfig.fields[fieldName]) {
            window.currentConfig.fields[fieldName].group = 'Sonstige';
        }
    });
    
    if (!window.fieldsOrder['Sonstige']) window.fieldsOrder['Sonstige'] = [];
    window.fieldsOrder['Sonstige'].push(...fieldsToMove);
    
    // Gruppe löschen
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
    
    // YAML-Datei herunterladen
    const blob = new Blob([yamlString], { type: 'text/yaml' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = window.currentPDF.name.replace('.pdf', '.yaml');
    link.click();
    
    // Auch in Konsole ausgeben für Debugging
    console.log('Generierte Konfiguration:', config);
    console.log('YAML:', yamlString);
    
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
        toggleRadioOptions(this.value);
        saveCurrentProperties();
    });
    if (fieldMapping) fieldMapping.addEventListener('input', saveCurrentProperties);
    if (fieldCalculation) fieldCalculation.addEventListener('input', saveCurrentProperties);
    if (fieldOptions) fieldOptions.addEventListener('input', saveCurrentProperties);
    if (fieldHidden) fieldHidden.addEventListener('change', saveCurrentProperties);
});