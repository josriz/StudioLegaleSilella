# Manuale Operativo ufficiale — Studio Legale Silella

## Fonte unica degli assistenti

La fonte ufficiale per **Assistente Studio** e **Assistente Cliente** è:

- `manuale.html`
- repository: `josriz/StudioLegaleSilella`
- branch: `main`

Gli assistenti devono recuperare il contenuto aggiornato del file prima di rispondere. Non devono mantenere una copia autonoma delle procedure.

## Regola di aggiornamento

Ogni nuova funzione del gestionale deve seguire questo ordine:

1. implementazione della funzione;
2. test completo della funzione;
3. aggiornamento della relativa sezione di `manuale.html`;
4. aggiornamento della versione/data del manuale;
5. pubblicazione;
6. verifica dell'assistente con almeno una domanda coerente con la nuova procedura.

## Regola di sicurezza

Se una procedura non è presente nel manuale o il testo non è sufficientemente chiaro, l'assistente deve dichiararlo e **non inventare** la procedura.

## Ambiti

Il manuale può contenere sia procedure dello Studio sia procedure dell'Area Cliente. Gli assistenti devono applicare il proprio filtro di ruolo e non esporre procedure interne non pertinenti al Cliente.

## Stato

Versione di riferimento: **1.0**  
Data messa in sicurezza: **2026-10-08**
