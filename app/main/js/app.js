// js/app.js
// Hauptanwendung und Initialisierung

window.addEventListener('load', async function() {
    await initializeApp();
});

async function initializeApp() {
    try {
        console.log('🚀 App-Initialisierung gestartet...');
        
        await loadPDFsFromDirectory();
        generatePDFSelection();
        handleUrlParams();
        
        console.log('✅ App erfolgreich initialisiert');
        showMainApp();
    } catch (error) {
        console.error('❌ Fehler beim Initialisieren:', error);
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
        
        let successCount = 0;
        let failedPDFs = [];
        
        for (const pdf of selectedPDFList) {
            try {
                await fillAndDownloadPDF(pdf, data, flatten);
                successCount++;
                console.log(`✅ PDF erfolgreich generiert: ${pdf.name}`);
            } catch (pdfError) {
                console.error(`❌ Fehler bei PDF ${pdf.name}:`, pdfError);
                failedPDFs.push(pdf.name);
                // Fortsetzung mit nächstem PDF
            }
        }
        
        saveData();
        
        if (successCount === selectedPDFList.length) {
            showStatus(`${successCount} PDF(s) erfolgreich als ${modeText} generiert und Daten gespeichert!`, 'success');
        } else if (successCount > 0) {
            showStatus(`${successCount} von ${selectedPDFList.length} PDF(s) erfolgreich generiert. Fehler bei: ${failedPDFs.join(', ')}`, 'warning');
        } else {
            showStatus(`Alle PDF-Generierungen fehlgeschlagen: ${failedPDFs.join(', ')}`, 'error');
        }
        
    } catch (error) {
        showStatus('Fehler bei der PDF-Generierung: ' + error.message, 'error');
    }
}