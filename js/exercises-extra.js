/* Exercices ajoutés à TrackLift pour les muscles peu couverts par RepDB
   (arrière d'épaule, dentelé, coiffe des rotateurs, tibial, adducteurs).
   Textes en français (description_fr, instructions_fr, tips_fr).
   Image : seulement quand une illustration RepDB montre vraiment le même mouvement. */

const ex = (fields) => ({
  bodyweight: false,
  unilateral: false,
  secondary_muscles: [],
  secondary_detail: [],
  similar_exercises: [],
  description: "",
  instructions: [],
  tips: [],
  ...fields,
  extra: true
});

export const EXTRA_EXERCISES = [
  /* ─── Arrière d'épaule ─── */
  ex({
    id: "tl-incline-y-raise", name: "Incline Dumbbell Y-Raise", name_fr: "Élévation en Y sur banc incliné",
    type: "pull", muscle_focus: "epaules", muscle_portion: "posterior_deltoid", contraction_type: "isolation",
    primary_muscles: ["posterior_deltoid", "trapezius"], secondary_muscles: ["dos"], secondary_detail: ["rhomboids", "supraspinatus"],
    equipment: "halteres", difficulty: "debutant",
    description_fr: "Allongé sur le ventre sur un banc incliné, tu montes les haltères en Y au-dessus de la tête. Excellent pour l'arrière d'épaule et le bas des trapèzes.",
    instructions_fr: ["Règle le banc à environ 30° et allonge-toi sur le ventre, poitrine collée au dossier.", "Laisse pendre les haltères, pouces vers le haut.", "Monte les bras en diagonale pour former un Y, jusqu'à hauteur des oreilles.", "Marque une pause en haut en serrant le haut du dos.", "Redescends lentement."],
    tips_fr: ["Prends très léger : 2 à 5 kg suffisent.", "Ne hausse pas les épaules vers les oreilles."],
    similar_exercises: ["tl-chest-supported-reverse-fly", "dumbbell-reverse-fly", "face-pull"]
  }),
  ex({
    id: "tl-chest-supported-reverse-fly", name: "Chest-Supported Reverse Fly", name_fr: "Oiseau allongé sur banc incliné",
    type: "pull", muscle_focus: "epaules", muscle_portion: "posterior_deltoid", contraction_type: "isolation",
    primary_muscles: ["posterior_deltoid"], secondary_muscles: ["dos", "trapeces"], secondary_detail: ["rhomboids", "trapezius"],
    equipment: "halteres", difficulty: "debutant",
    description_fr: "L'oiseau classique, mais poitrine appuyée sur un banc : impossible de tricher avec le dos, tout le travail va sur l'arrière d'épaule.",
    instructions_fr: ["Allonge-toi sur le ventre sur un banc incliné à 30-45°.", "Bras tendus vers le sol, coudes très légèrement fléchis.", "Ouvre les bras sur les côtés jusqu'à l'horizontale.", "Redescends en contrôlant."],
    tips_fr: ["Pense à écarter les haltères loin de toi plutôt qu'à les monter.", "Garde la même flexion de coude du début à la fin."],
    similar_exercises: ["dumbbell-reverse-fly", "machine-reverse-fly", "tl-incline-y-raise"]
  }),
  ex({
    id: "tl-single-arm-rear-delt-row", name: "Single-Arm Dumbbell Rear Delt Row", name_fr: "Rowing arrière d'épaule à un bras",
    type: "pull", muscle_focus: "epaules", muscle_portion: "posterior_deltoid", contraction_type: "polyarticulaire",
    primary_muscles: ["posterior_deltoid", "rhomboids"], secondary_muscles: ["biceps", "trapeces"], secondary_detail: ["biceps_brachii", "trapezius"],
    equipment: "halteres", difficulty: "intermediaire", unilateral: true,
    description_fr: "Un rowing coude écarté du corps : le bras tire vers le côté plutôt que vers la hanche, ce qui cible l'arrière d'épaule.",
    instructions_fr: ["Appuie une main et un genou sur un banc, dos plat.", "Haltère dans l'autre main, bras tendu.", "Tire l'haltère vers le haut en écartant le coude à 90° du corps.", "Monte jusqu'à ce que le bras soit à l'horizontale, puis redescends."],
    tips_fr: ["Le coude part vers le côté, pas vers l'arrière.", "Charge plus légère qu'un rowing classique."],
    similar_exercises: ["barbell-rear-delt-row", "double-kettlebell-rear-delt-row"]
  }),
  ex({
    id: "tl-band-face-pull", name: "Band Face Pull", name_fr: "Face pull à l'élastique",
    type: "pull", muscle_focus: "epaules", muscle_portion: "posterior_deltoid", contraction_type: "isolation",
    primary_muscles: ["posterior_deltoid"], secondary_muscles: ["dos", "trapeces"], secondary_detail: ["rhomboids", "trapezius", "supraspinatus"],
    equipment: "bandes", difficulty: "debutant",
    description_fr: "La version maison du face pull : un élastique accroché à hauteur des yeux suffit. Parfait en échauffement ou en fin de séance.",
    instructions_fr: ["Accroche l'élastique à hauteur du visage et attrape-le à deux mains, paumes vers le bas.", "Recule pour mettre l'élastique en tension.", "Tire vers ton front en écartant les mains et les coudes.", "Finis mains à côté des oreilles, puis reviens lentement."],
    tips_fr: ["Les coudes restent au-dessus des poignets.", "Fais des séries longues : 15 à 25 répétitions."],
    similar_exercises: ["face-pull", "dumbbell-face-pull", "band-pull-apart"]
  }),

  /* ─── Dentelé antérieur ─── */
  ex({
    id: "tl-push-up-plus", name: "Push-Up Plus", name_fr: "Pompe scapulaire (push-up plus)",
    type: "push", muscle_focus: "pectoraux", muscle_portion: "serratus_anterior", contraction_type: "isolation",
    primary_muscles: ["serratus_anterior"], secondary_muscles: ["pectoraux", "abdominaux"], secondary_detail: ["pectoralis_major", "rectus_abdominis"],
    equipment: "poids_du_corps", difficulty: "debutant", bodyweight: true,
    description_fr: "En position de pompe, bras tendus, tu bouges seulement les omoplates. Le « plus » final, quand tu pousses le sol au maximum, fait travailler le dentelé.",
    instructions_fr: ["Mets-toi en planche bras tendus, mains sous les épaules.", "Sans plier les coudes, laisse la poitrine descendre entre les épaules (les omoplates se rapprochent).", "Pousse ensuite le sol au maximum pour arrondir le haut du dos (les omoplates s'écartent).", "Reviens au milieu et recommence."],
    tips_fr: ["Les bras restent tendus tout du long : seul le haut du dos bouge.", "Version facile : genoux au sol ou mains contre un mur."],
    img: { main: "push-up-start.webp" },
    similar_exercises: ["tl-cable-serratus-punch", "push-up", "plank"]
  }),
  ex({
    id: "tl-cable-serratus-punch", name: "Cable Serratus Punch", name_fr: "Coup de poing à la poulie (dentelé)",
    type: "push", muscle_focus: "pectoraux", muscle_portion: "serratus_anterior", contraction_type: "isolation",
    primary_muscles: ["serratus_anterior"], secondary_muscles: ["epaules"], secondary_detail: ["anterior_deltoid"],
    equipment: "poulie", difficulty: "debutant", unilateral: true,
    description_fr: "Dos à la poulie, tu « boxes » vers l'avant en allongeant le bras au maximum. C'est la fin du mouvement, épaule qui avance, qui fait travailler le dentelé.",
    instructions_fr: ["Règle la poulie à hauteur de poitrine et tourne-lui le dos, poignée en main.", "Bras tendu devant toi à hauteur d'épaule.", "Sans plier le coude, avance l'épaule le plus loin possible vers l'avant.", "Laisse l'épaule revenir lentement, puis recommence."],
    tips_fr: ["Le coude reste tendu : c'est l'omoplate qui bouge.", "Charge légère, mouvement court et contrôlé."],
    similar_exercises: ["tl-push-up-plus", "tl-dumbbell-serratus-press"]
  }),
  ex({
    id: "tl-dumbbell-serratus-press", name: "Lying Dumbbell Serratus Press", name_fr: "Protraction couché aux haltères",
    type: "push", muscle_focus: "pectoraux", muscle_portion: "serratus_anterior", contraction_type: "isolation",
    primary_muscles: ["serratus_anterior"], secondary_muscles: ["pectoraux"], secondary_detail: ["pectoralis_major"],
    equipment: "halteres", difficulty: "debutant",
    description_fr: "Allongé sur un banc, bras tendus vers le plafond, tu pousses les haltères encore plus haut en décollant les épaules du banc.",
    instructions_fr: ["Allonge-toi sur un banc plat, un haltère dans chaque main, bras tendus au-dessus de la poitrine.", "Sans plier les coudes, pousse les haltères vers le plafond : les épaules décollent du banc.", "Tiens une seconde, puis laisse les épaules redescendre."],
    tips_fr: ["Amplitude de quelques centimètres seulement : c'est normal.", "Garde les bras parfaitement tendus."],
    similar_exercises: ["tl-push-up-plus", "tl-cable-serratus-punch"]
  }),
  ex({
    id: "tl-wall-slide-foam-roller", name: "Foam Roller Wall Slide", name_fr: "Glissé au mur avec rouleau",
    type: "push", muscle_focus: "pectoraux", muscle_portion: "serratus_anterior", contraction_type: "isolation",
    primary_muscles: ["serratus_anterior"], secondary_muscles: ["trapeces", "epaules"], secondary_detail: ["trapezius", "anterior_deltoid"],
    equipment: "autre", difficulty: "debutant",
    description_fr: "Avant-bras posés sur un rouleau contre le mur, tu le fais rouler vers le haut. Ça réveille le dentelé et le bas des trapèzes : idéal en échauffement d'épaules.",
    instructions_fr: ["Face au mur, pose les avant-bras sur un rouleau de massage, coudes à hauteur d'épaule.", "Pousse légèrement le rouleau contre le mur.", "Fais-le rouler vers le haut en tendant les bras, en gardant la pression.", "Redescends lentement."],
    tips_fr: ["Pas de rouleau ? Les avant-bras directement contre le mur marchent aussi.", "Ne cambre pas le bas du dos."],
    similar_exercises: ["tl-push-up-plus", "tl-cable-serratus-punch"]
  }),

  /* ─── Coiffe des rotateurs (sus-épineux, rotateurs externes) ─── */
  ex({
    id: "tl-dumbbell-scaption", name: "Dumbbell Scaption", name_fr: "Élévation en Y debout (scaption)",
    type: "push", muscle_focus: "epaules", muscle_portion: "supraspinatus", contraction_type: "isolation",
    primary_muscles: ["supraspinatus", "lateral_deltoid"], secondary_muscles: ["epaules", "trapeces"], secondary_detail: ["anterior_deltoid", "trapezius"],
    equipment: "halteres", difficulty: "debutant",
    description_fr: "Une élévation de bras en diagonale, pouces vers le haut. Elle renforce le sus-épineux, un petit muscle de la coiffe des rotateurs qui protège l'épaule.",
    instructions_fr: ["Debout, un haltère léger dans chaque main, pouces vers le haut.", "Monte les bras tendus en diagonale, à environ 30° devant toi (comme un Y ouvert).", "Arrête-toi à hauteur d'épaule.", "Redescends lentement."],
    tips_fr: ["Très léger : 1 à 4 kg.", "Les pouces restent pointés vers le plafond."],
    similar_exercises: ["tl-side-lying-external-rotation", "lateral-raise"]
  }),
  ex({
    id: "tl-side-lying-external-rotation", name: "Side-Lying Dumbbell External Rotation", name_fr: "Rotation externe allongé sur le côté",
    type: "pull", muscle_focus: "epaules", muscle_portion: "posterior_deltoid", contraction_type: "isolation",
    primary_muscles: ["posterior_deltoid", "supraspinatus"], secondary_muscles: ["dos"], secondary_detail: ["rhomboids"],
    equipment: "halteres", difficulty: "debutant", unilateral: true,
    description_fr: "Le grand classique de la prévention des blessures à l'épaule : il renforce les rotateurs externes (sous l'arrière d'épaule).",
    instructions_fr: ["Allonge-toi sur le côté, haltère dans la main du dessus.", "Coude collé à la hanche, plié à 90°, avant-bras sur le ventre.", "Fais pivoter l'avant-bras vers le plafond sans décoller le coude.", "Redescends lentement."],
    tips_fr: ["Une serviette roulée entre le coude et le flanc aide à garder la position.", "Charge légère, séries de 12 à 20."],
    similar_exercises: ["cable-external-rotation", "tl-band-external-rotation"]
  }),
  ex({
    id: "tl-band-external-rotation", name: "Band External Rotation", name_fr: "Rotation externe à l'élastique",
    type: "pull", muscle_focus: "epaules", muscle_portion: "posterior_deltoid", contraction_type: "isolation",
    primary_muscles: ["posterior_deltoid", "supraspinatus"], secondary_muscles: ["dos"], secondary_detail: ["rhomboids"],
    equipment: "bandes", difficulty: "debutant", unilateral: true,
    description_fr: "Même mouvement que la rotation externe à la poulie, avec un élastique. Pratique en échauffement avant le développé.",
    instructions_fr: ["Accroche l'élastique à hauteur de coude, sur le côté.", "Coude collé au corps, plié à 90°, main vers le ventre.", "Fais pivoter l'avant-bras vers l'extérieur sans décoller le coude.", "Reviens lentement."],
    tips_fr: ["Le coude ne bouge pas : seul l'avant-bras tourne.", "Reste à une tension modérée."],
    img: { start: "cable-external-rotation-start.webp", peak: "cable-external-rotation-peak.webp" },
    similar_exercises: ["cable-external-rotation", "tl-side-lying-external-rotation"]
  }),

  /* ─── Tibial antérieur ─── */
  ex({
    id: "tl-wall-tibialis-raise", name: "Wall Tibialis Raise", name_fr: "Relevé des tibias contre le mur",
    type: "legs", muscle_focus: "mollets", muscle_portion: "tibialis_anterior", contraction_type: "isolation",
    primary_muscles: ["tibialis_anterior"],
    equipment: "poids_du_corps", difficulty: "debutant", bodyweight: true,
    description_fr: "Dos au mur, pieds avancés, tu relèves les pointes de pied. Il renforce le devant du tibia : utile pour les genoux et contre les douleurs de course.",
    instructions_fr: ["Dos et fesses contre un mur, pieds à 30-50 cm devant toi.", "Jambes tendues, relève les pointes de pied le plus haut possible.", "Redescends doucement sans poser complètement les pointes.", "Enchaîne les répétitions."],
    tips_fr: ["Plus les pieds sont loin du mur, plus c'est dur.", "Vise 15 à 25 répétitions, jusqu'à la brûlure."],
    similar_exercises: ["kettlebell-tibialis-raise", "tl-heel-walk", "tl-banded-dorsiflexion"]
  }),
  ex({
    id: "tl-heel-walk", name: "Heel Walk", name_fr: "Marche sur les talons",
    type: "legs", muscle_focus: "mollets", muscle_portion: "tibialis_anterior", contraction_type: "isometrique",
    primary_muscles: ["tibialis_anterior"],
    equipment: "poids_du_corps", difficulty: "debutant", bodyweight: true,
    description_fr: "Tu marches uniquement sur les talons, pointes de pied relevées. Simple et efficace pour le tibial, en échauffement ou en fin de séance jambes.",
    instructions_fr: ["Debout, relève les pointes de pied pour ne garder que les talons au sol.", "Marche à petits pas pendant 20 à 40 mètres.", "Garde les pointes relevées tout du long."],
    tips_fr: ["Reste grand, sans te pencher en arrière.", "Fais 2 à 3 allers-retours."],
    similar_exercises: ["tl-wall-tibialis-raise", "kettlebell-tibialis-raise"]
  }),
  ex({
    id: "tl-banded-dorsiflexion", name: "Banded Ankle Dorsiflexion", name_fr: "Flexion de cheville à l'élastique",
    type: "legs", muscle_focus: "mollets", muscle_portion: "tibialis_anterior", contraction_type: "isolation",
    primary_muscles: ["tibialis_anterior"],
    equipment: "bandes", difficulty: "debutant", unilateral: true,
    description_fr: "Assis, un élastique tiré vers l'avant autour du pied, tu ramènes la pointe vers toi. Une version douce et facile à doser.",
    instructions_fr: ["Assis jambes tendues, passe un élastique autour du dessus du pied.", "Accroche l'autre bout devant toi (ou fais-le tenir par quelqu'un).", "Ramène la pointe du pied vers toi contre la résistance.", "Relâche lentement."],
    tips_fr: ["Le talon reste posé, seule la cheville bouge.", "Séries de 15 à 20 par jambe."],
    similar_exercises: ["tl-wall-tibialis-raise", "kettlebell-tibialis-raise"]
  }),

  /* ─── Adducteurs ─── */
  ex({
    id: "tl-copenhagen-plank", name: "Copenhagen Plank", name_fr: "Planche Copenhague",
    type: "legs", muscle_focus: "adducteurs", muscle_portion: "adductors", contraction_type: "isometrique",
    primary_muscles: ["adductors"], secondary_muscles: ["abdominaux"], secondary_detail: ["obliques", "transverse_abdominis"],
    equipment: "banc", difficulty: "avance", bodyweight: true, unilateral: true,
    description_fr: "Une planche sur le côté, la jambe du dessus posée sur un banc : ce sont les adducteurs qui te tiennent en l'air. Très efficace contre les blessures à l'aine.",
    instructions_fr: ["Allonge-toi sur le côté, avant-bras au sol, à côté d'un banc.", "Pose l'intérieur du pied (ou du genou) du dessus sur le banc.", "Soulève les hanches pour aligner le corps, la jambe du dessous dans le vide.", "Tiens la position, puis change de côté."],
    tips_fr: ["Commence avec le genou sur le banc (version plus facile).", "Tiens 15 à 30 secondes par côté."],
    similar_exercises: ["tl-copenhagen-plank-knee", "side-plank", "hip-adduction"]
  }),
  ex({
    id: "tl-copenhagen-plank-knee", name: "Short-Lever Copenhagen Plank", name_fr: "Planche Copenhague genou sur le banc",
    type: "legs", muscle_focus: "adducteurs", muscle_portion: "adductors", contraction_type: "isometrique",
    primary_muscles: ["adductors"], secondary_muscles: ["abdominaux"], secondary_detail: ["obliques"],
    equipment: "banc", difficulty: "debutant", bodyweight: true, unilateral: true,
    description_fr: "La version débutant de la planche Copenhague : c'est le genou, et non le pied, qui repose sur le banc. Moins de levier, même muscles.",
    instructions_fr: ["Allonge-toi sur le côté à côté d'un banc, avant-bras au sol.", "Pose l'intérieur du genou du dessus sur le banc.", "Soulève les hanches pour aligner le corps.", "Tiens 15 à 30 secondes, puis change de côté."],
    tips_fr: ["Quand tu tiens 30 secondes facilement, passe à la version pied sur le banc."],
    similar_exercises: ["tl-copenhagen-plank", "side-plank"]
  }),
  ex({
    id: "tl-cable-hip-adduction", name: "Cable Hip Adduction", name_fr: "Adduction de hanche à la poulie",
    type: "legs", muscle_focus: "adducteurs", muscle_portion: "adductors", contraction_type: "isolation",
    primary_muscles: ["adductors"], secondary_muscles: ["flechisseurs_hanche"], secondary_detail: ["hip_flexors"],
    equipment: "poulie", difficulty: "debutant", unilateral: true,
    description_fr: "Une sangle à la cheville, tu ramènes la jambe vers l'intérieur contre la poulie. Plus facile à doser que la machine, et une jambe à la fois.",
    instructions_fr: ["Attache une sangle à la cheville, la poulie basse sur le côté de cette jambe.", "Tiens-toi au support, la jambe attachée écartée.", "Ramène la jambe devant l'autre en la croisant légèrement.", "Reviens lentement."],
    tips_fr: ["Garde le buste droit, sans te pencher.", "Séries de 12 à 15 par jambe."],
    similar_exercises: ["hip-adduction", "banded-standing-hip-adduction"]
  })
];
