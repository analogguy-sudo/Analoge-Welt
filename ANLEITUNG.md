# Analoge Welt der Fotografie: Anleitung von vorne

Mit dieser Web-App führst du dein digitales Analogbook: Filme, Kameras, jedes einzelne Bild (Blende, Zeit, Motiv, warum so), Entwicklungsdaten und Fotos. Dazu gibt es eine öffentliche Entwicklungsdatenbank, die nur du pflegen kannst.

## Was du bekommst

| Datei | Wohin? | Wozu? |
|---|---|---|
| `index.html` | GitHub | die App (Anmeldung, Meine Filme, Kameras, Anleitung) |
| `datenbank.html` | GitHub | öffentliche Entwicklungsdatenbank, für alle lesbar |
| `pflege.html` | GitHub | Seite, auf der nur du die Datenbank pflegst |
| `config.js` | GitHub | deine zwei Zugangswerte für Supabase |
| `setup.sql` | **nur Supabase** | richtet die komplette Datenbank ein |
| `ANLEITUNG.md` | nirgends | diese Anleitung |

**Wichtig:** `setup.sql` und `ANLEITUNG.md` lädst du **nicht** auf GitHub hoch. Auf GitHub kommen nur die vier Dateien oben.

---

## Teil 1: Supabase (die Datenbank)

### Schritt 1: Projekt
- Du hast schon ein Supabase-Projekt? Dann behalte es und gehe zu Schritt 2. Alles Vorhandene bleibt erhalten.
- Neu: auf supabase.com anmelden, **New project**, Name z. B. `analoge-welt`, ein sicheres Datenbank-Passwort (im Passwortmanager speichern), Region **Frankfurt**. Warte 1 bis 2 Minuten.

### Schritt 2: Datenbank einrichten
1. Links auf **SQL Editor** klicken.
2. **New query** klicken.
3. Die Datei `setup.sql` öffnen, **alles** kopieren (Cmd+A, Cmd+C) und im SQL Editor einfügen.
4. Rechts unten auf **Run** klicken.
5. Es soll „Success“ erscheinen. Du kannst das gefahrlos mehrmals ausführen.

### Schritt 3: Anmeldung vereinfachen
1. Links **Authentication**, dann **Sign In / Providers**, dann **Email**.
2. **Confirm email** ausschalten und speichern. Dann klappt die Registrierung sofort ohne Bestätigungsmail.

### Schritt 4: Die zwei Zugangswerte finden
- **Project URL:** **Project Settings** (Zahnrad links unten), dann **Data API**. Beginnt mit `https://` und endet auf `.supabase.co`.
- **Publishable key:** **Project Settings**, dann **API Keys**. Beginnt mit `sb_publishable_`. Kopiere diesen, nie den „Secret key“.

Lass diese Seite offen, du brauchst die Werte gleich.

---

## Teil 2: GitHub (die Webseite)

### Schritt 5: Repository anlegen und Dateien hochladen
1. Auf github.com: **+** (oben rechts), dann **New repository**. Name z. B. `Analoge-Welt`. **Public** wählen. **Create repository**.
   Gibt es den Namen schon von früher? Lösche das alte Repository vorher (**Settings**, ganz unten **Delete this repository**).
2. Auf der neuen Seite auf **uploading an existing file** klicken.
3. Diese **vier Dateien** ins Fenster ziehen: `index.html`, `datenbank.html`, `pflege.html`, `config.js`.
4. Unten auf **Commit changes** klicken.

### Schritt 6: config.js ausfüllen
1. Im Repository auf `config.js` klicken, oben rechts das **Stift-Symbol**.
2. Ersetze `HIER-DEINE-PROJECT-URL` durch deine Project URL und `HIER-DEIN-PUBLISHABLE-KEY` durch deinen Key. **Die Anführungszeichen und das Semikolon bleiben stehen.** Beispiel:
   ```js
   const SUPABASE_URL = "https://abcdefghijkl.supabase.co";
   const SUPABASE_ANON_KEY = "sb_publishable_xxxxxxxx";
   ```
3. **Commit changes** klicken und im Fenster noch einmal **Commit changes** bestätigen.

### Schritt 7: Veröffentlichen
1. Im Repository **Settings**, links **Pages**.
2. **Source:** Deploy from a branch. **Branch:** `main`, Ordner `/ (root)`. **Save**.
3. Nach 1 bis 2 Minuten steht oben „Your site is live at …“. Das ist deine Adresse, z. B. `https://dein-name.github.io/Analoge-Welt/`.

---

## Teil 3: Beides verbinden

### Schritt 8: Adresse in Supabase eintragen
1. In Supabase: **Authentication**, dann **URL Configuration**.
2. **Site URL:** deine GitHub-Pages-Adresse eintragen.
3. Bei **Redirect URLs** dieselbe Adresse hinzufügen. **Save changes**.

---

## Teil 4: Loslegen

### Schritt 9: Konto erstellen
Öffne deine Adresse (am besten in einem privaten Fenster), gib E-Mail und Passwort ein und klicke auf **Konto erstellen**.

### Schritt 10: Dich als Admin eintragen (für die öffentliche Datenbank)
Damit nur du die Datenbank ändern darfst, trägst du dich einmal ein:
1. In Supabase **SQL Editor**, **New query**.
2. Diesen Code einfügen. Ersetze `DEINE-E-MAIL` durch die Adresse, mit der du dich gerade registriert hast:
   ```sql
   insert into public.admins (user_id)
   select id from auth.users where lower(email) = lower('DEINE-E-MAIL')
   on conflict do nothing;

   select * from public.admins;
   ```
3. **Run** klicken. Unten muss **eine Zeile** erscheinen. Bei null Zeilen stimmt die E-Mail nicht, schau unter **Authentication → Users** nach der genauen Schreibweise.

Diesen Code lädst du nirgends hoch. Er wird nur im SQL Editor ausgeführt.

### Schritt 11: Testen
- `deine-adresse/` ist die App für deine Filme.
- `deine-adresse/datenbank.html` ist die öffentliche Datenbank.
- `deine-adresse/pflege.html` ist deine Pflege-Seite. Melde dich dort an. Wenn „Kein Zugriff“ erscheint, stimmt Schritt 10 nicht.

---

## So nutzt du dein Analogbook

**Neuen Film einlegen**
1. In der App: **Meine Filme**, dann **Neuer Film**.
2. Filmname, ISO, Format und Kamera eintragen. Der Status steht schon auf **geladen**.
3. **Speichern** klicken. Der Dialog bleibt offen und springt zu **Bilder (Frames)**.

**Pro Bild notieren (das ist dein Analogbook)**
1. Trage ein: Blende, Belichtungszeit, Objektiv, Motiv, Ort und **Warum so?** (z. B. „Gegenlicht, +1 Blende, damit der Schatten Zeichnung behält“).
2. Klicke **Frame speichern** oder drücke Enter.
3. Die Nummer springt automatisch weiter. Blende, Zeit und Objektiv bleiben stehen, du änderst nur, was sich ändert.
4. Ein Frame lässt sich jederzeit über **Bearbeiten** korrigieren.

**Später**
- Beim Entwickeln trägst du Entwickler, Zeit, Fixierung und Netzmittel im selben Film ein und stellst den Status um.
- **Als CSV exportieren** (im Bereich Frames) liefert dir alle Bilder des Films als Tabelle, z. B. für deine Homepage.
- Lege die Seite auf dem iPhone als App ab: Safari, Teilen-Symbol, **Zum Home-Bildschirm**.

**Hinweis fürs Feld:** Die App braucht Internet. Ohne Empfang kannst du nichts speichern. Notiere dann kurz in der Notizen-App und trage es später ein.

---

## Wenn etwas nicht klappt

| Meldung / Problem | Lösung |
|---|---|
| 404 beim Öffnen der Adresse | Pages eingeschaltet? (Schritt 7). Liegen die Dateien direkt im Hauptordner des Repositories? 2 bis 5 Minuten warten. |
| „Einrichtungsfehler … Platzhalter“ | `config.js` ist noch nicht ausgefüllt oder dein Browser zeigt die alte Version. Datei prüfen (Schritt 6), dann Cmd+Option+R oder privates Fenster. |
| „Load failed“ bei der Registrierung | Project URL in `config.js` falsch. Muss mit `https://` beginnen, auf `.supabase.co` enden, ohne `/` am Ende. |
| „Password should be at least 6 characters“ | Passwort zu kurz. |
| „new row violates row-level security policy“ | `setup.sql` nicht vollständig ausgeführt, oder du bist nicht angemeldet. |
| Frames oder neue Felder speichern nicht | `setup.sql` noch einmal komplett ausführen. |
| `pflege.html` zeigt „Kein Zugriff“ | Schritt 10 wiederholen. Die Abfrage unten muss eine Zeile zeigen. |
| Bestätigungslink führt ins Leere | Site URL in Supabase eintragen (Schritt 8) oder **Confirm email** ausschalten (Schritt 3). |

**Sicherheit:** Der Publishable Key darf öffentlich sein. Den Secret- oder service_role-Key trägst du nirgends ein. `setup.sql` enthält keine persönlichen Daten.
