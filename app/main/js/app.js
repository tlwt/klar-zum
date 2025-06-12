// js/app.js
// Hauptanwendung und Initialisierung

window.addEventListener('load', async function() {
    await initializeApp();
});

async function initializeApp() {
    try {
        await loadPDFsFromDirectory();
        generatePDFSelection();
        handleUrlParams();
        
        document.getElementById('loading').style.display = 'none';
        document.getElementById('mainContent').style.display = 'block';
    } catch (error) {
        console.error('Fehler beim Initialisieren:', error);
        showError();
    }
}

async function generatePDFs(flatten = true) {
    const data = getAllFormData();
    const selectedPDFList = [];
    
    window.selectedPDFs.forEach(pdfName => {
        const pdf = window.availablePDFs.find(p => p.name === pdfName);
        if (pdf) {
            selectedPDFList.push(pdf);
        }
    });
    
    if (selectedPDFList.length === 0) {
        showStatus('Bitte wählen Sie mindestens ein PDF-Formular aus.', 'error');
        return;
    }
    
    try {
        const modeText = flatten ? 'geflacht (nicht bearbeitbar)' : 'bearbeitbar';
        showStatus(`Generiere ${selectedPDFList.length} PDF(s) als ${modeText}...`, 'info');
        
        for (const pdf of selectedPDFList) {
            await fillAndDownloadPDF(pdf, data, flatten);
        }
        
        saveData();
        showStatus(`${selectedPDFList.length} PDF(s) erfolgreich als ${modeText} generiert und Daten gespeichert!`);
        
    } catch (error) {
        showStatus('Fehler bei der PDF-Generierung: ' + error.message, 'error');
    }
}