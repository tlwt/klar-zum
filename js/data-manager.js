// js/data-manager.js
// Datenverwaltung und Import/Export

function getAllFormData() {
    const formData = {};
    
    // Reguläre Formularfelder (sichtbare Felder haben Vorrang)
    const form = document.getElementById('dataForm');
    if (form) {
        const formDataObj = new FormData(form);
        for (let [key, value] of formDataObj.entries()) {
            formData[key] = value;
        }
        
        // Checkboxen separat behandeln
        form.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
            formData[checkbox.name] = checkbox.checked ? checkbox.value : '';
        });
        
        // Radio Buttons separat behandeln
        form.querySelectorAll('input[type="radio"]:checked').forEach(radio => {
            formData[radio.name] = radio.value;
        });
        
        // Select-Felder separat behandeln
        form.querySelectorAll('select').forEach(select => {
            formData[select.name] = select.value;
        });
        
        // Alle Input-Felder direkt auslesen (für den Fall, dass FormData nicht alles erfasst)
        form.querySelectorAll('input, textarea, select').forEach(input => {
            if (input.name || input.id) {
                const fieldName = input.name || input.id;
                if (input.type === 'checkbox') {
                    formData[fieldName] = input.checked ? input.value : '';
                } else if (input.type === 'radio') {
                    if (input.checked) {
                        formData[fieldName] = input.value;
                    }
                } else {
                    formData[fieldName] = input.value;
                }
            }
        });
    }
    
    // Versteckte Felder aus dem separaten Bereich
    const hiddenFields = document.getElementById('hiddenDataFields');
    if (hiddenFields) {
        hiddenFields.querySelectorAll('input, textarea, select').forEach(input => {
            const fieldName = input.name || input.id.replace('hidden_', '');
            if (input.type === 'checkbox') {
                formData[fieldName] = input.checked ? input.value : '';
            } else if (input.type === 'radio') {
                if (input.checked) {
                    formData[fieldName] = input.value;
                }
            } else {
                formData[fieldName] = input.value;
            }
        });
    }
    
    // Versteckte Daten aus hiddenData hinzufügen (nur wenn nicht bereits über Formular erfasst)
    Object.keys(window.hiddenData).forEach(key => {
        if (!formData.hasOwnProperty(key)) {
            formData[key] = window.hiddenData[key];
        }
    });
    
    console.log('Gesammelte Formulardaten:', formData);
    return formData;
}

function getFormData() {
    return getAllFormData();
}

function restoreFormData(data) {
    Object.keys(data).forEach(key => {
        // Suche nach regulären Feldern
        const element = document.getElementById(key);
        if (element) {
            if (element.type === 'checkbox') {
                element.checked = data[key] === '1' || data[key] === 'true' || data[key] === true;
            } else if (element.type === 'radio') {
                element.checked = element.value === data[key];
            } else {
                element.value = data[key];
            }
        } else {
            // Suche nach Radio Button Gruppen
            const radioButtons = document.querySelectorAll(`input[type="radio"][name="${key}"]`);
            if (radioButtons.length > 0) {
                radioButtons.forEach(radio => {
                    radio.checked = radio.value === data[key];
                });
            }
        }
    });
}

function updateHiddenDataSection() {
    const hiddenDataSection = document.getElementById('hiddenDataSection');
    const hiddenDataFields = document.getElementById('hiddenDataFields');
    const hiddenDataCount = document.getElementById('hiddenDataCount');
    
    if (Object.keys(window.hiddenData).length === 0) {
        hiddenDataSection.style.display = 'none';
        return;
    }
    
    hiddenDataFields.innerHTML = '';
    let count = 0;
    
    console.log('Versteckte Daten:', window.hiddenData);
    
    Object.keys(window.hiddenData).forEach(key => {
        // Prüfe ob das Feld bereits im sichtbaren Formular existiert
        const visibleElement = document.getElementById(key);
        if (visibleElement) {
            console.log(`Feld ${key} ist bereits sichtbar - nicht als versteckt anzeigen`);
            return; // Überspringe sichtbare Felder
        }
        
        const value = window.hiddenData[key];
        const div = document.createElement('div');
        div.className = 'form-group';
        div.innerHTML = `
            <label for="hidden_${key}">${key} <span class="hidden-badge">📦 Versteckt</span></label>
            <input type="text" id="hidden_${key}" name="${key}" value="${value}" class="hidden-field">
        `;
        hiddenDataFields.appendChild(div);
        count++;
    });
    
    hiddenDataCount.textContent = count;
    
    if (count > 0) {
        hiddenDataSection.style.display = 'block';
    } else {
        hiddenDataSection.style.display = 'none';
    }
}

function toggleHiddenData() {
    const content = document.getElementById('hiddenDataContent');
    const toggleText = document.getElementById('hiddenDataToggleText');
    
    if (content.style.display === 'none' || !content.style.display) {
        content.style.display = 'block';
        toggleText.textContent = 'Verbergen';
    } else {
        content.style.display = 'none';
        toggleText.textContent = 'Anzeigen';
    }
}

function getAllData() {
    const formData = getAllFormData();
    return {
        formData: formData,
        hiddenData: window.hiddenData,
        settings: window.appSettings,
        selectedPDFs: Array.from(window.selectedPDFs),
        timestamp: new Date().toISOString()
    };
}

function saveData() {
    const allData = getAllData();
    const dataStr = JSON.stringify(allData, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    
    const data = getAllFormData();
    let fileName = window.appSettings.fileNamePattern;
    const today = new Date().toISOString().split('T')[0];
    
    fileName = fileName.replace(/\[PDF\]/g, 'Daten');
    fileName = fileName.replace(/\[Datum\]/g, today);
    
    Object.keys(data).forEach(fieldName => {
        const regex = new RegExp(`\\[${fieldName}\\]`, 'g');
        fileName = fileName.replace(regex, data[fieldName] || '');
    });
    
    fileName = fileName.replace(/[^a-zA-Z0-9äöüÄÖÜß\s,.-]/g, '_');
    fileName = fileName.replace(/\s+/g, ' ').trim();
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = fileName + '.json';
    link.click();
    
    showStatus('Daten erfolgreich gespeichert!');
}

function loadData(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            
            // Versteckte Daten zurücksetzen
            window.hiddenData = {};
            
            // Versteckte Daten aus dem Datensatz laden
            if (data.hiddenData) {
                window.hiddenData = { ...data.hiddenData };
            }
            
            const formData = data.formData || data;
            
            // Sammle alle sichtbaren Feldnamen aus dem aktuellen Formular
            const visibleFieldNames = new Set();
            document.querySelectorAll('#dataForm input, #dataForm textarea, #dataForm select').forEach(element => {
                if (element.name || element.id) {
                    visibleFieldNames.add(element.name || element.id);
                }
            });
            
            console.log('Sichtbare Felder:', Array.from(visibleFieldNames));
            
            // Nur Daten in hiddenData speichern, die NICHT in sichtbaren Feldern vorkommen
            Object.keys(formData).forEach(key => {
                if (!visibleFieldNames.has(key)) {
                    window.hiddenData[key] = formData[key];
                    console.log(`Feld ${key} als versteckt markiert`);
                } else {
                    console.log(`Feld ${key} ist sichtbar - nicht in hiddenData`);
                }
            });
            
            // Formularfelder setzen (nur sichtbare Felder)
            for (const [key, value] of Object.entries(formData)) {
                // Reguläre Felder
                const element = document.getElementById(key);
                if (element) {
                    if (element.type === 'checkbox') {
                        element.checked = value === '1' || value === 'true' || value === true;
                    } else if (element.type === 'radio') {
                        element.checked = element.value === value;
                    } else {
                        element.value = value;
                    }
                    console.log(`Feld ${key} gesetzt mit Wert: ${value}`);
                } else {
                    // Radio Button Gruppen
                    const radioButtons = document.querySelectorAll(`input[type="radio"][name="${key}"]`);
                    if (radioButtons.length > 0) {
                        radioButtons.forEach(radio => {
                            radio.checked = radio.value === value;
                        });
                        console.log(`Radio-Gruppe ${key} gesetzt mit Wert: ${value}`);
                    }
                }
            }
            
            if (data.settings) {
                window.appSettings = { ...window.appSettings, ...data.settings };
                loadSettingsToForm();
            }
            
            if (data.selectedPDFs) {
                window.selectedPDFs.clear();
                data.selectedPDFs.forEach(pdfName => {
                    window.selectedPDFs.add(pdfName);
                    const checkbox = document.querySelector(`input[value="${pdfName}"]`);
                    if (checkbox) {
                        checkbox.checked = true;
                        checkbox.closest('.pdf-checkbox').classList.add('selected');
                    }
                });
                updateSelectionSummary();
                updateNextButton();
            }
            
            // Versteckte Daten anzeigen und Berechnungen nach dem Laden ausführen
            setTimeout(() => {
                updateHiddenDataSection();
                addCalculationEventListeners();
                calculateAllFields();
            }, 100);
            
            showStatus('Daten erfolgreich geladen!');
        } catch (error) {
            showStatus('Fehler beim Laden der Daten: ' + error.message, 'error');
        }
    };
    reader.readAsText(file);
}

function handleUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const paramsDiv = document.getElementById('urlParams');
    const paramsContent = document.getElementById('urlParamsContent');
    
    let hasParams = false;
    let content = '<ul>';
    
    for (const [key, value] of urlParams) {
        // In hiddenData speichern, falls Feld nicht existiert
        window.hiddenData[key] = value;
        
        const element = document.getElementById(key);
        if (element) {
            element.value = value;
            content += `<li><strong>${key}:</strong> ${value}</li>`;
            hasParams = true;
        } else {
            content += `<li><strong>${key}:</strong> ${value} (versteckt)</li>`;
            hasParams = true;
        }
    }
    
    const today = new Date().toISOString().split('T')[0];
    ['Datum', 'DatumDate2'].forEach(fieldName => {
        const element = document.getElementById(fieldName);
        if (element && !element.value) {
            element.value = today;
        }
    });
    
    if (hasParams) {
        content += '</ul>';
        paramsContent.innerHTML = content;
        paramsDiv.style.display = 'block';
    }
    
    // Berechnungen nach dem Setzen der URL-Parameter ausführen
    setTimeout(() => {
        calculateAllFields();
    }, 500);
}