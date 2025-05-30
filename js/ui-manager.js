// js/ui-manager.js
// UI-Verwaltung und Navigation

function switchTab(tabName) {
    // Formularwerte temporär speichern
    const currentFormData = getAllFormData();
    
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    document.querySelector(`#${tabName}`).classList.add('active');
    
    if (tabName === 'pdf-selection') {
        document.querySelector('.tab:first-child').classList.add('active');
    } else if (tabName === 'form-fields') {
        document.querySelector('.tab:nth-child(2)').classList.add('active');
        if (window.selectedPDFs.size > 0) {
            generateFormForSelectedPDFs();
            // Formularwerte wiederherstellen
            setTimeout(() => {
                restoreFormData(currentFormData);
                calculateAllFields();
            }, 100);
        }
    } else if (tabName === 'settings') {
        document.querySelector('.tab:nth-child(3)').classList.add('active');
        loadSettingsToForm();
    }
}

function goToFormFields() {
    console.log('=== goToFormFields() aufgerufen ===');
    console.log('Ausgewählte PDFs:', Array.from(window.selectedPDFs));
    console.log('window.selectedPDFs.size:', window.selectedPDFs.size);
    
    if (window.selectedPDFs.size === 0) {
        console.error('FEHLER: Keine PDFs ausgewählt beim Wechsel zu Formularfeldern');
        alert('Bitte wählen Sie zuerst ein PDF aus!');
        return;
    }
    
    console.log('Rufe generateFormForSelectedPDFs() auf...');
    generateFormForSelectedPDFs();
    console.log('generateFormForSelectedPDFs() beendet');
    
    console.log('Wechsle zu Tab form-fields...');
    switchTab('form-fields');
    console.log('Tab-Wechsel abgeschlossen');
}

function generatePDFSelection() {
    const container = document.getElementById('pdfSelection');
    container.innerHTML = '';
    
    window.availablePDFs.forEach((pdf, index) => {
        const fieldsPreview = generateFieldsPreview(pdf.fields);
        const configStatus = pdf.hasConfig ? 
            '<div class="config-status config-found">✅ Konfiguration gefunden</div>' :
            '<div class="config-status config-missing">⚠️ Keine Konfiguration</div>';
        
        const div = document.createElement('div');
        div.className = 'pdf-checkbox';
        div.innerHTML = `
            <input type="checkbox" id="pdf_${index}" value="${pdf.name}" onchange="onPDFSelectionChange()">
            <div class="pdf-info">
                <h4>${pdf.name}</h4>
                <div class="pdf-path">${pdf.path}</div>
                ${configStatus}
                <div class="fields-preview">
                    <div class="fields-short">Felder (${pdf.fields.length}): ${fieldsPreview.short}</div>
                    <div class="fields-full">Felder (${pdf.fields.length}): ${fieldsPreview.full}</div>
                    ${pdf.fields.length > 3 ? `<div class="fields-toggle" onclick="toggleFields(this)">Alle anzeigen</div>` : ''}
                </div>
            </div>
        `;
        container.appendChild(div);
    });
}

function generateFieldsPreview(fields) {
    const short = fields.slice(0, 3).join(', ') + (fields.length > 3 ? '...' : '');
    const full = fields.join(', ');
    return { short, full };
}

function toggleFields(element) {
    const parent = element.closest('.fields-preview');
    const shortDiv = parent.querySelector('.fields-short');
    const fullDiv = parent.querySelector('.fields-full');
    
    if (shortDiv.style.display === 'none') {
        shortDiv.style.display = 'block';
        fullDiv.style.display = 'none';
        element.textContent = 'Alle anzeigen';
    } else {
        shortDiv.style.display = 'none';
        fullDiv.style.display = 'block';
        element.textContent = 'Weniger anzeigen';
    }
}

function onPDFSelectionChange() {
    console.log('=== onPDFSelectionChange() aufgerufen ===');
    
    window.selectedPDFs.clear();
    const checkedBoxes = document.querySelectorAll('input[type="checkbox"]:checked');
    console.log('Gefundene aktivierte Checkboxen:', checkedBoxes.length);
    
    checkedBoxes.forEach(checkbox => {
        console.log('Aktivierte Checkbox:', checkbox.value);
        window.selectedPDFs.add(checkbox.value);
        checkbox.closest('.pdf-checkbox').classList.add('selected');
    });
    
    document.querySelectorAll('input[type="checkbox"]:not(:checked)').forEach(checkbox => {
        checkbox.closest('.pdf-checkbox').classList.remove('selected');
    });
    
    console.log('Neue Auswahl - selectedPDFs:', Array.from(window.selectedPDFs));
    console.log('selectedPDFs.size:', window.selectedPDFs.size);
    
    updateSelectionSummary();
    updateNextButton();
    
    console.log('onPDFSelectionChange() beendet');
}

function updateSelectionSummary() {
    const summaryDiv = document.getElementById('selectionSummary');
    const listDiv = document.getElementById('selectedPDFsList');
    
    if (window.selectedPDFs.size === 0) {
        summaryDiv.style.display = 'none';
    } else {
        const pdfList = Array.from(window.selectedPDFs).map(pdfName => `<li>${pdfName}</li>`).join('');
        listDiv.innerHTML = `<ul>${pdfList}</ul>`;
        summaryDiv.style.display = 'block';
    }
}

function updateNextButton() {
    const nextButton = document.getElementById('nextButton');
    const formFieldsTab = document.getElementById('formFieldsTab');
    
    if (window.selectedPDFs.size > 0) {
        nextButton.disabled = false;
        formFieldsTab.disabled = false;
    } else {
        nextButton.disabled = true;
        formFieldsTab.disabled = true;
    }
}

function showError() {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('errorMessage').style.display = 'block';
}

function showStatus(message, type = 'success') {
    const status = document.getElementById('status');
    status.textContent = message;
    status.className = `status ${type}`;
    status.style.display = 'block';
    
    setTimeout(() => {
        status.style.display = 'none';
    }, 5000);
}

function saveSettings() {
    window.appSettings.fileNamePattern = document.getElementById('fileNamePattern').value;
    window.appSettings.emailAddress = document.getElementById('emailAddress').value;
    window.appSettings.emailSubject = document.getElementById('emailSubject').value;
    window.appSettings.emailBody = document.getElementById('emailBody').value;
    
    showStatus('Einstellungen gespeichert!');
}

function loadSettingsToForm() {
    document.getElementById('fileNamePattern').value = window.appSettings.fileNamePattern;
    document.getElementById('emailAddress').value = window.appSettings.emailAddress;
    document.getElementById('emailSubject').value = window.appSettings.emailSubject;
    document.getElementById('emailBody').value = window.appSettings.emailBody;
}

function resetSettings() {
    window.appSettings = {
        fileNamePattern: '[Nachname], [Vorname] - [PDF] - [Datum]',
        emailAddress: '',
        emailSubject: 'Formularunterlagen - [Nachname], [Vorname]',
        emailBody: 'Sehr geehrte Damen und Herren,\n\nanbei übersende ich Ihnen die ausgefüllten Formularunterlagen.\n\nMit freundlichen Grüßen'
    };
    loadSettingsToForm();
    showStatus('Einstellungen zurückgesetzt!');
}

function openEmailDraft() {
    const data = getAllFormData();
    
    let subject = window.appSettings.emailSubject;
    let body = window.appSettings.emailBody;
    
    Object.keys(data).forEach(fieldName => {
        const regex = new RegExp(`\\[${fieldName}\\]`, 'g');
        subject = subject.replace(regex, data[fieldName] || '');
    });
    
    const today = new Date().toISOString().split('T')[0];
    subject = subject.replace(/\[Datum\]/g, today);
    
    const mailtoLink = `mailto:${window.appSettings.emailAddress}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailtoLink;
}