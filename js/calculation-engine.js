// js/calculation-engine.js
// Berechnungslogik für Formularfelder

function addCalculationEventListeners() {
    // Event-Listener für alle Input-Felder hinzufügen
    document.querySelectorAll('#dataForm input, #dataForm textarea, #dataForm select, #hiddenDataFields input, #hiddenDataFields textarea').forEach(input => {
        input.addEventListener('input', calculateAllFields);
        input.addEventListener('change', calculateAllFields);
    });
}

function calculateAllFields() {
    if (!window.currentFieldCalculations) return;
    
    const formData = getAllFormData();
    
    window.currentFieldCalculations.forEach((calculation, fieldName) => {
        const calculatedValue = evaluateCalculation(calculation, formData);
        const element = document.getElementById(fieldName);
        if (element && calculatedValue !== null) {
            element.value = calculatedValue;
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
                const fieldValue = formData[fieldName] || '';
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