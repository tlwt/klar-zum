// Data Editor JavaScript
// Editor für gespeicherte JSON-Datensätze

// Global state
let currentDataset = {};
let originalFilename = '';
let isEditing = false;

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    console.log('📊 Data Editor initialized');
    
    // Check if there's a dataset passed via URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('loadSample')) {
        createSampleDataset();
    }
});

// Load data file
function loadDataFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    if (!file.name.endsWith('.json')) {
        showStatus('Bitte wählen Sie eine JSON-Datei aus.', 'error');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            loadDataset(data, file.name);
            showStatus(`Datensatz "${file.name}" erfolgreich geladen!`, 'success');
        } catch (error) {
            console.error('Fehler beim Laden der JSON-Datei:', error);
            showStatus('Fehler beim Laden der JSON-Datei: ' + error.message, 'error');
        }
    };
    reader.readAsText(file);
}

// Load dataset into editor
function loadDataset(data, filename = 'unbekannt.json') {
    currentDataset = {};
    originalFilename = filename;
    
    // Extract form data if it's a reservist-digital export
    let formData = {};
    if (data.formData) {
        formData = data.formData;
        console.log('📊 Reservist-Digital Export erkannt, verwende formData');
    } else {
        formData = data;
        console.log('📊 Generische JSON-Datei erkannt');
    }
    
    // Copy all fields to current dataset
    Object.keys(formData).forEach(key => {
        currentDataset[key] = formData[key];
    });
    
    // Update file info
    updateFileInfo(filename, Object.keys(currentDataset).length, data.timestamp);
    
    // Render fields
    renderFields();
    
    // Show editor section
    document.getElementById('editorSection').style.display = 'block';
    
    console.log(`📊 Dataset loaded: ${Object.keys(currentDataset).length} fields`);
}

// Update file info display
function updateFileInfo(filename, fieldCount, timestamp) {
    document.getElementById('fileName').textContent = filename;
    document.getElementById('fieldCount').textContent = fieldCount;
    document.getElementById('timestamp').textContent = timestamp || 'Unbekannt';
    document.getElementById('fileInfo').style.display = 'block';
}

// Create new dataset
function createNewDataset() {
    currentDataset = {};
    originalFilename = 'neuer-datensatz.json';
    
    updateFileInfo('Neuer Datensatz', 0, new Date().toISOString());
    renderFields();
    document.getElementById('editorSection').style.display = 'block';
    
    showStatus('Neuer Datensatz erstellt. Fügen Sie Felder hinzu!', 'success');
}

// Create sample dataset for testing
function createSampleDataset() {
    const sampleData = {
        'Nachname': 'Mustermann',
        'Vorname': 'Max',
        'Email': 'max.mustermann@example.com',
        'Telefon': '+49 123 456789',
        'Datum': '2025-06-13',
        'Adresse': 'Musterstraße 123\n12345 Musterstadt',
        'Aktiv': '1',
        'Notizen': 'Dies ist ein Beispiel-Datensatz zum Testen des Editors.'
    };
    
    loadDataset(sampleData, 'beispiel-datensatz.json');
    showStatus('Beispiel-Datensatz geladen zum Testen!', 'success');
}

// Render all fields
function renderFields() {
    const container = document.getElementById('fieldsList');
    container.innerHTML = '';
    
    if (Object.keys(currentDataset).length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <h3>📝 Keine Felder vorhanden</h3>
                <p>Fügen Sie neue Felder hinzu oder laden Sie einen bestehenden Datensatz.</p>
            </div>
        `;
        return;
    }
    
    // Sort fields alphabetically
    const sortedKeys = Object.keys(currentDataset).sort((a, b) => 
        a.toLowerCase().localeCompare(b.toLowerCase())
    );
    
    sortedKeys.forEach(fieldName => {
        renderField(fieldName, currentDataset[fieldName]);
    });
    
    // Update field count
    document.getElementById('fieldCount').textContent = Object.keys(currentDataset).length;
}

// Render single field
function renderField(fieldName, fieldValue) {
    const container = document.getElementById('fieldsList');
    const fieldItem = document.createElement('div');
    fieldItem.className = 'field-item';
    fieldItem.setAttribute('data-field', fieldName);
    
    const isSignature = fieldValue && typeof fieldValue === 'string' && fieldValue.startsWith('data:image/');
    const isLongText = fieldValue && typeof fieldValue === 'string' && (fieldValue.length > 100 || fieldValue.includes('\n'));
    
    fieldItem.innerHTML = `
        <div class="field-name" title="${fieldName}">${fieldName}</div>
        <div class="field-value ${isSignature ? 'signature-field' : ''}" id="value-${fieldName}">
            ${renderFieldValue(fieldValue, fieldName, isSignature, isLongText)}
        </div>
        <div class="field-actions">
            <button class="btn-edit" onclick="editField('${fieldName}')" title="Bearbeiten">✏️</button>
            <button class="btn-delete" onclick="deleteField('${fieldName}')" title="Löschen">🗑️</button>
        </div>
    `;
    
    container.appendChild(fieldItem);
}

// Render field value based on type
function renderFieldValue(value, fieldName, isSignature, isLongText) {
    if (isSignature) {
        return `<span title="Unterschrift Base64 Daten">🖊️ Unterschrift (${value.length} Zeichen)</span>`;
    } else if (isLongText) {
        return `<span title="${value}">${value.substring(0, 100)}${value.length > 100 ? '...' : ''}</span>`;
    } else {
        return `<span title="${value}">${value || '<leer>'}</span>`;
    }
}

// Edit field
function editField(fieldName) {
    const valueContainer = document.getElementById(`value-${fieldName}`);
    const currentValue = currentDataset[fieldName] || '';
    const isSignature = currentValue && typeof currentValue === 'string' && currentValue.startsWith('data:image/');
    const isLongText = currentValue && typeof currentValue === 'string' && (currentValue.length > 100 || currentValue.includes('\n'));
    
    if (isSignature) {
        // Open signature editor modal
        openSignatureEditor(fieldName, currentValue);
        return;
    }
    
    // Create edit interface
    const inputElement = isLongText ? 
        `<textarea id="edit-input-${fieldName}" rows="3">${currentValue}</textarea>` :
        `<input type="text" id="edit-input-${fieldName}" value="${currentValue}">`;
    
    valueContainer.innerHTML = `
        ${inputElement}
        <div style="margin-top: 0.5rem;">
            <button class="btn-save" onclick="saveField('${fieldName}')">💾</button>
            <button class="btn-cancel" onclick="cancelEdit('${fieldName}')">❌</button>
        </div>
    `;
    
    // Focus input
    document.getElementById(`edit-input-${fieldName}`).focus();
    
    // Add enter key handler for single-line inputs
    if (!isLongText) {
        document.getElementById(`edit-input-${fieldName}`).addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                saveField(fieldName);
            } else if (e.key === 'Escape') {
                cancelEdit(fieldName);
            }
        });
    }
}

// Save field edit
function saveField(fieldName) {
    const input = document.getElementById(`edit-input-${fieldName}`);
    const newValue = input.value;
    
    currentDataset[fieldName] = newValue;
    renderFields();
    showStatus(`Feld "${fieldName}" gespeichert`, 'success');
}

// Cancel field edit
function cancelEdit(fieldName) {
    renderFields();
}

// Delete field
function deleteField(fieldName) {
    if (confirm(`Feld "${fieldName}" wirklich löschen?`)) {
        delete currentDataset[fieldName];
        renderFields();
        showStatus(`Feld "${fieldName}" gelöscht`, 'success');
    }
}

// Show add field modal
function addNewField() {
    document.getElementById('newFieldName').value = '';
    document.getElementById('newFieldValue').value = '';
    document.getElementById('newFieldType').value = 'text';
    document.getElementById('addFieldModal').style.display = 'flex';
    document.getElementById('newFieldName').focus();
}

// Close add field modal
function closeAddFieldModal() {
    document.getElementById('addFieldModal').style.display = 'none';
}

// Add field
function addField() {
    const fieldName = document.getElementById('newFieldName').value.trim();
    const fieldValue = document.getElementById('newFieldValue').value;
    const fieldType = document.getElementById('newFieldType').value;
    
    if (!fieldName) {
        showStatus('Bitte geben Sie einen Feldnamen ein.', 'error');
        return;
    }
    
    if (currentDataset.hasOwnProperty(fieldName)) {
        if (!confirm(`Feld "${fieldName}" existiert bereits. Überschreiben?`)) {
            return;
        }
    }
    
    // Process value based on type
    let processedValue = fieldValue;
    if (fieldType === 'checkbox') {
        processedValue = fieldValue.toLowerCase() === 'true' || fieldValue === '1' ? '1' : '';
    } else if (fieldType === 'number') {
        processedValue = fieldValue ? parseFloat(fieldValue).toString() : '';
    } else if (fieldType === 'date') {
        // Validate date format
        if (fieldValue && !isValidDate(fieldValue)) {
            showStatus('Ungültiges Datumsformat. Verwenden Sie YYYY-MM-DD.', 'error');
            return;
        }
    }
    
    currentDataset[fieldName] = processedValue;
    renderFields();
    closeAddFieldModal();
    showStatus(`Feld "${fieldName}" hinzugefügt`, 'success');
}

// Validate date format
function isValidDate(dateString) {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(dateString)) return false;
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date);
}

// Sort fields alphabetically
function sortFields() {
    renderFields();
    showStatus('Felder alphabetisch sortiert', 'success');
}

// Filter fields
function filterFields() {
    const searchTerm = document.getElementById('searchField').value.toLowerCase();
    const fieldItems = document.querySelectorAll('.field-item');
    
    fieldItems.forEach(item => {
        const fieldName = item.getAttribute('data-field').toLowerCase();
        const fieldValue = currentDataset[item.getAttribute('data-field')] || '';
        const valueText = fieldValue.toString().toLowerCase();
        
        if (fieldName.includes(searchTerm) || valueText.includes(searchTerm)) {
            item.style.display = 'grid';
        } else {
            item.style.display = 'none';
        }
    });
}

// Save dataset
function saveDataset() {
    if (Object.keys(currentDataset).length === 0) {
        showStatus('Keine Felder zum Speichern vorhanden.', 'error');
        return;
    }
    
    const filename = prompt('Dateiname für den Datensatz:', originalFilename || 'datensatz.json');
    if (!filename) return;
    
    // Create export data in reservist-digital format
    const exportData = {
        formData: currentDataset,
        timestamp: new Date().toISOString(),
        fieldCount: Object.keys(currentDataset).length,
        editor: 'data-editor'
    };
    
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    // Use FileSaver.js
    saveAs(dataBlob, filename.endsWith('.json') ? filename : filename + '.json');
    
    showStatus(`Datensatz als "${filename}" gespeichert!`, 'success');
}


// Show status message
function showStatus(message, type = 'info') {
    const statusBar = document.getElementById('status');
    statusBar.textContent = message;
    statusBar.className = `status-bar show ${type}`;
    
    // Auto hide after 3 seconds
    setTimeout(() => {
        statusBar.classList.remove('show');
    }, 3000);
    
    console.log(`📊 Status [${type}]: ${message}`);
}

// Modal event handlers
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        closeAddFieldModal();
        closeSignatureModal();
    }
});

// Add field modal enter key handler
document.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && document.getElementById('addFieldModal').style.display === 'flex') {
        const activeElement = document.activeElement;
        if (activeElement.id === 'newFieldName' || activeElement.id === 'newFieldValue') {
            addField();
        }
    }
});

// Signature functionality
let currentSignatureField = '';
let signatureManager = null;

// Open signature editor
function openSignatureEditor(fieldName, currentValue) {
    currentSignatureField = fieldName;
    document.getElementById('signatureModal').style.display = 'flex';
    
    // Initialize signature manager
    setTimeout(() => {
        if (!signatureManager) {
            signatureManager = new SignatureManager();
        }
        
        // Load current signature if exists
        if (currentValue && currentValue.startsWith('data:image/')) {
            signatureManager.setImageData(currentValue);
            
            // Also show in upload preview
            const preview = document.getElementById('signature-preview');
            preview.innerHTML = `<img src="${currentValue}" alt="Unterschrift">`;
            preview.classList.add('has-signature');
        }
    }, 100);
}

// Close signature modal
function closeSignatureModal() {
    document.getElementById('signatureModal').style.display = 'none';
    currentSignatureField = '';
}

// Switch signature mode
function switchSignatureMode(mode) {
    // Update tabs
    document.querySelectorAll('.signature-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelector(`[onclick="switchSignatureMode('${mode}')"]`).classList.add('active');
    
    // Update content
    document.querySelectorAll('.signature-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`signature-${mode}`).classList.add('active');
    
    // Handle click on upload area
    if (mode === 'upload') {
        const preview = document.getElementById('signature-preview');
        preview.onclick = function() {
            document.getElementById('signature-file').click();
        };
    }
}

// Clear signature
function clearSignature() {
    if (signatureManager) {
        signatureManager.clear();
    }
    
    const preview = document.getElementById('signature-preview');
    if (preview) {
        preview.innerHTML = '<div class="signature-placeholder">Klicken Sie hier oder ziehen Sie ein Bild hinein</div>';
        preview.classList.remove('has-signature');
    }
}

// Undo signature
function undoSignature() {
    if (signatureManager) {
        signatureManager.undo();
    }
}

// Upload signature
function uploadSignature(input) {
    const file = input.files[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
        showStatus('Bitte wählen Sie eine Bilddatei aus.', 'error');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const preview = document.getElementById('signature-preview');
        if (preview) {
            preview.innerHTML = `<img src="${e.target.result}" alt="Unterschrift">`;
            preview.classList.add('has-signature');
        }
        
        if (signatureManager) {
            signatureManager.setImageData(e.target.result);
        }
    };
    reader.readAsDataURL(file);
}

// Save signature
function saveSignature() {
    let signatureData = '';
    
    // Get signature data from active mode
    const activeContent = document.querySelector('.signature-content.active');
    if (activeContent.id === 'signature-draw' && signatureManager) {
        signatureData = signatureManager.getImageData();
    } else if (activeContent.id === 'signature-upload') {
        const img = document.querySelector('#signature-preview img');
        if (img) {
            signatureData = img.src;
        }
    }
    
    if (signatureData && currentSignatureField) {
        currentDataset[currentSignatureField] = signatureData;
        renderFields();
        showStatus(`Unterschrift für "${currentSignatureField}" gespeichert`, 'success');
    }
    
    closeSignatureModal();
}

// Signature Manager Class
class SignatureManager {
    constructor() {
        this.canvas = document.getElementById('signature-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.isDrawing = false;
        this.strokes = [];
        this.currentStroke = [];
        
        this.setupCanvas();
        this.setupEventListeners();
    }
    
    setupCanvas() {
        // Set up canvas for high DPI displays
        const rect = this.canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        
        this.ctx.scale(dpr, dpr);
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.ctx.strokeStyle = '#2c3e50';
        this.ctx.lineWidth = 2;
        
        // Set canvas style
        this.canvas.style.width = rect.width + 'px';
        this.canvas.style.height = rect.height + 'px';
    }
    
    setupEventListeners() {
        // Mouse events
        this.canvas.addEventListener('mousedown', (e) => this.startDrawing(e));
        this.canvas.addEventListener('mousemove', (e) => this.draw(e));
        this.canvas.addEventListener('mouseup', () => this.stopDrawing());
        this.canvas.addEventListener('mouseout', () => this.stopDrawing());
        
        // Touch events
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.startDrawing(e.touches[0]);
        });
        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            this.draw(e.touches[0]);
        });
        this.canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.stopDrawing();
        });
    }
    
    getCoordinates(e) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left) * (this.canvas.width / rect.width),
            y: (e.clientY - rect.top) * (this.canvas.height / rect.height)
        };
    }
    
    startDrawing(e) {
        this.isDrawing = true;
        this.currentStroke = [];
        const coords = this.getCoordinates(e);
        this.currentStroke.push(coords);
        
        this.ctx.beginPath();
        this.ctx.moveTo(coords.x, coords.y);
    }
    
    draw(e) {
        if (!this.isDrawing) return;
        
        const coords = this.getCoordinates(e);
        this.currentStroke.push(coords);
        
        this.ctx.lineTo(coords.x, coords.y);
        this.ctx.stroke();
    }
    
    stopDrawing() {
        if (!this.isDrawing) return;
        
        this.isDrawing = false;
        if (this.currentStroke.length > 0) {
            this.strokes.push([...this.currentStroke]);
            this.currentStroke = [];
        }
    }
    
    clear() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.strokes = [];
        this.currentStroke = [];
    }
    
    undo() {
        if (this.strokes.length === 0) return;
        
        this.strokes.pop();
        this.redraw();
    }
    
    redraw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.strokes.forEach(stroke => {
            if (stroke.length === 0) return;
            
            this.ctx.beginPath();
            this.ctx.moveTo(stroke[0].x, stroke[0].y);
            
            for (let i = 1; i < stroke.length; i++) {
                this.ctx.lineTo(stroke[i].x, stroke[i].y);
            }
            
            this.ctx.stroke();
        });
    }
    
    getImageData() {
        return this.canvas.toDataURL('image/png');
    }
    
    setImageData(dataUrl) {
        const img = new Image();
        img.onload = () => {
            this.clear();
            this.ctx.drawImage(img, 0, 0, this.canvas.width, this.canvas.height);
        };
        img.src = dataUrl;
    }
}

console.log('📊 Data Editor JavaScript loaded');