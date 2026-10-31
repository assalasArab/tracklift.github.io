/* ═══════════════════════════════════════════════════════════
   Scan morpho : tous les textes, en français et en anglais.
   Les conseils citent des exercices par leur id TrackLift ; le nom
   affiché vient de la base d'exercices (donc dans la bonne langue).
   ═══════════════════════════════════════════════════════════ */

const FR = {
  title: "Scan morpho",
  close: "Fermer",
  lead: "Envoie une photo de toi en pied : on mesure la longueur de tes segments et on te situe par rapport à plus de 6 000 personnes mesurées (étude ANSUR II). Touche ensuite une partie de ton corps pour savoir quels exercices te vont le mieux, et pourquoi.",
  photosTitle: "1. Tes photos",
  height: "Ta taille (cm)",
  sex: "Sexe",
  male: "Homme",
  female: "Femme",
  photoA: "Photo de face, bras écartés",
  photoAHint: "1 à 3 photos : plusieurs photos = mesure plus fiable",
  photoT: "Photo bras en croix (optionnelle)",
  photoTHint: "Mesure l'envergure, bien plus précise pour les bras",
  photosChosen: "{count} photos choisies",
  tips: [
    "De face, en entier, du haut du crâne aux pieds, avec un peu de marge",
    "Jambes tendues, pieds écartés à la largeur des épaules (l'espace entre tes jambes sert à mesurer tes cuisses)",
    "Bras tendus écartés à environ 45° (ou à l'horizontale pour la photo bras en croix, doigts tendus)",
    "Pieds nus, short ou legging près du corps, cheveux plaqués ou attachés",
    "Téléphone vertical, à hauteur de hanches, à 2-3 m (posé ou tenu par quelqu'un)"
  ],
  run: "Analyser ma morphologie",
  privacy: "Tes photos sont analysées sur ton téléphone : elles ne sont jamais envoyées ni enregistrées. Seules tes mesures sont gardées sur ton compte, visibles par toi seul.",
  notImage: "Ce fichier n'est pas une image.",
  keepFirst: "On garde les {count} premières photos.",
  loadingModel: "Chargement de l'outil de détection (30 Mo la première fois)…",
  analysingOne: "Analyse de ta photo…",
  analysingMany: "Analyse de la photo {i} sur {n}…",
  analysingT: "Analyse de la photo bras en croix…",
  noBody: "Aucun corps détecté. Reprends une photo en pied, bien éclairée, avec une seule personne.",
  failed: "L'analyse a échoué. Vérifie ta connexion (l'outil se télécharge au premier scan) et réessaie.",
  skipped: "{count} photo(s) sans corps détecté ont été ignorées.",
  spanFailed: "La photo bras en croix n'a pas pu être mesurée : la longueur des bras vient de la photo de face.",
  canvasLabel: "Ta photo annotée : touche une zone pour voir les conseils",
  canvasTLabel: "Photo bras en croix avec l'envergure mesurée",
  legend: { long: "Long", moyen: "Dans la moyenne", court: "Court", incertain: "Pas assez net" },
  download: "Télécharger ma photo annotée",
  restart: "Nouvelles photos",
  adviceTitle: "2. Tes conseils",
  emptyBefore: "Lance l'analyse, puis touche une zone de ton corps sur la photo (cuisse, bras, tronc…) pour voir ce que ta morphologie implique.",
  emptyAfter: "Touche ta cuisse, ton bras, ton tronc… sur la photo, ou choisis une zone ci-dessus.",
  emptySaved: "Choisis une zone ci-dessus pour revoir tes conseils.",
  lastScan: "Ton scan du {date}",
  photoNotKept: "Ta photo n'est pas gardée : refais un scan pour la revoir annotée.",
  erase: "Effacer",
  eraseConfirm: "Confirmer l'effacement",
  eraseLabel: "Effacer mon scan",
  quizTitle: "3. Tests rapides (2 minutes, optionnels)",
  badgeRedo: "À refaire",
  invalidPct: "Mesure faussée sur cette photo (posture ou vêtements) : pas de verdict.",
  reliability: { nette: "Fiabilité nette", probable: "Fiabilité probable", faible: "Fiabilité faible" },
  higherThan: "plus élevé que chez <b>{p} %</b> {who}",
  lowerThan: "plus bas que chez <b>{p} %</b> {who}",
  whoMale: "des hommes",
  whoFemale: "des femmes",
  barMid: "Moyenne",
  invalidNote: "Refais une photo en suivant les conseils (de face, jambes et bras tendus, pieds écartés, vêtements près du corps). En attendant, voici les conseils standards.",
  unclearNote: "Ta mesure penche vers « {side} » mais pas assez nettement pour trancher (marge d'erreur d'environ {pct} %) : voici les conseils standards.",
  unclearArmHint: "Ajoute la photo bras en croix pour une mesure bien plus précise.",
  goodTitle: "Exercices conseillés",
  adaptTitle: "À adapter",
  testsTitle: "Selon tes tests",
  armsBent: "Tes bras étaient pliés sur la photo : cette mesure est moins fiable.",
  disclaimerOne: "Estimation à partir d'une photo, comparée à l'étude ANSUR II (6 068 adultes mesurés). C'est une indication pour choisir tes variantes, pas une mesure médicale.",
  disclaimerMany: "Estimation à partir de photos, comparée à l'étude ANSUR II (6 068 adultes mesurés). C'est une indication pour choisir tes variantes, pas une mesure médicale.",
  seeExercise: "Voir l'exercice {name}",
  measure: {
    cm: "{v} cm",
    span: "Envergure {v} cm (bras en croix)",
    arm: "{total} cm (bras {h} + avant-bras {f})",
    shouldersNone: "Non mesurée",
    shoulders: "Rapport épaules / hanches : {v}"
  },
  spanPill: "Envergure · {cm} cm (×{ratio} ta taille)",
  ratio: {
    femur: "Rapport fémur / tronc", tibia: "Rapport tibia / fémur", trunk: "Longueur du tronc / taille",
    forearm: "Rapport avant-bras / bras", shoulders: "Rapport épaules / hanches",
    armSpan: "Envergure / taille", armSeg: "Longueur des bras / taille"
  },
  levels: { long: "Long", court: "Court", moyen: "Dans la moyenne" },
  shoulderLevels: { long: "Larges", court: "Étroites", moyen: "Dans la moyenne" },
  short: { femur: "Cuisse", tibia: "Jambe", trunk: "Tronc", arm: "Bras", forearm: "Avant-bras", shoulders: "Carrure" },
  warnings: {
    partial: "Une partie du corps est mal visible : prends la photo en pied, du crâne aux pieds.",
    scale: "Le haut du crâne n'a pas été détecté précisément : la conversion en cm est approximative.",
    hair: "Tes cheveux ajoutent de la hauteur sur la photo : on s'est calé sur tes oreilles. Pour plus de précision, plaque-les ou attache-les.",
    edge: "Ton corps touche le bord de la photo : recule un peu pour laisser de la marge en haut et en bas.",
    small: "Tu es petit sur la photo : rapproche-toi ou utilise une meilleure résolution.",
    legs: "Les jambes semblent pliées : mets-toi bien droit, jambes tendues.",
    arms: "Les bras sont pliés : les mesures des bras sont moins fiables. Laisse-les tendus, écartés du corps.",
    twist: "Tu sembles tourné de côté : mets-toi bien face à l'appareil.",
    crotch: "Écarte un peu les pieds (largeur d'épaules) : l'espace entre tes jambes sert à mesurer tes cuisses.",
    crotchHidden: "L'entrejambe n'est pas visible (vêtement trop long ou jambes trop serrées) : la mesure des cuisses est peu fiable. Refais la photo en short ou legging, pieds écartés.",
    spanNoMask: "Silhouette non détectée sur la photo bras en croix.",
    spanHand: "Une main sort de la photo : recule pour que les deux mains soient visibles.",
    spanTilt: "Les bras ne sont pas à l'horizontale : lève-les à hauteur d'épaules.",
    spanStraight: "Tends complètement les bras et les doigts.",
    spanTop: "Le haut du crâne ou les pieds ne sont pas visibles."
  },
  quiz: [
    {
      key: "ankle", title: "Cheville : test genou-mur",
      how: "Pieds nus face à un mur, avance le genou jusqu'à toucher le mur sans décoller le talon. Recule le pied tant que le genou touche encore. Distance entre ton gros orteil et le mur ?",
      options: [["raide", "Moins de 5 cm"], ["moyenne", "5 à 10 cm"], ["souple", "Plus de 10 cm"]]
    },
    {
      key: "biceps", title: "Biceps : longueur du muscle",
      how: "Bras plié à 90°, biceps contracté. Combien de doigts tiennent entre le bas du biceps et le pli du coude ?",
      options: [["long", "0 ou 1 doigt"], ["moyen", "2 doigts"], ["court", "3 doigts ou plus"]]
    },
    {
      key: "calf", title: "Mollet : longueur du muscle",
      how: "Debout sur la pointe des pieds, regarde où se termine le gros du mollet (le « V » à l'arrière de la jambe).",
      options: [["long", "Bas, vers la mi-jambe"], ["moyen", "Entre les deux"], ["court", "Haut, près du genou"]]
    }
  ],
  extras: {
    ankleStiffFemur: "Ta cheville est raide (test genou-mur) : c'est elle qui pèse le plus sur l'inclinaison du buste au squat, plus que la longueur des fémurs. Surélève les talons et travaille la mobilité.",
    ankleSuppleLong: "Bonne nouvelle : ta cheville est souple, ce qui compense en partie tes fémurs longs. Le squat avant ou talons surélevés te permettra de rester droit.",
    ankleUnknown: "Fais le test genou-mur (plus bas) : la mobilité de cheville influence l'inclinaison du buste au squat plus que les proportions.",
    ankleStiffTibia: "Cheville raide (moins de 5 cm au test genou-mur) : étire les mollets et travaille la mobilité avant tes séances de jambes.",
    calfShort: "Mollet « court » (le muscle s'arrête haut) : c'est surtout génétique, ça change l'aspect plus que le potentiel de progrès. Les mollets debout jambes tendues font beaucoup plus grossir le gastrocnémien que la version assise (Kinoshita 2023) : fais-en ta base, avec une pause en bas, talon étiré.",
    calfLong: "Mollet « long » (le muscle descend bas) : bon potentiel de volume. Base ton travail sur les mollets debout, jambes tendues, plus efficaces que la version assise.",
    spanMissing: "Pour une mesure des bras plus fiable, ajoute la photo bras en croix : l'envergure se mesure directement sur ta silhouette.",
    bicepsShort: "Biceps « court » (3 doigts ou plus au pli du coude) : c'est génétique, ça donne un pic plus haut mais ne limite pas ta progression. Les curls qui étirent le biceps (bras derrière le corps, curl incliné) sollicitent davantage sa partie basse.",
    bicepsLong: "Biceps « long » (0 à 1 doigt) : bon potentiel de volume. Garde des curls en position étirée dans ta routine.",
    triceps: "Pour les triceps, l'extension au-dessus de la tête fait plus grossir les trois chefs que l'extension à la poulie haute (Maeo 2023)."
  },
  zones: {
    femur: {
      label: "Cuisse (fémur)",
      long: {
        title: "Fémurs longs par rapport au tronc",
        why: "Au squat, un fémur long éloigne tes hanches de la barre. Pour garder l'équilibre au-dessus des pieds, ton buste doit se pencher davantage, ce qui charge plus le bas du dos et les fessiers que les quadriceps. Ce n'est pas un défaut : il faut choisir des variantes qui te laissent rester droit.",
        good: [
          ["heel-elevated-squat", "Les talons surélevés laissent les genoux avancer : le buste reste plus droit et les quadriceps travaillent vraiment."],
          ["front-squat", "La barre devant oblige à rester vertical, ce qui compense la longueur de tes fémurs."],
          ["hack-squat", "Le dos est calé contre la machine : tu charges les cuisses sans te battre avec ton inclinaison."],
          ["bulgarian-split-squat", "Une jambe à la fois, buste droit : très efficace pour les grands segments, sans compression du dos."],
          ["sumo-deadlift", "Pieds écartés, tes fémurs « raccourcissent » dans le plan du mouvement : départ plus facile qu'en classique."],
          ["hip-thrust", "Tes longs leviers sont un avantage pour les fessiers, sans contrainte pour le dos."]
        ],
        adapt: [["squat", "Garde-le si tu aimes, mais écarte les pieds, pointes vers l'extérieur, et accepte une inclinaison plus marquée."]]
      },
      court: {
        title: "Fémurs courts par rapport au tronc",
        why: "Avec un fémur court, tes hanches restent proches de la barre : tu descends au squat avec un buste presque vertical. C'est la morphologie la plus favorable au squat. Au soulevé de terre classique, en revanche, tes hanches partent bas et le départ du sol est plus difficile.",
        good: [
          ["squat", "Ton point fort : tu peux le pousser lourd, buste droit, avec une belle amplitude."],
          ["pause-squat", "Ta position en bas est stable : la pause renforce le démarrage sans risque."],
          ["front-squat", "Tu rentres naturellement dans la position, excellent pour les quadriceps."],
          ["romanian-deadlift", "Pour les ischios, la version roumaine part du haut et évite le départ difficile du sol."]
        ],
        adapt: [["deadlift", "Faisable, mais le départ du sol est ton point faible : travaille-le en répétitions propres plutôt qu'en maxis."]]
      },
      moyen: {
        title: "Fémurs dans la moyenne",
        why: "Le rapport entre tes cuisses et ton tronc est proche de la moyenne : les mouvements de base te conviennent tels quels.",
        good: [
          ["squat", "Le squat classique est adapté à tes proportions."],
          ["deadlift", "Le soulevé de terre classique aussi, sans désavantage de levier."],
          ["leg-press", "Pour ajouter du volume aux cuisses sans fatiguer le dos."]
        ],
        adapt: []
      }
    },
    tibia: {
      label: "Jambe (tibia)",
      long: {
        title: "Tibias longs par rapport au fémur",
        why: "Un tibia long permet aux genoux d'avancer loin devant les pieds. Ça compense la longueur du fémur : tu peux squatter profond en gardant le buste droit, avec des quadriceps très sollicités.",
        good: [
          ["front-squat", "Tu atteins facilement la profondeur, buste droit : idéal pour les quadriceps."],
          ["goblet-squat", "Charge devant, genoux qui avancent : la position la plus naturelle pour toi."],
          ["leg-extension", "Pour finir les quadriceps en isolation."]
        ],
        adapt: []
      },
      court: {
        title: "Tibias courts par rapport au fémur",
        why: "Avec un tibia court, les genoux avancent peu : en bas du squat, la cheville se bloque plus vite et le buste compense en se penchant. Surélever les talons ou utiliser une machine règle le problème.",
        good: [
          ["heel-elevated-squat", "La cale sous les talons donne l'amplitude de cheville qui te manque."],
          ["hack-squat", "La machine guide le mouvement, tu places les pieds où il faut."],
          ["leg-press", "Aucune contrainte de cheville, tu choisis l'amplitude."]
        ],
        adapt: [["squat", "Utilise des chaussures à talon ou une petite cale si tu sens les talons décoller."]]
      },
      moyen: {
        title: "Tibias dans la moyenne",
        why: "Le rapport tibia / fémur est classique : pas de limite particulière à prévoir.",
        good: [["squat", "Aucune adaptation nécessaire."], ["goblet-squat", "Bon exercice pour travailler la profondeur."]],
        adapt: []
      }
    },
    trunk: {
      label: "Tronc",
      long: {
        title: "Tronc long",
        why: "Un tronc long rend le squat plus confortable (le buste reste droit), mais il allonge le bras de levier sur le bas du dos dès que tu te penches : rowing buste penché, soulevé de terre. Il faut un gainage solide et des variantes qui soutiennent le buste.",
        good: [
          ["squat", "Ton tronc long t'aide à rester vertical : le squat est un point fort."],
          ["chest-supported-db-row", "Le buste appuyé enlève la charge du bas du dos pendant que tu travailles le dos."],
          ["seated-cable-row", "Même logique : dos travaillé, lombaires protégées."],
          ["plank", "Le gainage est ta priorité pour protéger un long levier lombaire."]
        ],
        adapt: [["barbell-row", "Garde des charges modérées : penché en avant, ton bas du dos travaille plus que la moyenne."]]
      },
      court: {
        title: "Tronc court",
        why: "Un tronc court place tes épaules près des hanches : au soulevé de terre, ton dos est plus vertical et moins exposé, mais au squat tu dois te pencher davantage pour équilibrer la barre.",
        good: [
          ["deadlift", "Tu pars avec un dos plus droit que la moyenne : le classique te va bien."],
          ["barbell-row", "Le levier sur le bas du dos est court : le rowing penché passe mieux."],
          ["front-squat", "Pour compenser l'inclinaison au squat."]
        ],
        adapt: [["squat", "Inclinaison du buste plus marquée : soigne le gainage et la position de la barre."]]
      },
      moyen: {
        title: "Tronc dans la moyenne",
        why: "La longueur de ton tronc est proche de la moyenne : aucun mouvement de base ne te désavantage particulièrement.",
        good: [["deadlift", "Pas d'adaptation nécessaire."], ["barbell-row", "Pas d'adaptation nécessaire."]],
        adapt: []
      }
    },
    arm: {
      label: "Bras (épaule → poignet)",
      long: {
        title: "Bras longs",
        why: "Des bras longs raccourcissent le trajet au soulevé de terre (la barre est déjà plus haute quand tu l'attrapes), mais l'allongent au développé couché et aux tractions. Le bras de levier sur l'épaule est aussi plus grand : élévations latérales et écartés paraissent plus lourds.",
        good: [
          ["deadlift", "Ton avantage : moins de distance à parcourir, départ plus haut."],
          ["romanian-deadlift", "Tu atteins une belle amplitude sans arrondir le dos."],
          ["db-bench-press", "Les haltères laissent tes coudes trouver leur trajectoire et ménagent l'épaule."],
          ["spoto-press", "Arrêt juste au-dessus de la poitrine : renforce la partie la plus longue de ton trajet."],
          ["lat-pulldown", "Pour construire le dos sans être limité par le nombre de tractions."]
        ],
        adapt: [
          ["bench-press", "Prise un peu plus large pour raccourcir le trajet, omoplates bien serrées."],
          ["lateral-raise", "Charge plus légère que les autres : ton levier est plus long, c'est normal."]
        ]
      },
      court: {
        title: "Bras courts",
        why: "Des bras courts sont un avantage au développé couché et aux dips (trajet court), mais un désavantage au soulevé de terre classique : tu dois descendre les hanches plus bas pour attraper la barre.",
        good: [
          ["bench-press", "Ton point fort : le trajet est court, tu peux pousser lourd."],
          ["dips", "Amplitude courte et bonne stabilité de l'épaule."],
          ["sumo-deadlift", "Pieds écartés, tes mains tombent plus bas : la barre est plus facile à attraper."],
          ["pull-up", "Les tractions sont plus faciles avec des bras courts : profites-en."]
        ],
        adapt: [["deadlift", "Possible, mais ton départ est plus bas que la moyenne : le sumo ou le roumain peuvent mieux passer."]]
      },
      moyen: {
        title: "Bras dans la moyenne",
        why: "La longueur de tes bras est proche de la moyenne : pas de levier particulier à compenser au développé couché ou au soulevé de terre.",
        good: [["bench-press", "Pas d'adaptation nécessaire."], ["deadlift", "Pas d'adaptation nécessaire."], ["pull-up", "Pas d'adaptation nécessaire."]],
        adapt: []
      }
    },
    forearm: {
      label: "Avant-bras",
      long: {
        title: "Avant-bras longs par rapport au bras",
        why: "Plus l'avant-bras est long, plus la charge est loin du coude pendant un curl : le biceps fournit plus d'effort pour un même poids. Tu seras « moins fort » aux curls que d'autres, ce qui ne dit rien de la taille de tes biceps.",
        good: [
          ["cable-curl", "La poulie garde une tension constante, mieux qu'une charge très lourde."],
          ["preacher-curl", "Le pupitre bloque le bras et isole le biceps sans tricher avec le dos."],
          ["hammer-curl", "Travaille aussi le brachial et les avant-bras."]
        ],
        adapt: [["barbell-curl", "Ne compare pas tes charges : privilégie l'exécution stricte."]]
      },
      court: {
        title: "Avant-bras courts par rapport au bras",
        why: "Un avant-bras court rapproche la charge du coude : tu soulèves plus lourd aux curls, mais le biceps travaille moins par kilo. Augmente le volume plutôt que la charge.",
        good: [
          ["barbell-curl", "Tu peux charger : bon exercice de base pour toi."],
          ["bicep-curl", "Ajoute du volume pour compenser le levier favorable."]
        ],
        adapt: []
      },
      moyen: {
        title: "Avant-bras dans la moyenne",
        why: "Le rapport avant-bras / bras est classique : les curls se comportent normalement.",
        good: [["bicep-curl", "Pas d'adaptation nécessaire."], ["hammer-curl", "Pas d'adaptation nécessaire."]],
        adapt: []
      }
    },
    shoulders: {
      label: "Carrure (épaules / hanches)",
      long: {
        title: "Épaules larges par rapport aux hanches",
        why: "Une carrure large donne naturellement une prise plus large au développé couché et aux tractions. Ton haut du corps est déjà mis en avant : tu peux équilibrer avec le bas.",
        good: [
          ["wide-grip-pull-ups", "La prise large correspond à la largeur de tes épaules."],
          ["bench-press", "Prise large confortable, trajet raccourci."],
          ["hip-thrust", "Pour équilibrer la silhouette avec les fessiers."]
        ],
        adapt: []
      },
      court: {
        title: "Épaules étroites par rapport aux hanches",
        why: "Avec une carrure étroite, les prises très larges forcent l'épaule. Choisis des prises neutres ou moyennes, et donne la priorité aux deltoïdes latéraux pour élargir la silhouette.",
        good: [
          ["lateral-raise", "Les deltoïdes latéraux élargissent visuellement le haut du corps."],
          ["cable-lateral-raise", "Tension constante, idéale pour ce muscle."],
          ["neutral-grip-pull-ups", "Prise neutre : plus confortable pour une carrure étroite."],
          ["close-grip-bench-press", "Prise proche de la largeur des épaules, moins de contrainte articulaire."]
        ],
        adapt: [["wide-grip-pull-ups", "Évite les prises trop larges : mains à peine plus écartées que les épaules."]]
      },
      moyen: {
        title: "Carrure dans la moyenne",
        why: "Le rapport épaules / hanches est équilibré : prises classiques au développé couché et aux tractions.",
        good: [["lateral-raise", "Pour développer la largeur."], ["pull-up", "Prise classique."]],
        adapt: []
      }
    }
  }
};

const EN = {
  title: "Body scan",
  close: "Close",
  lead: "Send a full-length photo of yourself: we measure the length of your limbs and compare you with more than 6,000 measured people (ANSUR II study). Then tap a part of your body to see which exercises suit you best, and why.",
  photosTitle: "1. Your photos",
  height: "Your height (cm)",
  sex: "Sex",
  male: "Male",
  female: "Female",
  photoA: "Front photo, arms out",
  photoAHint: "1 to 3 photos: more photos = more reliable measurement",
  photoT: "T-pose photo (optional)",
  photoTHint: "Measures your arm span, much more precise for your arms",
  photosChosen: "{count} photos selected",
  tips: [
    "Facing the camera, full body, from the top of your head to your feet, with some margin",
    "Legs straight, feet shoulder-width apart (the gap between your legs is used to measure your thighs)",
    "Arms straight, out at about 45° (or horizontal for the T-pose photo, fingers straight)",
    "Barefoot, in shorts or tight leggings, hair flattened or tied back",
    "Phone upright, at hip height, 2-3 m away (propped up or held by someone)"
  ],
  run: "Analyze my proportions",
  privacy: "Your photos are analyzed on your phone: they're never sent or stored. Only your measurements are kept in your account, visible only to you.",
  notImage: "This file isn't an image.",
  keepFirst: "We're keeping the first {count} photos.",
  loadingModel: "Loading the detection tool (30 MB the first time)…",
  analysingOne: "Analyzing your photo…",
  analysingMany: "Analyzing photo {i} of {n}…",
  analysingT: "Analyzing the T-pose photo…",
  noBody: "No body detected. Take a new full-length photo, well lit, with only one person.",
  failed: "The analysis failed. Check your connection (the tool downloads on your first scan) and try again.",
  skipped: "{count} photo(s) with no body detected were skipped.",
  spanFailed: "The T-pose photo couldn't be measured: your arm length comes from the front photo.",
  canvasLabel: "Your annotated photo: tap an area to see the advice",
  canvasTLabel: "T-pose photo with your measured arm span",
  legend: { long: "Long", moyen: "Average", court: "Short", incertain: "Not clear enough" },
  download: "Download my annotated photo",
  restart: "New photos",
  adviceTitle: "2. Your advice",
  emptyBefore: "Run the analysis, then tap a part of your body on the photo (thigh, arm, torso…) to see what your proportions mean.",
  emptyAfter: "Tap your thigh, arm, torso… on the photo, or pick an area above.",
  emptySaved: "Pick an area above to see your advice again.",
  lastScan: "Your scan from {date}",
  photoNotKept: "Your photo isn't kept: scan again to see it annotated.",
  erase: "Delete",
  eraseConfirm: "Confirm deletion",
  eraseLabel: "Delete my scan",
  quizTitle: "3. Quick tests (2 minutes, optional)",
  badgeRedo: "Redo",
  invalidPct: "This photo skews the measurement (posture or clothes): no verdict.",
  reliability: { nette: "Clear result", probable: "Likely result", faible: "Weak result" },
  higherThan: "higher than <b>{p}%</b> of {who}",
  lowerThan: "lower than <b>{p}%</b> of {who}",
  whoMale: "men",
  whoFemale: "women",
  barMid: "Average",
  invalidNote: "Take a new photo following the tips (facing the camera, legs and arms straight, feet apart, tight clothes). Meanwhile, here is the standard advice.",
  unclearNote: "Your measurement leans towards “{side}” but not clearly enough to decide (margin of error around {pct}%): here is the standard advice.",
  unclearArmHint: "Add the T-pose photo for a much more precise measurement.",
  goodTitle: "Recommended exercises",
  adaptTitle: "To adapt",
  testsTitle: "Based on your tests",
  armsBent: "Your arms were bent in the photo: this measurement is less reliable.",
  disclaimerOne: "Estimate from a photo, compared with the ANSUR II study (6,068 measured adults). It's a guide for choosing your variations, not a medical measurement.",
  disclaimerMany: "Estimate from photos, compared with the ANSUR II study (6,068 measured adults). It's a guide for choosing your variations, not a medical measurement.",
  seeExercise: "See the exercise {name}",
  measure: {
    cm: "{v} cm",
    span: "Arm span {v} cm (T-pose)",
    arm: "{total} cm (upper arm {h} + forearm {f})",
    shouldersNone: "Not measured",
    shoulders: "Shoulder / hip ratio: {v}"
  },
  spanPill: "Arm span · {cm} cm (×{ratio} your height)",
  ratio: {
    femur: "Femur / torso ratio", tibia: "Shin / femur ratio", trunk: "Torso length / height",
    forearm: "Forearm / upper arm ratio", shoulders: "Shoulder / hip ratio",
    armSpan: "Arm span / height", armSeg: "Arm length / height"
  },
  levels: { long: "Long", court: "Short", moyen: "Average" },
  shoulderLevels: { long: "Wide", court: "Narrow", moyen: "Average" },
  short: { femur: "Thigh", tibia: "Shin", trunk: "Torso", arm: "Arm", forearm: "Forearm", shoulders: "Shoulders" },
  warnings: {
    partial: "Part of your body is hard to see: take a full-length photo, from the top of your head to your feet.",
    scale: "The top of your head wasn't detected precisely: the conversion to cm is approximate.",
    hair: "Your hair adds height in the photo: we used your ears instead. For more precision, flatten or tie it back.",
    edge: "Your body touches the edge of the photo: step back a little to leave space at the top and bottom.",
    small: "You're small in the photo: move closer or use a higher resolution.",
    legs: "Your legs look bent: stand up straight with your legs straight.",
    arms: "Your arms are bent: arm measurements are less reliable. Keep them straight, away from your body.",
    twist: "You seem turned to the side: face the camera squarely.",
    crotch: "Spread your feet a little (shoulder width): the gap between your legs is used to measure your thighs.",
    crotchHidden: "Your crotch isn't visible (clothes too long or legs too close together): the thigh measurement is unreliable. Retake the photo in shorts or leggings, feet apart.",
    spanNoMask: "Silhouette not detected on the T-pose photo.",
    spanHand: "A hand is outside the photo: step back so both hands are visible.",
    spanTilt: "Your arms aren't horizontal: raise them to shoulder height.",
    spanStraight: "Fully straighten your arms and fingers.",
    spanTop: "The top of your head or your feet aren't visible."
  },
  quiz: [
    {
      key: "ankle", title: "Ankle: knee-to-wall test",
      how: "Barefoot, facing a wall, push your knee forward until it touches the wall without lifting your heel. Move your foot back as long as your knee still touches. Distance between your big toe and the wall?",
      options: [["raide", "Under 5 cm"], ["moyenne", "5 to 10 cm"], ["souple", "Over 10 cm"]]
    },
    {
      key: "biceps", title: "Biceps: muscle length",
      how: "Arm bent at 90°, biceps flexed. How many fingers fit between the bottom of your biceps and the elbow crease?",
      options: [["long", "0 or 1 finger"], ["moyen", "2 fingers"], ["court", "3 fingers or more"]]
    },
    {
      key: "calf", title: "Calf: muscle length",
      how: "Standing on your toes, look at where the bulk of your calf ends (the “V” at the back of your leg).",
      options: [["long", "Low, near mid-shin"], ["moyen", "In between"], ["court", "High, near the knee"]]
    }
  ],
  extras: {
    ankleStiffFemur: "Your ankle is stiff (knee-to-wall test): it affects how far your torso leans in a squat more than your femur length does. Raise your heels and work on your mobility.",
    ankleSuppleLong: "Good news: your ankle is mobile, which partly offsets your long femurs. Front squats or heel-elevated squats will help you stay upright.",
    ankleUnknown: "Take the knee-to-wall test (below): ankle mobility affects your torso lean in a squat more than your proportions do.",
    ankleStiffTibia: "Stiff ankle (under 5 cm on the knee-to-wall test): stretch your calves and work on your mobility before your leg sessions.",
    calfShort: "“Short” calf (the muscle ends high): it's mostly genetic and changes how it looks more than how much it can grow. Standing calf raises with straight legs grow the gastrocnemius much more than the seated version (Kinoshita 2023): make them your base, with a pause at the bottom, heel stretched.",
    calfLong: "“Long” calf (the muscle reaches low): good potential for size. Base your calf work on standing, straight-leg raises, which beat the seated version.",
    spanMissing: "For a more reliable arm measurement, add the T-pose photo: your arm span is measured directly on your silhouette.",
    bicepsShort: "“Short” biceps (3 fingers or more at the elbow crease): it's genetic, it gives a higher peak but doesn't limit your progress. Curls that stretch the biceps (arms behind your body, incline curls) work its lower part more.",
    bicepsLong: "“Long” biceps (0 to 1 finger): good potential for size. Keep curls in a stretched position in your routine.",
    triceps: "For your triceps, overhead extensions grow all three heads more than pushdowns (Maeo 2023)."
  },
  zones: {
    femur: {
      label: "Thigh (femur)",
      long: {
        title: "Long femurs relative to your torso",
        why: "In a squat, a long femur pushes your hips further from the bar. To stay balanced over your feet, your torso has to lean further forward, which loads your lower back and glutes more than your quads. It's not a flaw: just pick variations that let you stay upright.",
        good: [
          ["heel-elevated-squat", "Raised heels let your knees travel forward: your torso stays more upright and your quads really work."],
          ["front-squat", "The bar in front forces you to stay vertical, which offsets the length of your femurs."],
          ["hack-squat", "Your back is supported by the machine: you load your thighs without fighting your forward lean."],
          ["bulgarian-split-squat", "One leg at a time, torso upright: very effective for long limbs, without compressing your back."],
          ["sumo-deadlift", "With a wide stance, your femurs get “shorter” in the plane of the lift: an easier start than the conventional deadlift."],
          ["hip-thrust", "Your long levers are an advantage for your glutes, with no stress on your back."]
        ],
        adapt: [["squat", "Keep it if you like it, but widen your stance, toes out, and accept a bit more forward lean."]]
      },
      court: {
        title: "Short femurs relative to your torso",
        why: "With short femurs, your hips stay close to the bar: you squat down with an almost vertical torso. It's the most squat-friendly build. In a conventional deadlift, however, your hips start low and breaking the bar off the floor is harder.",
        good: [
          ["squat", "Your strong point: you can push it heavy, torso upright, with a great range of motion."],
          ["pause-squat", "Your bottom position is stable: pausing builds your drive out of the hole safely."],
          ["front-squat", "You get into position naturally, excellent for your quads."],
          ["romanian-deadlift", "For your hamstrings, the Romanian version starts from the top and skips the hard start off the floor."]
        ],
        adapt: [["deadlift", "Doable, but the start off the floor is your weak point: train it with clean reps rather than max attempts."]]
      },
      moyen: {
        title: "Average femurs",
        why: "The ratio between your thighs and your torso is close to average: the basic lifts suit you as they are.",
        good: [
          ["squat", "The classic squat suits your proportions."],
          ["deadlift", "So does the conventional deadlift, with no leverage disadvantage."],
          ["leg-press", "To add thigh volume without tiring your back."]
        ],
        adapt: []
      }
    },
    tibia: {
      label: "Lower leg (shin)",
      long: {
        title: "Long shins relative to your femurs",
        why: "A long shin lets your knees travel far past your toes. That offsets femur length: you can squat deep while keeping your torso upright, with your quads working hard.",
        good: [
          ["front-squat", "You hit depth easily with an upright torso: ideal for your quads."],
          ["goblet-squat", "Weight in front, knees travelling forward: the most natural position for you."],
          ["leg-extension", "To finish your quads in isolation."]
        ],
        adapt: []
      },
      court: {
        title: "Short shins relative to your femurs",
        why: "With short shins, your knees travel forward less: at the bottom of a squat your ankle locks sooner and your torso compensates by leaning. Raising your heels or using a machine solves it.",
        good: [
          ["heel-elevated-squat", "The wedge under your heels gives you the ankle range you're missing."],
          ["hack-squat", "The machine guides the movement and you place your feet where they need to be."],
          ["leg-press", "No ankle constraint, you choose the range."]
        ],
        adapt: [["squat", "Use lifting shoes or a small wedge if you feel your heels lifting."]]
      },
      moyen: {
        title: "Average shins",
        why: "Your shin-to-femur ratio is typical: no particular limit to plan for.",
        good: [["squat", "No adjustment needed."], ["goblet-squat", "A good exercise to work on depth."]],
        adapt: []
      }
    },
    trunk: {
      label: "Torso",
      long: {
        title: "Long torso",
        why: "A long torso makes squatting more comfortable (your torso stays upright), but it lengthens the lever on your lower back as soon as you lean forward: bent-over rows, deadlifts. You need a solid brace and variations that support your torso.",
        good: [
          ["squat", "Your long torso helps you stay vertical: the squat is a strong point."],
          ["chest-supported-db-row", "Chest support takes the load off your lower back while you train your back."],
          ["seated-cable-row", "Same idea: back trained, lower back protected."],
          ["plank", "Core bracing is your priority to protect a long lower-back lever."]
        ],
        adapt: [["barbell-row", "Keep the weight moderate: bent forward, your lower back works more than average."]]
      },
      court: {
        title: "Short torso",
        why: "A short torso puts your shoulders close to your hips: in a deadlift your back is more upright and less exposed, but in a squat you have to lean further forward to balance the bar.",
        good: [
          ["deadlift", "You start with a more upright back than average: the conventional deadlift suits you."],
          ["barbell-row", "The lever on your lower back is short: bent-over rows feel better."],
          ["front-squat", "To offset your forward lean in the squat."]
        ],
        adapt: [["squat", "Your torso leans more: focus on bracing and bar position."]]
      },
      moyen: {
        title: "Average torso",
        why: "Your torso length is close to average: none of the basic lifts puts you at a particular disadvantage.",
        good: [["deadlift", "No adjustment needed."], ["barbell-row", "No adjustment needed."]],
        adapt: []
      }
    },
    arm: {
      label: "Arm (shoulder → wrist)",
      long: {
        title: "Long arms",
        why: "Long arms shorten the bar path in the deadlift (the bar is already higher when you grab it), but lengthen it in the bench press and pull-ups. The lever on your shoulder is also longer: lateral raises and flyes feel heavier.",
        good: [
          ["deadlift", "Your advantage: less distance to cover, a higher start."],
          ["romanian-deadlift", "You reach a great range of motion without rounding your back."],
          ["db-bench-press", "Dumbbells let your elbows find their path and spare your shoulders."],
          ["spoto-press", "Stopping just above your chest strengthens the longest part of your press."],
          ["lat-pulldown", "To build your back without being limited by how many pull-ups you can do."]
        ],
        adapt: [
          ["bench-press", "Grip a little wider to shorten the bar path, shoulder blades pinched."],
          ["lateral-raise", "Lighter weight than others: your lever is longer, that's normal."]
        ]
      },
      court: {
        title: "Short arms",
        why: "Short arms are an advantage in the bench press and dips (short range), but a disadvantage in the conventional deadlift: you have to drop your hips lower to reach the bar.",
        good: [
          ["bench-press", "Your strong point: the bar path is short, you can push heavy."],
          ["dips", "Short range of motion and good shoulder stability."],
          ["sumo-deadlift", "With a wide stance, your hands hang lower: the bar is easier to reach."],
          ["pull-up", "Pull-ups are easier with short arms: make the most of it."]
        ],
        adapt: [["deadlift", "Possible, but you start lower than average: sumo or Romanian may suit you better."]]
      },
      moyen: {
        title: "Average arms",
        why: "Your arm length is close to average: no particular leverage to compensate for in the bench press or the deadlift.",
        good: [["bench-press", "No adjustment needed."], ["deadlift", "No adjustment needed."], ["pull-up", "No adjustment needed."]],
        adapt: []
      }
    },
    forearm: {
      label: "Forearm",
      long: {
        title: "Long forearms relative to your upper arm",
        why: "The longer your forearm, the further the weight sits from your elbow during a curl: your biceps works harder for the same weight. You'll be “weaker” at curls than others, which says nothing about the size of your biceps.",
        good: [
          ["cable-curl", "The cable keeps constant tension, better than a very heavy weight."],
          ["preacher-curl", "The pad locks your arm and isolates your biceps without cheating with your back."],
          ["hammer-curl", "Also trains the brachialis and your forearms."]
        ],
        adapt: [["barbell-curl", "Don't compare your weights: focus on strict form."]]
      },
      court: {
        title: "Short forearms relative to your upper arm",
        why: "A short forearm brings the weight closer to your elbow: you lift heavier in curls, but your biceps works less per kilo. Increase volume rather than weight.",
        good: [
          ["barbell-curl", "You can load up: a good basic exercise for you."],
          ["bicep-curl", "Add volume to offset your favourable leverage."]
        ],
        adapt: []
      },
      moyen: {
        title: "Average forearms",
        why: "Your forearm-to-upper-arm ratio is typical: curls behave normally.",
        good: [["bicep-curl", "No adjustment needed."], ["hammer-curl", "No adjustment needed."]],
        adapt: []
      }
    },
    shoulders: {
      label: "Shoulder width (shoulders / hips)",
      long: {
        title: "Wide shoulders relative to your hips",
        why: "A wide frame naturally gives you a wider grip in the bench press and pull-ups. Your upper body already stands out: you can balance it with your lower body.",
        good: [
          ["wide-grip-pull-ups", "A wide grip matches your shoulder width."],
          ["bench-press", "A comfortable wide grip, shorter bar path."],
          ["hip-thrust", "To balance your physique with your glutes."]
        ],
        adapt: []
      },
      court: {
        title: "Narrow shoulders relative to your hips",
        why: "With a narrow frame, very wide grips strain the shoulder. Choose neutral or medium grips, and prioritize your side delts to widen your silhouette.",
        good: [
          ["lateral-raise", "Side delts visually widen your upper body."],
          ["cable-lateral-raise", "Constant tension, ideal for this muscle."],
          ["neutral-grip-pull-ups", "Neutral grip: more comfortable for a narrow frame."],
          ["close-grip-bench-press", "A grip close to shoulder width, less joint stress."]
        ],
        adapt: [["wide-grip-pull-ups", "Avoid grips that are too wide: hands just outside your shoulders."]]
      },
      moyen: {
        title: "Average shoulder width",
        why: "Your shoulder-to-hip ratio is balanced: standard grips in the bench press and pull-ups.",
        good: [["lateral-raise", "To build width."], ["pull-up", "Standard grip."]],
        adapt: []
      }
    }
  }
};

/* Français : espace insécable avant « : ; ! ? % » et à l'intérieur des guillemets */
function frenchSpaces(value) {
  if (typeof value === "string") {
    return value.replace(/ ([:;!?%»])/g, " $1").replace(/« /g, "« ");
  }
  if (Array.isArray(value)) return value.map(frenchSpaces);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, frenchSpaces(item)]));
  }
  return value;
}

const TEXTS = { fr: frenchSpaces(FR), en: EN };

export const morphoText = lang => TEXTS[lang] || TEXTS.fr;

/* « {name} » → valeur */
export const fill = (text, vars = {}) => String(text).replace(/\{(\w+)\}/g, (_, key) => (vars[key] == null ? `{${key}}` : String(vars[key])));
