- [[Exceptions]]
### **Quiz: Eccezioni "Checked" vs "Unchecked"**

**1. Quando vengono controllate le eccezioni "Checked"?** 
A) Durante l'esecuzione del programma.
B) Prima di avviare il programma, dal compilatore. 
C) Solo quando il programma va in crash. 
D) Mai, vengono ignorate di default.

**2. Cosa succede se non gestisci una potenziale eccezione "Checked" nel tuo codice?** 
A) Il programma ignora l'errore e continua l'esecuzione. 
B) Il programma viene compilato ma si blocca a runtime. 
C) Il programma darà errore e non verrà nemmeno compilato. 
D) Il compilatore corregge l'errore automaticamente.

**3. Quali strumenti il linguaggio ti obbliga a usare per gestire un'eccezione "Checked"?** x
A) Esclusivamente il blocco `try-catch`. 
B) Un blocco `try-catch` o la dichiarazione `throws`. 
C) Un blocco `if-else`. 
D) La parola chiave `RuntimeException`.

**4. Qual è la causa principale delle eccezioni "Checked" secondo il testo?** x
A) Errori di logica o distrazioni del programmatore. 
B) Bug nella scrittura del codice sorgente. 
C) L'uso di variabili vuote. 
D) Fattori esterni e imprevedibili.

**5. Quale di questi è un esempio specifico di eccezione "Checked" citato nel testo?** 
A) `ArithmeticException` 
B) `NullPointerException` 
C) `FileNotFoundException` 
D) `RuntimeException`

**6. Oltre alla lettura di un file inesistente, quali altri scenari causano tipicamente eccezioni "Checked"?** 
A) Divisione matematica per zero. 
B) Uso di variabili non inizializzate. 
C) Problemi di connessione a internet o al database. 
D) Errori di sintassi nella scrittura del codice.

**7. Quando si verificano le eccezioni "Unchecked"?** 
A) Durante la compilazione del codice. 
B) Prima che il programma venga avviato. 
C) Durante l'esecuzione del programma (a runtime). 
D) Esclusivamente durante la lettura di file.

**8. Come vengono spesso chiamate in gergo le eccezioni "Unchecked"?** 
A) `CompilationException` 
B) `RuntimeException` 
C) `CheckedException` 
D) `ExternalException`

**9. Qual è la regola del compilatore riguardo alle eccezioni "Unchecked"?** 
A) Ti obbliga a usare sempre un blocco `try-catch`. 
B) Non ti obbliga a prevederle e a scrivere codice per gestirle. 
C) Blocca la compilazione se non sono dichiarate con `throws`. 
D) Ti avvisa con un messaggio di errore preventivo.

**10. Cosa rappresentano di solito le eccezioni "Unchecked"?** x
A) Problemi di connessione al database. 
B) File mancanti o corrotti nel computer. 
C) Bug o errori di logica del programmatore. 
D) Eventi esterni di cui il programma non ha controllo.

**11. Come dovrebbe essere affrontata idealmente un'eccezione "Unchecked" secondo le best practice del testo?** x
A) Ignorandola e sperando non si verifichi. 
B) Aggiungendo un blocco `try-catch` per "nascondere" l'errore. 
C) Correggendo il codice sorgente per evitare che il bug accada. 
D) Dichiarandola con `throws` in ogni metodo.

**12. Se provi a dividere un numero per zero, quale eccezione "Unchecked" otterrai?** 
A) `FileNotFoundException` 
B) `NullPointerException` 
C) `ArithmeticException` 
D) `DatabaseException`

**13. Se cerchi di usare una variabile vuota che non contiene alcun dato, quale eccezione si verifica?** x
A) `FileNotFoundException` 
B) `NullPointerException` 
C) `ArithmeticException` 
D) `InternetConnectionException`

**14. Il compilatore ti obbliga a controllare preventivamente ogni singola divisione matematica nel tuo codice?** 
A) Sì, per prevenire che l'utente inserisca uno zero. 
B) No, sta a te scrivere il codice in modo corretto per evitarlo. 
C) Sì, ma solo nelle applicazioni web. 
D) No, perché le divisioni per zero vengono ignorate.

**15. Quale tipo di eccezione indica una situazione da cui il programma dovrebbe "sapersi riprendere"?** x
A) Le eccezioni "Unchecked" 
B) Le eccezioni "Checked"
C) Solo le `RuntimeException` 
D) Solo la `NullPointerException`

**16. _"Attenzione! Il file potrebbe non esistere. Cosa devo fare se non lo trovo?"_ - Chi "dice" questa frase durante la programmazione?** 
A) Il Garbage Collector 
B) L'IDE (Interfaccia grafica) a runtime 
C) L'utente finale 
D) Il compilatore

**17. Quale delle seguenti affermazioni è VERA sulle eccezioni "Checked"?** x
A) Dipendono unicamente dalla scarsa bravura del programmatore. 
B) Non impediscono mai la compilazione se ignorate. 
C) Non dipendono dalla bravura del programmatore, ma da fattori esterni. 
D) Si verificano solo ed esclusivamente a runtime.

**18. Quale delle seguenti affermazioni è VERA sulle eccezioni "Unchecked"?** 
A) Il compilatore le analizza in anticipo. 
B) Il programmatore è costretto a usare il blocco `try-catch`. 
C) Sono quasi sempre causate da una connessione internet assente. 
D) Il compilatore non le controlla in anticipo.

**19. Se il tuo programma cerca di leggere dati da un database ma il server è spento, che tipo di eccezione è più probabile che tu debba affrontare?** 
A) Un errore di logica "Unchecked" 
B) Una `NullPointerException` 
C) Un fattore esterno da gestire tramite un'eccezione "Checked" 
D) Una `ArithmeticException`

**20. Qual è la differenza fondamentale tra Checked e Unchecked in relazione alla compilazione?** 
A) Le Unchecked bloccano la compilazione, le Checked no. 
B) Le Checked bloccano la compilazione se non gestite, le Unchecked no. 
C) Entrambe bloccano la compilazione se non gestite. 
D) Nessuna delle due ha alcun effetto sul processo di compilazione.

---

### **Soluzioni**

1. **B** (Prima di avviare il programma, dal compilatore)
    
2. **C** (Il programma darà errore e non verrà nemmeno compilato)
    
3. **B** (Un blocco try-catch o la dichiarazione throws)
    
4. **D** (Fattori esterni e imprevedibili)
    
5. **C** (`FileNotFoundException`)
    
6. **C** (Problemi di connessione a internet o al database)
    
7. **C** (Durante l'esecuzione del programma - a runtime)
    
8. **B** (`RuntimeException`)
    
9. **B** (Non ti obbliga a prevederle e a scrivere codice per gestirle)
    
10. **C** (Bug o errori di logica del programmatore)
    
11. **C** (Correggendo il codice sorgente per evitare che il bug accada)
    
12. **C** (`ArithmeticException`)
    
13. **B** (`NullPointerException`)
    
14. **B** (No, sta a te scrivere il codice in modo corretto per evitarlo)
    
15. **B** (Le eccezioni "Checked")
    
16. **D** (Il compilatore)
    
17. **C** (Non dipendono dalla bravura del programmatore, ma da fattori esterni)
    
18. **D** (Il compilatore non le controlla in anticipo)
    
19. **C** (Un fattore esterno da gestire tramite un'eccezione "Checked")
    
20. **B** (Le Checked bloccano la compilazione se non gestite, le Unchecked no)

# WHICH IS WHICH QUIZ
### **Quiz: Quale eccezione è? (Scenari Pratici)**

**1. Il tuo programma richiede di scaricare un aggiornamento da un server esterno, ma in quel momento cade la connessione Wi-Fi dell'utente. Che tipo di eccezione si genera?** A) Unchecked (Perché è un errore del programmatore) B) Checked (Perché dipende da un fattore esterno e imprevedibile) C) Nessuna eccezione, il programma si chiude in automatico.

**2. Hai creato una variabile per un utente, ma ti sei dimenticato di inserirci i dati dentro. Quando provi a stampare il nome dell'utente a schermo, il programma va in crash. Che eccezione è?** A) Unchecked (NullPointerException - errore di logica) B) Checked (NullPointerException - errore esterno) C) Checked (FileNotFoundException)

**3. Quale di queste eccezioni appartiene alla famiglia delle "RuntimeException" (e quindi il compilatore la ignora durante il controllo preventivo)?** A) `FileNotFoundException` (File non trovato) B) Un'eccezione legata alla perdita di connessione al Database C) `ArithmeticException` (Divisione per zero)

**4. Stai scrivendo un software per una biblioteca. Il programma deve leggere un file di testo contenente l'elenco dei libri, ma l'utente potrebbe aver spostato quel file in un'altra cartella. Il compilatore ti obbliga a gestire questo rischio. Che eccezione stai gestendo?** A) Unchecked (Perché l'utente ha sbagliato) B) Checked (FileNotFoundException) C) Checked (ArithmeticException)

**5. Il tuo programma deve calcolare la media dei voti di una classe. Per sbaglio, scrivi una formula che divide la somma dei voti per il numero di studenti, anche se la classe ha 0 studenti inseriti. Che tipo di eccezione affronterai a runtime?** A) Checked B) Unchecked C) Il compilatore ti bloccherà prima di farti avviare il calcolo.

**6. Se leggi nel codice sorgente un blocco `try-catch` o una clausola `throws` messa **obbligatoriamente** per far avviare il programma, che tipo di eccezione c'è al suo interno?** A) Sicuramente un'eccezione Unchecked. B) Sicuramente un'eccezione Checked. C) Potrebbe essere una `NullPointerException`.

**7. Un programmatore alle prime armi dice: _"Non capisco, il programma compila perfettamente, ma quando clicco su 'Calcola', si blocca tutto!"_. Con quale categoria di eccezione ha a che fare molto probabilmente?** A) Unchecked (Si verificano a runtime e il compilatore non le previene) B) Checked (Si verificano a runtime ma il compilatore le previene) C) CompilationException

**8. C'è un bug nel tuo codice sorgente che causa un crash. Secondo la teoria, qual è il modo corretto di gestire questa situazione?** A) Aggiungere un try-catch per "tamponare" l'errore Checked. B) Correggere la logica del codice sorgente, poiché si tratta di un'eccezione Unchecked. C) Dichiarare l'errore con `throws` in modo che ci pensi il compilatore.

**9. Stai collegando la tua app a un Database SQL. Il server del database è temporaneamente spento per manutenzione. Questa è un'eventualità da cui "il programma dovrebbe sapersi riprendere". Qual è l'eccezione corretta?** A) Unchecked B) Checked C) Nessuna eccezione, basta riavviare il PC.

**10. Qual è la differenza principale tra `FileNotFoundException` e `NullPointerException` secondo il testo?** A) La prima dipende da fattori esterni (Checked), la seconda da un errore del programmatore o variabile vuota (Unchecked). B) La prima è un errore del programmatore (Unchecked), la seconda dipende dal sistema operativo (Checked). C) Sono entrambe eccezioni Checked, ma si verificano in momenti diversi.

---

### **Soluzioni**

1. **B** (Checked - dipende da un fattore esterno e imprevedibile)
    
2. **A** (Unchecked - NullPointerException - errore di logica)
    
3. **C** (`ArithmeticException` - Divisione per zero)
    
4. **B** (Checked - FileNotFoundException)
    
5. **B** (Unchecked - stai causando un'ArithmeticException, che il compilatore non controlla)
    
6. **B** (Sicuramente un'eccezione Checked)
    
7. **A** (Unchecked - Si verificano a runtime e il compilatore non le previene)
    
8. **B** (Correggere la logica del codice sorgente, poiché si tratta di un'eccezione Unchecked)
    
9. **B** (Checked - è un problema di connessione, esterno e imprevedibile)
    
10. **A** (La prima dipende da fattori esterni (Checked), la seconda da un errore del programmatore o variabile vuota (Unchecked))