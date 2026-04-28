# Adélie Interface - Diagnostic Tool 🚀

Tento nástroj slouží pro oživování, testování a update firmware hardware **greenBOX (Adélie) Interface**.
Projekt byl migrován z CRA na **Vite** pro vyšší rychlost a stabilitu.

## 🛠️ Vývojové příkazy

V kořenovém adresáři projektu můžeš spouštět:

### `npm run dev`
Spustí aplikaci ve vývojovém režimu na [http://localhost:3000/Adelie-interface-test/).  
Stránka se automaticky obnoví při uložení změn v kódu.

### `npm run build`
Zkompiluje aplikaci pro produkční použití do složky `dist` (výchozí).
Výsledkem je optimalizovaný balíček připravený k upload na webový server.

---

### 📂 Nastavení cílové složky (Build Folder)

Pokud potřebuješ, aby se zkompilovaná aplikace neukládala do složky `dist`, ale jinam (např. do `build` nebo `public_html`), uprav soubor **`vite.config.js`** v kořenovém adresáři:

```javascript
// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/react-swc'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'moje_cilova_slozka', // ZDE změníš název složky
  },
})

### 📂 Nastavení cílové složky (Build Folder)

Nastavení složky na webu.

export default defineConfig({
  // Base musí začínat i končit lomítkem. 
  // Odpovídá názvu složky na vašem webovém serveru.
  base: '/Adelie-interface-test/', 
  
  plugins: [react()],
  // ... zbytek konfigurace
})