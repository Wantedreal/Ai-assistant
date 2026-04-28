import React, { createContext, useContext, useState } from 'react'

// ─── Translation table ────────────────────────────────────────────────────────
const T = {
  en: {
    // Header
    'nav.cells':   'Cells',
    'nav.compare': 'Compare',
    'nav.history': 'History',

    // LayerControlPanel
    'layer.title':        'Layers',
    'layer.cat.structure':  'Structure',
    'layer.cat.electrical': 'Electrical',
    'layer.cat.insulation': 'Insulation',
    'layer.housing':      'Housing',
    'layer.dimensions':   'Dimensions L/l/h',
    'layer.end_plates':   'End Plates',
    'layer.side_supports':'Side Supports',
    'layer.brackets':     'Cell Brackets',
    'layer.cells':        'Cells',
    'layer.terminals':    'Terminals (+/−)',
    'layer.busbars':      'Busbars / Strips',
    'layer.separator_cards': 'Separator Cards',
    'layer.show_all':     'Show all',
    'layer.hide_all':     'Hide all',
    'layer.settings':     'Settings',
    'layer.cell_gap':     'Cell Gap',
    'layer.end_plate':    'End Plate',
    'layer.busbar_width': 'Busbar Width',

    // ConstraintsForm
    'form.title':        'Constraints',
    'form.electrical':   'Electrical targets',
    'form.energy':       'Energy',
    'form.voltage':      'Voltage',
    'form.current':      'Current',
    'form.dod':          'DoD',
    'form.housing':      'Housing dimensions',
    'form.length_L':     'Length L',
    'form.width_l':      'Width l',
    'form.height_h':     'Height h',
    'form.margin':       'Margin',
    'form.cell_gap':     'Cell gap',
    'form.end_plate':    'End plate',
    'form.busbar_width': 'Busbar width',
    'form.config_mode':  'Configuration mode',
    'form.mode_auto':    'Auto',
    'form.mode_manual':  'Manual',
    'form.series':       'Series S',
    'form.parallel':     'Parallel P',

    // Card titles / 3D viewer
    'cell.title':           'Cell Selector',
    'pack3d.title':              '3D Pack Visualization',
    'pack3d.fullscreen':         'Click to view fullscreen',
    'pack3d.fs_subtitle':        'Click camera presets to change views',
    'pack3d.fs_camera':          'Camera:',
    'pack3d.fs_return':          'Return to Layout',

    // AI Analysis FAB
    'ai.title':        'AI Analysis',
    'ai.busy':         'All AI models are busy right now — try again in a minute',
    'ai.no_key':       'AI not configured — contact your administrator',
    'ai.error':        'Failed to get AI analysis',
    'pack3d.cam.front':          'Front',
    'pack3d.cam.back':           'Back',
    'pack3d.cam.top':            'Top',
    'pack3d.cam.bottom':         'Bottom',
    'pack3d.cam.left':           'Left',
    'pack3d.cam.right':          'Right',
    'pack3d.cam.isometric':      'Isometric',
    'pack3d.cam.free':           'Free Orbit',

    // CellSelector — search
    'cell.search_label':    'Search cell',
    'cell.search_placeholder': 'Type to search...',
    'cell.no_results':      'No cells found',

    // CellSelector — spec badges
    'cell.weight':          'Weight',
    'cell.capacity':        'Capacity',
    'cell.max_current':     'Max current',
    'cell.voltage':         'Voltage',

    // CellSelector — detail labels
    'cell.chemistry':       'Chemistry',
    'cell.dimensions':      'Dimensions',
    'cell.swelling':        'Swelling',
    'cell.cycle_life':      'Cycle life',
    'cell.discharge':       'Discharge',
    'cell.charge':          'Charge',
    'cell.cutoff_v':        'Cutoff V',
    'cell.temp_range':      'Temp range',
    'cell.max_charge_t':    'Max charge T',

    // CellSelector — best matches
    'cell.best_matches':    'Best matches',
    'cell.bm_loading':      'Loading…',
    'cell.bm_error':        'Recommendations unavailable',
    'cell.bm_empty':        'No cells fit these constraints',
    'cell.bm_near':         'near fit',
    'cell.bm_short':        'Short by',
    'cell.bm_fill':         'Fill',
    'cell.bm_margin':       'Margin',

    // CellSelector — buttons
    'btn.calculate':        'Calculate',
    'btn.calculating':      'Calculating…',
    'btn.export_pdf':       'Export PDF',
    'btn.import':           'Import',
    'btn.importing':        'Importing...',
    'btn.sync':             'Sync',
    'btn.syncing':          'Syncing...',

    // Verdict
    'verdict.accept': '✓ ACCEPT',
    'verdict.reject': '✗ REJECT',

    // ResultsPanel
    'results.electrical':   'Electrical Results',
    'results.mechanical':   'Mechanical Results',
    'results.placeholder_elec': 'Set constraints and click Calculate',
    'results.placeholder_mech': 'Results will appear after calculation',
    'results.config':       'Configuration',
    'results.total_cells':  'Total cells',
    'results.pack_voltage': 'Pack voltage',
    'results.pack_current': 'Pack current',
    'results.usable_energy':'Usable energy',
    'results.total_weight': 'Total weight',
    'results.final_L':      'Final L',
    'results.final_W':      'Final W',
    'results.final_H':      'Final H',
    'results.margin_L':     'Margin L',
    'results.margin_W':     'Margin W',
    'results.margin_H':     'Margin H',

    // ComparePanel
    'compare.title':    'Cell Comparison',
    'compare.subtitle': 'Select 2–3 cells to compare specifications side by side',
    'compare.hint':     'Select at least 2 cells above to see a side-by-side comparison.',
    'compare.slot':     'Cell',
    'compare.search':   'Search cell…',
    'compare.no_results': 'No results',

    // ComparePanel spec row labels
    'spec.type':          'Cell type',
    'spec.chimie':        'Chemistry',
    'spec.fabricant':     'Manufacturer',
    'spec.tension':       'Nominal voltage',
    'spec.capacite':      'Capacity',
    'spec.courant_max':   'Max current',
    'spec.dimensions':    'Dimensions',
    'spec.masse':         'Mass',
    'spec.energie_mass':  'Gravimetric energy',
    'spec.energie_vol':   'Volumetric energy',
    'spec.cycle_life':    'Cycle life',
    'spec.dod':           'DoD reference',
    'spec.c_discharge':   'Max discharge C-rate',
    'spec.c_charge':      'Max charge C-rate',
    'spec.cutoff':        'Cutoff voltage',
    'spec.temp_range':    'Temp range',
    'spec.swelling':      'Swelling',

    // HistoryPanel
    'history.title':     'Calculation History',
    'history.clear':     'Clear all',
    'history.loading':   'Loading…',
    'history.empty':     'No calculations yet.\nRun a calculation to see history here.',
    'history.restore':   'Click to restore this calculation',

    // CataloguePanel
    'catalogue.title':    'Cell Catalogue',
    'catalogue.search':   'Search cells…',
    'catalogue.add':      'Add Cell',
    'catalogue.showing':  'Showing',
    'catalogue.cells':    'cells',
    'catalogue.hint':     'Click any row to select that cell in the calculator',
    'catalogue.no_match': 'No cells match your search',
    'catalogue.filter.all':        'All',
    'catalogue.filter.prismatic':  'Prismatic',
    'catalogue.filter.cylindrical':'Cylindrical',
    'catalogue.filter.pouch':      'Pouch',
    'catalogue.col.name':      'Name',
    'catalogue.col.type':      'Type',
    'catalogue.col.chemistry': 'Chemistry',
    'catalogue.col.maker':     'Maker',
    'catalogue.col.voltage':   'Voltage',
    'catalogue.col.capacity':  'Capacity',
    'catalogue.col.max_a':     'Max A',
    'catalogue.col.mass':      'Mass (g)',
    'catalogue.col.cycles':    'Cycles',

    // AddCellModal
    'add_cell.title':      'Add New Cell',
    'add_cell.required':   'Required fields',
    'add_cell.optional':   'Optional fields',
    'add_cell.show_opt':   'Show optional fields',
    'add_cell.hide_opt':   'Hide optional fields',
    'add_cell.save':       'Add Cell',
    'add_cell.saving':     'Saving…',
    'add_cell.cancel':     'Cancel',
    'add_cell.sync_ok':    'Will sync to:',
    'add_cell.sync_warn':  'No Excel file configured.',
    'add_cell.sync_warn2': 'The cell will be added to the database only. Configure a source file so future cells are saved to Excel too.',
    'add_cell.import_file':'Import file',
    'add_cell.importing':  'Importing…',
    'add_cell.sync_save':  'Save path',
    // field labels
    'add_cell.f.name':         'Cell Name',
    'add_cell.f.type':         'Cell Type',
    'add_cell.f.voltage':      'Nom. Voltage (V)',
    'add_cell.f.capacity':     'Capacity (Ah)',
    'add_cell.f.max_current':  'Max Current (A)',
    'add_cell.f.diameter':     'Diameter (mm)',
    'add_cell.f.diameter_hint':'Used for length + width',
    'add_cell.f.height':       'Height (mm)',
    'add_cell.f.length':       'Length (mm)',
    'add_cell.f.length_hint':  'Series axis thickness',
    'add_cell.f.width':        'Width (mm)',
    'add_cell.f.width_hint':   'Parallel axis',
    'add_cell.f.height_hint':  'Standing height Y',
    'add_cell.f.mass':         'Mass (g)',
    'add_cell.f.swelling':     'Swelling (%)',
    'add_cell.f.swelling_hint':'Auto-filled from chemistry',
    'add_cell.f.maker':        'Manufacturer',
    'add_cell.f.chemistry':    'Chemistry',
    'add_cell.f.cycle_life':   'Cycle Life',
    'add_cell.f.dod':          'DoD ref. (%)',
    'add_cell.f.eol':          'EOL capacity (%)',
    'add_cell.f.c_discharge':  'Discharge C-rate',
    'add_cell.f.c_charge':     'Charge C-rate',
    'add_cell.f.cutoff':       'Cutoff V',
    'add_cell.f.temp_min':     'Temp min (°C)',
    'add_cell.f.temp_max':     'Temp max (°C)',
    'add_cell.f.temp_charge':  'Max charge T (°C)',
    'add_cell.f.v_charge':     'Max charge V',

    // App loading / error
    'app.loading': 'Loading cell catalogue…',
    'app.error':   'Cannot reach the API. Make sure FastAPI is running on port 8000.',
    'btn.retry':   'Retry',
  },

  fr: {
    // Header
    'nav.cells':   'Cellules',
    'nav.compare': 'Comparer',
    'nav.history': 'Historique',

    // LayerControlPanel
    'layer.title':        'Couches',
    'layer.cat.structure':  'Structure',
    'layer.cat.electrical': 'Électrique',
    'layer.cat.insulation': 'Isolation',
    'layer.housing':      'Boîtier',
    'layer.dimensions':   'Dimensions L/l/h',
    'layer.end_plates':   'Plaques terminales',
    'layer.side_supports':'Supports latéraux',
    'layer.brackets':     'Supports cellules',
    'layer.cells':        'Cellules',
    'layer.terminals':    'Bornes (+/−)',
    'layer.busbars':      'Barres / Bandes',
    'layer.separator_cards': 'Cartes séparatrices',
    'layer.show_all':     'Tout afficher',
    'layer.hide_all':     'Tout masquer',
    'layer.settings':     'Paramètres',
    'layer.cell_gap':     'Jeu entre cellules',
    'layer.end_plate':    'Plaque terminale',
    'layer.busbar_width': 'Largeur barre',

    // ConstraintsForm
    'form.title':        'Contraintes',
    'form.electrical':   'Cibles électriques',
    'form.energy':       'Énergie',
    'form.voltage':      'Tension',
    'form.current':      'Courant',
    'form.dod':          'PdD',
    'form.housing':      'Dimensions boîtier',
    'form.length_L':     'Longueur L',
    'form.width_l':      'Largeur l',
    'form.height_h':     'Hauteur h',
    'form.margin':       'Marge',
    'form.cell_gap':     'Jeu cellules',
    'form.end_plate':    'Plaque fin',
    'form.busbar_width': 'Larg. busbar',
    'form.config_mode':  'Mode de configuration',
    'form.mode_auto':    'Auto',
    'form.mode_manual':  'Manuel',
    'form.series':       'Série S',
    'form.parallel':     'Parallèle P',

    // Card titles / 3D viewer
    'cell.title':           'Sélecteur de cellule',
    'pack3d.title':              'Visualisation 3D du pack',
    'pack3d.fullscreen':         'Cliquer pour plein écran',
    'pack3d.fs_subtitle':        'Cliquer sur les préréglages pour changer de vue',
    'pack3d.fs_camera':          'Caméra :',
    'pack3d.fs_return':          'Retour à la mise en page',

    // AI Analysis FAB
    'ai.title':        'Analyse IA',
    'ai.busy':         'Tous les modèles IA sont occupés — réessayez dans une minute',
    'ai.no_key':       'IA non configurée — contactez votre administrateur',
    'ai.error':        'Échec de l\'analyse IA',
    'pack3d.cam.front':          'Avant',
    'pack3d.cam.back':           'Arrière',
    'pack3d.cam.top':            'Dessus',
    'pack3d.cam.bottom':         'Dessous',
    'pack3d.cam.left':           'Gauche',
    'pack3d.cam.right':          'Droite',
    'pack3d.cam.isometric':      'Isométrique',
    'pack3d.cam.free':           'Orbite libre',

    // CellSelector — search
    'cell.search_label':    'Rechercher une cellule',
    'cell.search_placeholder': 'Tapez pour rechercher...',
    'cell.no_results':      'Aucune cellule trouvée',

    // CellSelector — spec badges
    'cell.weight':          'Masse',
    'cell.capacity':        'Capacité',
    'cell.max_current':     'Courant max',
    'cell.voltage':         'Tension',

    // CellSelector — detail labels
    'cell.chemistry':       'Chimie',
    'cell.dimensions':      'Dimensions',
    'cell.swelling':        'Gonflement',
    'cell.cycle_life':      'Durée de vie',
    'cell.discharge':       'Décharge',
    'cell.charge':          'Charge',
    'cell.cutoff_v':        'Tension coupure',
    'cell.temp_range':      'Plage temp.',
    'cell.max_charge_t':    'T° charge max',

    // CellSelector — best matches
    'cell.best_matches':    'Meilleures correspondances',
    'cell.bm_loading':      'Chargement…',
    'cell.bm_error':        'Recommandations indisponibles',
    'cell.bm_empty':        'Aucune cellule ne correspond à ces contraintes',
    'cell.bm_near':         'proche',
    'cell.bm_short':        'Manque de',
    'cell.bm_fill':         'Remplissage',
    'cell.bm_margin':       'Marge',

    // CellSelector — buttons
    'btn.calculate':        'Calculer',
    'btn.calculating':      'Calcul en cours…',
    'btn.export_pdf':       'Exporter PDF',
    'btn.import':           'Importer',
    'btn.importing':        'Importation...',
    'btn.sync':             'Synchroniser',
    'btn.syncing':          'Synchronisation...',

    // Verdict
    'verdict.accept': '✓ ACCEPTÉ',
    'verdict.reject': '✗ REJETÉ',

    // ResultsPanel
    'results.electrical':   'Résultats électriques',
    'results.mechanical':   'Résultats mécaniques',
    'results.placeholder_elec': 'Définissez les contraintes et cliquez sur Calculer',
    'results.placeholder_mech': 'Les résultats apparaîtront après le calcul',
    'results.config':       'Configuration',
    'results.total_cells':  'Nb total cellules',
    'results.pack_voltage': 'Tension pack',
    'results.pack_current': 'Courant pack',
    'results.usable_energy':'Énergie utilisable',
    'results.total_weight': 'Masse totale',
    'results.final_L':      'L final',
    'results.final_W':      'l final',
    'results.final_H':      'H final',
    'results.margin_L':     'Marge L',
    'results.margin_W':     'Marge l',
    'results.margin_H':     'Marge H',

    // ComparePanel
    'compare.title':    'Comparaison de cellules',
    'compare.subtitle': 'Sélectionnez 2–3 cellules pour comparer leurs caractéristiques',
    'compare.hint':     'Sélectionnez au moins 2 cellules ci-dessus pour comparer.',
    'compare.slot':     'Cellule',
    'compare.search':   'Rechercher une cellule…',
    'compare.no_results': 'Aucun résultat',

    // ComparePanel spec row labels
    'spec.type':          'Type de cellule',
    'spec.chimie':        'Chimie',
    'spec.fabricant':     'Fabricant',
    'spec.tension':       'Tension nominale',
    'spec.capacite':      'Capacité',
    'spec.courant_max':   'Courant max',
    'spec.dimensions':    'Dimensions',
    'spec.masse':         'Masse',
    'spec.energie_mass':  'Énergie massique',
    'spec.energie_vol':   'Énergie volumique',
    'spec.cycle_life':    'Durée de vie (cycles)',
    'spec.dod':           'PdD référence',
    'spec.c_discharge':   'C-rate décharge max',
    'spec.c_charge':      'C-rate charge max',
    'spec.cutoff':        'Tension de coupure',
    'spec.temp_range':    'Plage de température',
    'spec.swelling':      'Gonflement',

    // HistoryPanel
    'history.title':     'Historique des calculs',
    'history.clear':     'Tout effacer',
    'history.loading':   'Chargement…',
    'history.empty':     'Aucun calcul enregistré.\nLancez un calcul pour voir l\'historique.',
    'history.restore':   'Cliquez pour restaurer ce calcul',

    // CataloguePanel
    'catalogue.title':    'Catalogue de cellules',
    'catalogue.search':   'Rechercher…',
    'catalogue.add':      'Ajouter',
    'catalogue.showing':  'Affichage de',
    'catalogue.cells':    'cellules',
    'catalogue.hint':     'Cliquez sur une ligne pour sélectionner la cellule',
    'catalogue.no_match': 'Aucune cellule ne correspond à votre recherche',
    'catalogue.filter.all':        'Tout',
    'catalogue.filter.prismatic':  'Prismatique',
    'catalogue.filter.cylindrical':'Cylindrique',
    'catalogue.filter.pouch':      'Pouch',
    'catalogue.col.name':      'Nom',
    'catalogue.col.type':      'Type',
    'catalogue.col.chemistry': 'Chimie',
    'catalogue.col.maker':     'Fabricant',
    'catalogue.col.voltage':   'Tension',
    'catalogue.col.capacity':  'Capacité',
    'catalogue.col.max_a':     'Courant max',
    'catalogue.col.mass':      'Masse (g)',
    'catalogue.col.cycles':    'Cycles',

    // AddCellModal
    'add_cell.title':      'Ajouter une cellule',
    'add_cell.required':   'Champs obligatoires',
    'add_cell.optional':   'Champs optionnels',
    'add_cell.show_opt':   'Afficher les champs optionnels',
    'add_cell.hide_opt':   'Masquer les champs optionnels',
    'add_cell.save':       'Ajouter',
    'add_cell.saving':     'Enregistrement…',
    'add_cell.cancel':     'Annuler',
    'add_cell.sync_ok':    'Sera synchronisé vers :',
    'add_cell.sync_warn':  'Aucun fichier Excel configuré.',
    'add_cell.sync_warn2': 'La cellule sera ajoutée à la base de données uniquement. Configurez un fichier source pour que les futures cellules soient aussi enregistrées dans Excel.',
    'add_cell.import_file':'Importer un fichier',
    'add_cell.importing':  'Importation…',
    'add_cell.sync_save':  'Enregistrer',
    // field labels
    'add_cell.f.name':         'Nom de la cellule',
    'add_cell.f.type':         'Type de cellule',
    'add_cell.f.voltage':      'Tension nominale (V)',
    'add_cell.f.capacity':     'Capacité (Ah)',
    'add_cell.f.max_current':  'Courant max (A)',
    'add_cell.f.diameter':     'Diamètre (mm)',
    'add_cell.f.diameter_hint':'Utilisé pour longueur + largeur',
    'add_cell.f.height':       'Hauteur (mm)',
    'add_cell.f.length':       'Longueur (mm)',
    'add_cell.f.length_hint':  'Épaisseur axe série',
    'add_cell.f.width':        'Largeur (mm)',
    'add_cell.f.width_hint':   'Axe parallèle',
    'add_cell.f.height_hint':  'Hauteur debout Y',
    'add_cell.f.mass':         'Masse (g)',
    'add_cell.f.swelling':     'Gonflement (%)',
    'add_cell.f.swelling_hint':'Rempli auto. selon la chimie',
    'add_cell.f.maker':        'Fabricant',
    'add_cell.f.chemistry':    'Chimie',
    'add_cell.f.cycle_life':   'Durée de vie (cycles)',
    'add_cell.f.dod':          'PdD réf. (%)',
    'add_cell.f.eol':          'Capacité fin de vie (%)',
    'add_cell.f.c_discharge':  'C-rate décharge',
    'add_cell.f.c_charge':     'C-rate charge',
    'add_cell.f.cutoff':       'Tension coupure',
    'add_cell.f.temp_min':     'Temp min (°C)',
    'add_cell.f.temp_max':     'Temp max (°C)',
    'add_cell.f.temp_charge':  'T° charge max (°C)',
    'add_cell.f.v_charge':     'Tension charge max',

    // App loading / error
    'app.loading': 'Chargement du catalogue de cellules…',
    'app.error':   'Impossible de joindre l\'API. Vérifiez que FastAPI tourne sur le port 8000.',
    'btn.retry':   'Réessayer',
  },
}

// ─── Context + Provider ───────────────────────────────────────────────────────
export const LanguageContext = createContext({ lang: 'en', setLang: () => {} })

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem('bd_lang') || 'en')
  const changeLang = (l) => { setLang(l); localStorage.setItem('bd_lang', l) }
  return (
    <LanguageContext.Provider value={{ lang, setLang: changeLang }}>
      {children}
    </LanguageContext.Provider>
  )
}

// ─── Hooks ────────────────────────────────────────────────────────────────────
export function useT() {
  const { lang } = useContext(LanguageContext)
  return (key) => T[lang]?.[key] ?? T.en[key] ?? key
}

export function useLang() {
  return useContext(LanguageContext)
}
