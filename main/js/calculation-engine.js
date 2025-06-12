// js/calculation-engine.js
// Berechnungslogik für Formularfelder - Erweitert mit Unterschrift-Unterstützung

function addCalculationEventListeners() {
    // Event-Listener für alle Input-Felder hinzufügen
    document.querySelectorAll('#dataForm input, #dataForm textarea, #dataForm select, #hiddenDataFields input, #hiddenDataFields textarea').forEach(input => {
        input.addEventListener('input', calculateAllFields);
        input.addEventListener('change', calculateAllFields);
    });
    
    // Spezielle Event-Listener für Unterschrift-Felder
    document.querySelectorAll('.signature-data').forEach(signatureInput => {
        signatureInput.addEventListener('change', () => {
            console.log(`Unterschrift-Feld ${signatureInput.id} geändert`);
            calculateAllFields();
        });
    });
}

function calculateAllFields() {
    if (!window.currentFieldCalculations) return;
    
    const formData = getAllFormData();
    
    window.currentFieldCalculations.forEach((calculation, fieldName) => {
        const calculatedValue = evaluateCalculation(calculation, formData);
        const element = document.getElementById(fieldName);
        if (element && calculatedValue !== null) {
            // Spezielle Behandlung für Unterschrift-Felder (diese sollten nicht überschrieben werden)
            if (!element.classList.contains('signature-data')) {
                element.value = calculatedValue;
            }
        }
    });
}

function evaluateCalculation(calculation, formData) {
    try {
        // Ersetze Feldnamen in der Berechnung durch ihre Werte
        let expression = calculation;
        
        // Finde alle Feldnamen in geschweiften Klammern
        const fieldMatches = expression.match(/{([^}]+)}/g);
        if (fieldMatches) {
            fieldMatches.forEach(match => {
                const fieldName = match.slice(1, -1); // Entferne { und }
                let fieldValue = formData[fieldName] || '';
                
                // Spezielle Behandlung für Unterschrift-Felder
                if ((fieldName.toLowerCase().includes('unterschrift') || fieldName.toLowerCase().includes('signature')) && 
                    fieldValue && fieldValue.startsWith('data:image/')) {
                    fieldValue = '[Unterschrift vorhanden]';
                }
                
                expression = expression.replace(match, `"${fieldValue}"`);
            });
        }
        
        // Spezielle Funktionen unterstützen
        if (expression.includes('CONCAT')) {
            // CONCAT({Vorname}, " ", {Nachname}) -> "Vorname" + " " + "Nachname"
            expression = expression.replace(/CONCAT\(/g, '').replace(/\)$/, '');
            expression = expression.replace(/,\s*/g, ' + ');
        }
        
        // Sichere Auswertung der Expression
        const result = evaluateExpression(expression);
        return result;
        
    } catch (error) {
        console.warn('Fehler bei Berechnung:', error);
        return null;
    }
}

function evaluateExpression(expression) {
    // Sichere Auswertung ohne eval()
    try {
        // Einfache String-Konkatenation
        if (expression.includes('+')) {
            const parts = expression.split('+').map(part => part.trim());
            return parts.map(part => {
                if (part.startsWith('"') && part.endsWith('"')) {
                    return part.slice(1, -1);
                }
                return part;
            }).join('');
        }
        
        // Einzelner String-Wert
        if (expression.startsWith('"') && expression.endsWith('"')) {
            return expression.slice(1, -1);
        }
        
        return expression;
    } catch (error) {
        console.warn('Fehler bei Expression-Auswertung:', error);
        return '';
    }
}