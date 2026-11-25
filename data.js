// ===================================================================
// data.js : données, comptes utilisateurs, Supabase et sauvegarde
// RÈGLE : ce fichier ne touche JAMAIS à la page (aucun "document.").
// ===================================================================


// ----- 0. Configuration Supabase (pour mettre le site en ligne) -----
// Remplace ces deux valeurs par celles de ton projet Supabase
// (Project Settings -> API -> Project URL & anon/publishable key).
// Tant que tu laisses les valeurs par défaut, le site fonctionne en local.
const SUPABASE_URL = "https://auydfbymzudxypryduyn.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_FKy5VKVEzOMim6DxY-Vxew_s5A9svZp";

const MODE_EN_LIGNE =
    typeof window !== "undefined"
    && Boolean(window.supabase)
    && SUPABASE_URL.startsWith("https://")
    && SUPABASE_ANON_KEY !== "VOTRE_SUPABASE_ANON_KEY"
    && SUPABASE_ANON_KEY.trim() !== "";

const supabaseClient = MODE_EN_LIGNE
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;


// ----- 1. Données de l'application -----

const CLE_SAUVEGARDE = "notationProfs2";
const CLE_COMPTES_LOCAUX = "notationProfs_comptesLocaux";
const CLE_SESSION_LOCALE = "notationProfs_sessionLocale";

const NOMS_MATIERES = [
    "Mathématiques", "Physique", "Biologie", "Chimie", "AM", "Allemand",
    "Anglais", "Espagnol", "Économie", "Droit", "Français", "Informatique",
    "Histoire", "Géographie", "Sport", "Italien", "Arts visuels", "Musique",
    "Histoire de l'art", "Philosophie", "Latin", "Grec"
];

function matieresFixes() {
    return NOMS_MATIERES.map(function (nom, index) {
        return {id: index + 1, nom: nom};
    });
}

let data = {
    etablissements: [],
    matieres: matieresFixes(),
    profs: [],
    notes: [],
    enseignements: []
};

// Utilisateur actuellement connecté : { id, email, pseudo } ou null
let utilisateurCourant = null;

// Code admin mémorisé en mémoire pendant la session admin
let codeAdminActif = null;

function initialiserDonneesAvecExemples() {
    data = {
        etablissements: [
            {id: 1, nom: "De Staël", userId: null},
            {id: 2, nom: "Calvin", userId: null},
            {id: 3, nom: "Voltaire", userId: null}
        ],
        matieres: matieresFixes(),
        profs: [
            {id: 1, etablissementId: 1, nom: "M. Bonte", userId: null},
            {id: 2, etablissementId: 1, nom: "M. Clark", userId: null},
            {id: 3, etablissementId: 1, nom: "M. Cudre-Mauroux", userId: null},
            {id: 4, etablissementId: 2, nom: "Mme Dupont", userId: null},
            {id: 5, etablissementId: 3, nom: "M. Martin", userId: null}
        ],
        notes: [
            {id: 1, profId: 1, matiereId: 1, valeur: 8, commentaire: "Explique très clairement.", date: "2026-11-02", userId: null},
            {id: 2, profId: 1, matiereId: 2, valeur: 6.5, commentaire: "Cours parfois trop rapide.", date: "2026-11-05", userId: null},
            {id: 3, profId: 2, matiereId: 7, valeur: 9, commentaire: "Très motivant.", date: "2026-11-03", userId: null},
            {id: 4, profId: 2, matiereId: 7, valeur: 7.5, commentaire: "", date: "2026-11-06", userId: null},
            {id: 5, profId: 3, matiereId: 11, valeur: 5, commentaire: "Beaucoup de devoirs.", date: "2026-11-04", userId: null},
            {id: 6, profId: 4, matiereId: 11, valeur: 7, commentaire: "Cours bien organisés.", date: "2026-11-01", userId: null}
        ],
        enseignements: [
            {profId: 1, matiereId: 1},
            {profId: 1, matiereId: 2},
            {profId: 2, matiereId: 7},
            {profId: 3, matiereId: 11},
            {profId: 3, matiereId: 13},
            {profId: 4, matiereId: 11},
            {profId: 5, matiereId: 1}
        ]
    };
}


// ----- 2. Sauvegarde (Supabase en ligne OU localStorage en local) -----

function estEnLigne() {
    return MODE_EN_LIGNE;
}

function sauvegarderDonneesLocal() {
    localStorage.setItem(CLE_SAUVEGARDE, JSON.stringify(data));
}

function donneesValides(objet) {
    return objet !== null
        && typeof objet === "object"
        && Array.isArray(objet.etablissements)
        && Array.isArray(objet.matieres)
        && Array.isArray(objet.profs)
        && Array.isArray(objet.notes)
        && Array.isArray(objet.enseignements);
}

function chargerDonneesLocal() {
    let texte = localStorage.getItem(CLE_SAUVEGARDE);
    if (texte === null) {
        initialiserDonneesAvecExemples();
        sauvegarderDonneesLocal();
        return;
    }
    try {
        let lu = JSON.parse(texte);
        if (donneesValides(lu)) {
            data = lu;
            data.matieres = matieresFixes();
        } else {
            initialiserDonneesAvecExemples();
        }
    } catch (erreur) {
        initialiserDonneesAvecExemples();
    }
}

async function chargerDonnees() {
    if (!MODE_EN_LIGNE) {
        chargerDonneesLocal();
        return {ok: true};
    }

    let [resEtab, resProfs, resEns, resNotes] = await Promise.all([
        supabaseClient.from("etablissements").select("id, nom, user_id").order("id", {ascending: true}),
        supabaseClient.from("profs").select("id, etablissement_id, nom, user_id").order("id", {ascending: true}),
        supabaseClient.from("enseignements").select("prof_id, matiere_id"),
        supabaseClient.from("notes").select("id, prof_id, matiere_id, valeur, commentaire, date, user_id").order("id", {ascending: true})
    ]);

    let erreur = resEtab.error || resProfs.error || resEns.error || resNotes.error;
    if (erreur) {
        console.error("Erreur Supabase :", erreur);
        return {ok: false, erreur: erreur.message};
    }

    data = {
        etablissements: (resEtab.data || []).map(e => ({
            id: Number(e.id),
            nom: e.nom,
            userId: e.user_id || null
        })),
        matieres: matieresFixes(),
        profs: (resProfs.data || []).map(p => ({
            id: Number(p.id),
            etablissementId: Number(p.etablissement_id),
            nom: p.nom,
            userId: p.user_id || null
        })),
        enseignements: (resEns.data || []).map(e => ({
            profId: Number(e.prof_id),
            matiereId: Number(e.matiere_id)
        })),
        notes: (resNotes.data || []).map(n => ({
            id: Number(n.id),
            profId: Number(n.prof_id),
            matiereId: Number(n.matiere_id),
            valeur: Number(n.valeur),
            commentaire: n.commentaire || "",
            date: n.date,
            userId: n.user_id || null
        }))
    };

    return {ok: true};
}


// ----- 2b. Comptes utilisateurs (Supabase Auth OU localStorage en local) -----

function obtenirUtilisateurCourant() {
    return utilisateurCourant;
}

function estConnecte() {
    return utilisateurCourant !== null;
}

function formaterUtilisateurSupabase(user) {
    if (!user) return null;
    let pseudo = (user.user_metadata && user.user_metadata.pseudo)
        ? user.user_metadata.pseudo
        : (user.email ? user.email.split("@")[0] : "Élève");
    return {id: user.id, email: user.email || "", pseudo: pseudo};
}

async function chargerSessionUtilisateur() {
    if (!MODE_EN_LIGNE) {
        try {
            let brut = localStorage.getItem(CLE_SESSION_LOCALE);
            utilisateurCourant = brut ? JSON.parse(brut) : null;
        } catch (e) {
            utilisateurCourant = null;
        }
        return utilisateurCourant;
    }

    let res = await supabaseClient.auth.getSession();
    let user = (res.data && res.data.session) ? res.data.session.user : null;
    utilisateurCourant = formaterUtilisateurSupabase(user);
    return utilisateurCourant;
}

function ecouterChangementsSession(callback) {
    if (!MODE_EN_LIGNE) return;
    supabaseClient.auth.onAuthStateChange(function (_event, session) {
        utilisateurCourant = formaterUtilisateurSupabase(session ? session.user : null);
        callback(utilisateurCourant);
    });
}

function lireComptesLocaux() {
    try {
        let brut = localStorage.getItem(CLE_COMPTES_LOCAUX);
        return brut ? JSON.parse(brut) : [];
    } catch (e) {
        return [];
    }
}

async function inscrireUtilisateur(pseudo, email, motDePasse) {
    pseudo = pseudo.trim();
    email = email.trim().toLowerCase();

    if (pseudo.length < 2 || pseudo.length > 30) {
        return {ok: false, erreur: "Choisis un pseudo entre 2 et 30 caractères."};
    }
    if (!email.includes("@")) {
        return {ok: false, erreur: "Entre une adresse e-mail valide."};
    }
    if (motDePasse.length < 6) {
        return {ok: false, erreur: "Le mot de passe doit contenir au moins 6 caractères."};
    }

    if (!MODE_EN_LIGNE) {
        let comptes = lireComptesLocaux();
        if (comptes.some(c => c.email === email)) {
            return {ok: false, erreur: "Un compte existe déjà avec cet e-mail."};
        }
        let nouveau = {
            id: "local-" + Date.now(),
            pseudo: pseudo,
            email: email,
            motDePasse: motDePasse
        };
        comptes.push(nouveau);
        localStorage.setItem(CLE_COMPTES_LOCAUX, JSON.stringify(comptes));
        utilisateurCourant = {id: nouveau.id, email: nouveau.email, pseudo: nouveau.pseudo};
        localStorage.setItem(CLE_SESSION_LOCALE, JSON.stringify(utilisateurCourant));
        return {ok: true, confirmationRequise: false};
    }

    let res = await supabaseClient.auth.signUp({
        email: email,
        password: motDePasse,
        options: {data: {pseudo: pseudo}}
    });

    if (res.error) {
        return {ok: false, erreur: res.error.message};
    }

    if (res.data && res.data.session) {
        utilisateurCourant = formaterUtilisateurSupabase(res.data.session.user);
        return {ok: true, confirmationRequise: false};
    }

    return {
        ok: true,
        confirmationRequise: true,
        message: "Compte créé ! Vérifie ta boîte mail pour confirmer ton adresse, puis connecte-toi."
    };
}

async function connecterUtilisateur(email, motDePasse) {
    email = email.trim().toLowerCase();

    if (!MODE_EN_LIGNE) {
        let comptes = lireComptesLocaux();
        let trouve = comptes.find(c => c.email === email && c.motDePasse === motDePasse);
        if (!trouve) {
            return {ok: false, erreur: "E-mail ou mot de passe incorrect."};
        }
        utilisateurCourant = {id: trouve.id, email: trouve.email, pseudo: trouve.pseudo};
        localStorage.setItem(CLE_SESSION_LOCALE, JSON.stringify(utilisateurCourant));
        return {ok: true};
    }

    let res = await supabaseClient.auth.signInWithPassword({
        email: email,
        password: motDePasse
    });

    if (res.error) {
        return {ok: false, erreur: "E-mail ou mot de passe incorrect."};
    }

    utilisateurCourant = formaterUtilisateurSupabase(res.data.user);
    return {ok: true};
}

async function deconnecterUtilisateur() {
    utilisateurCourant = null;
    if (!MODE_EN_LIGNE) {
        localStorage.removeItem(CLE_SESSION_LOCALE);
        return;
    }
    await supabaseClient.auth.signOut();
}


// ----- 3. Outils communs -----

function prochainId(tableau) {
    return tableau.length ? Math.max(...tableau.map(x => x.id)) + 1 : 1;
}

function nomValide(nom) {
    if (typeof nom !== "string") {
        return false;
    }
    let propre = nom.trim();
    return propre !== "" && propre.length <= 60;
}

function memeNom(a, b) {
    return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function construireNomProf(civilite, nomBrut) {
    let titre = (civilite === "Mme") ? "Mme" : "M.";
    if (typeof nomBrut !== "string") {
        return "";
    }
    // Retire un éventuel "M." ou "Mme" déjà tapé par l'utilisateur
    let propre = nomBrut.trim().replace(/^(mme\.?|mr\.?|m\.?)\s+/i, "").trim();
    if (propre === "") {
        return "";
    }
    return titre + " " + propre;
}

function dateAujourdhui() {
    let d = new Date();
    let mois = String(d.getMonth() + 1).padStart(2, "0");
    let jour = String(d.getDate()).padStart(2, "0");
    return d.getFullYear() + "-" + mois + "-" + jour;
}

function messageDate(date) {
    if (typeof date !== "string" || date === "") {
        return "Choisis la date de la note.";
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return "Cette date n'est pas valide.";
    }
    let p = date.split("-").map(Number);
    let d = new Date(p[0], p[1] - 1, p[2]);
    if (d.getFullYear() !== p[0] || d.getMonth() !== p[1] - 1 || d.getDate() !== p[2]) {
        return "Cette date n'existe pas.";
    }
    if (date > dateAujourdhui()) {
        return "La date ne peut pas être dans le futur.";
    }
    return null;
}


// ----- 4. Établissements -----

function listerEtablissements() {
    return data.etablissements;
}

function trouverEtablissement(id) {
    return data.etablissements.find(e => e.id === id);
}

function verifierNomEtablissement(nom) {
    if (!nomValide(nom)) {
        return "Donne un nom à l'établissement (60 caractères maximum).";
    }
    if (data.etablissements.some(e => memeNom(e.nom, nom))) {
        return "Cet établissement existe déjà.";
    }
    return null;
}

async function ajouterEtablissement(nom) {
    if (verifierNomEtablissement(nom) !== null) {
        return {ok: false, erreur: verifierNomEtablissement(nom)};
    }

    let userId = utilisateurCourant ? utilisateurCourant.id : null;

    if (!MODE_EN_LIGNE) {
        data.etablissements.push({
            id: prochainId(data.etablissements),
            nom: nom.trim(),
            userId: userId
        });
        sauvegarderDonneesLocal();
        return {ok: true};
    }

    let res = await supabaseClient
        .from("etablissements")
        .insert({nom: nom.trim(), user_id: userId});

    if (res.error) {
        return {ok: false, erreur: res.error.message};
    }

    await chargerDonnees();
    return {ok: true};
}


// ----- 5. Matières (liste fixe : lecture seule) -----

function listerMatieres() {
    return data.matieres;
}

function trouverMatiere(id) {
    return data.matieres.find(m => m.id === id);
}


// ----- 6. Profs -----

function listerProfs(etablissementId) {
    return data.profs.filter(p => p.etablissementId === etablissementId);
}

function trouverProf(id) {
    return data.profs.find(p => p.id === id);
}

function verifierNomProf(etablissementId, nomComplet) {
    if (!nomValide(nomComplet)) {
        return "Entre le nom du prof (60 caractères maximum).";
    }
    if (listerProfs(etablissementId).some(p => memeNom(p.nom, nomComplet))) {
        return "Ce prof existe déjà dans cet établissement.";
    }
    return null;
}

function enseignementExiste(profId, matiereId) {
    return data.enseignements.some(e => e.profId === profId && e.matiereId === matiereId);
}

function listerMatieresDeProf(profId) {
    return data.enseignements
        .filter(e => e.profId === profId)
        .map(e => trouverMatiere(e.matiereId))
        .filter(m => m !== undefined);
}

async function ajouterProfAvecNote(etablissementId, nomProfComplet, matiereId, valeur, commentaire, date) {
    if (trouverEtablissement(etablissementId) === undefined) {
        return {ok: false, erreur: "Établissement introuvable."};
    }
    if (verifierNomProf(etablissementId, nomProfComplet) !== null) {
        return {ok: false, erreur: verifierNomProf(etablissementId, nomProfComplet)};
    }
    commentaire = commentaire.trim();
    if (Object.keys(verifierNote(matiereId, valeur, commentaire, date)).length > 0) {
        return {ok: false, erreur: "Données de note invalides."};
    }

    let userId = utilisateurCourant ? utilisateurCourant.id : null;

    if (!MODE_EN_LIGNE) {
        let profId = prochainId(data.profs);
        data.profs.push({
            id: profId,
            etablissementId: etablissementId,
            nom: nomProfComplet.trim(),
            userId: userId
        });
        data.enseignements.push({profId: profId, matiereId: matiereId});
        data.notes.push({
            id: prochainId(data.notes),
            profId: profId,
            matiereId: matiereId,
            valeur: valeur,
            commentaire: commentaire,
            date: date,
            userId: userId
        });
        sauvegarderDonneesLocal();
        return {ok: true};
    }

    // 1. Insérer le prof
    let resProf = await supabaseClient
        .from("profs")
        .insert({etablissement_id: etablissementId, nom: nomProfComplet.trim(), user_id: userId})
        .select("id")
        .single();

    if (resProf.error) {
        return {ok: false, erreur: resProf.error.message};
    }

    let nouveauProfId = Number(resProf.data.id);

    // 2. Insérer la liaison prof <-> matière
    let resEns = await supabaseClient
        .from("enseignements")
        .upsert({prof_id: nouveauProfId, matiere_id: matiereId}, {onConflict: "prof_id,matiere_id", ignoreDuplicates: true});

    if (resEns.error) {
        return {ok: false, erreur: resEns.error.message};
    }

    // 3. Insérer la note
    let resNote = await supabaseClient
        .from("notes")
        .insert({
            prof_id: nouveauProfId,
            matiere_id: matiereId,
            valeur: valeur,
            commentaire: commentaire,
            date: date,
            user_id: userId
        });

    if (resNote.error) {
        return {ok: false, erreur: resNote.error.message};
    }

    await chargerDonnees();
    return {ok: true};
}


// ----- 7. Notes -----

function listerNotes(profId) {
    return data.notes.filter(n => n.profId === profId);
}

function listerNotesRecentes(profId) {
    return listerNotes(profId).sort(function (a, b) {
        if (a.date !== b.date) {
            return a.date < b.date ? 1 : -1;
        }
        return b.id - a.id;
    });
}

function verifierNote(matiereId, valeur, commentaire, date) {
    let erreurs = {};

    if (trouverMatiere(matiereId) === undefined) {
        erreurs.matiere = "Choisis une matière.";
    }

    if (typeof valeur !== "number" || isNaN(valeur)) {
        erreurs.note = "Entre une note.";
    } else if (valeur > 10) {
        erreurs.note = "La note ne peut pas dépasser 10.";
    } else if (valeur < 0) {
        erreurs.note = "La note ne peut pas être négative.";
    } else if (!Number.isInteger(valeur * 2)) {
        erreurs.note = "La note doit être un multiple de 0,5 (ex. : 7 ou 7,5).";
    }

    if (commentaire.trim().length > 300) {
        erreurs.commentaire = "Le commentaire ne peut pas dépasser 300 caractères.";
    }

    let erreurDate = messageDate(date);
    if (erreurDate !== null) {
        erreurs.date = erreurDate;
    }

    return erreurs;
}

async function ajouterNote(profId, matiereId, valeur, commentaire, date) {
    if (trouverProf(profId) === undefined) {
        return {ok: false, erreur: "Prof introuvable."};
    }
    commentaire = commentaire.trim();
    if (Object.keys(verifierNote(matiereId, valeur, commentaire, date)).length > 0) {
        return {ok: false, erreur: "Données de note invalides."};
    }

    let userId = utilisateurCourant ? utilisateurCourant.id : null;

    if (!MODE_EN_LIGNE) {
        if (!enseignementExiste(profId, matiereId)) {
            data.enseignements.push({profId: profId, matiereId: matiereId});
        }
        data.notes.push({
            id: prochainId(data.notes),
            profId: profId,
            matiereId: matiereId,
            valeur: valeur,
            commentaire: commentaire,
            date: date,
            userId: userId
        });
        sauvegarderDonneesLocal();
        return {ok: true};
    }

    if (!enseignementExiste(profId, matiereId)) {
        let resEns = await supabaseClient
            .from("enseignements")
            .upsert({prof_id: profId, matiere_id: matiereId}, {onConflict: "prof_id,matiere_id", ignoreDuplicates: true});
        if (resEns.error) {
            return {ok: false, erreur: resEns.error.message};
        }
    }

    let resNote = await supabaseClient
        .from("notes")
        .insert({
            prof_id: profId,
            matiere_id: matiereId,
            valeur: valeur,
            commentaire: commentaire,
            date: date,
            user_id: userId
        });

    if (resNote.error) {
        return {ok: false, erreur: resNote.error.message};
    }

    await chargerDonnees();
    return {ok: true};
}


// ----- 8. Calculs -----

function compterNotes(profId) {
    return listerNotes(profId).length;
}

function moyenneProf(profId) {
    let notes = listerNotes(profId);
    if (notes.length === 0) {
        return null;
    }
    let total = 0;
    notes.forEach(function (note) {
        total += note.valeur;
    });
    return total / notes.length;
}

function classementEtablissement(etablissementId) {
    let notes = listerProfs(etablissementId)
        .map(p => ({prof: p, moyenne: moyenneProf(p.id), nb: compterNotes(p.id)}))
        .filter(x => x.moyenne !== null);

    if (notes.length === 0) {
        return null;
    }

    let meilleur = notes[0];
    let pire = notes[0];
    notes.forEach(function (x) {
        if (x.moyenne > meilleur.moyenne) {
            meilleur = x;
        }
        if (x.moyenne < pire.moyenne) {
            pire = x;
        }
    });

    if (pire.prof.id === meilleur.prof.id) {
        pire = null;
    }
    return {meilleur: meilleur, pire: pire};
}


// ----- 9. Administration (code et suppressions) -----

const CODE_ADMIN_LOCAL = "N+L FOREVER";

async function verifierCodeAdmin(code) {
    let propre = typeof code === "string" ? code.trim() : "";
    if (!MODE_EN_LIGNE) {
        if (propre === CODE_ADMIN_LOCAL) {
            codeAdminActif = propre;
            return true;
        }
        return false;
    }

    let res = await supabaseClient.rpc("verifier_code_admin", {p_code: propre});
    if (!res.error && res.data === true) {
        codeAdminActif = propre;
        return true;
    }
    return false;
}

function quitterModeAdmin() {
    codeAdminActif = null;
}

async function supprimerEtablissement(etablissementId) {
    if (!MODE_EN_LIGNE) {
        let idsProfs = data.profs
            .filter(p => p.etablissementId === etablissementId)
            .map(p => p.id);

        data.etablissements = data.etablissements.filter(e => e.id !== etablissementId);
        data.profs = data.profs.filter(p => p.etablissementId !== etablissementId);
        data.notes = data.notes.filter(n => !idsProfs.includes(n.profId));
        data.enseignements = data.enseignements.filter(e => !idsProfs.includes(e.profId));
        sauvegarderDonneesLocal();
        return {ok: true};
    }

    let res = await supabaseClient.rpc("admin_supprimer_etablissement", {
        p_id: etablissementId,
        p_code: codeAdminActif || ""
    });
    if (res.error || res.data !== true) {
        return {ok: false, erreur: "Suppression refusée."};
    }
    await chargerDonnees();
    return {ok: true};
}

async function supprimerProf(profId) {
    if (!MODE_EN_LIGNE) {
        data.profs = data.profs.filter(p => p.id !== profId);
        data.notes = data.notes.filter(n => n.profId !== profId);
        data.enseignements = data.enseignements.filter(e => e.profId !== profId);
        sauvegarderDonneesLocal();
        return {ok: true};
    }

    let res = await supabaseClient.rpc("admin_supprimer_prof", {
        p_id: profId,
        p_code: codeAdminActif || ""
    });
    if (res.error || res.data !== true) {
        return {ok: false, erreur: "Suppression refusée."};
    }
    await chargerDonnees();
    return {ok: true};
}

async function supprimerNote(noteId, enTantQuAdmin) {
    if (!MODE_EN_LIGNE) {
        data.notes = data.notes.filter(n => n.id !== noteId);
        sauvegarderDonneesLocal();
        return {ok: true};
    }

    if (enTantQuAdmin && codeAdminActif) {
        let res = await supabaseClient.rpc("admin_supprimer_note", {
            p_id: noteId,
            p_code: codeAdminActif
        });
        if (res.error || res.data !== true) {
            return {ok: false, erreur: "Suppression admin refusée."};
        }
    } else {
        let res = await supabaseClient.from("notes").delete().eq("id", noteId);
        if (res.error) {
            return {ok: false, erreur: res.error.message};
        }
    }

    await chargerDonnees();
    return {ok: true};
}


// ----- 10. Captcha de culture générale selon la matière -----

// Classement de difficulté :
// 1 (Facile)    : Latin, Grec, Histoire de l'art, Arts visuels, Philosophie, Musique
// 2 (Moyen)     : Allemand, Anglais, Français, Espagnol, Italien
// 3 (Difficile) : Géographie, Histoire, Biologie, Droit
// 4 (Expert)    : Chimie, Mathématiques, AM, Physique, Économie, Sport, Informatique
const NIVEAU_PAR_MATIERE = {
    "Latin": 1,
    "Grec": 1,
    "Histoire de l'art": 1,
    "Arts visuels": 1,
    "Philosophie": 1,
    "Musique": 1,

    "Allemand": 2,
    "Anglais": 2,
    "Français": 2,
    "Espagnol": 2,
    "Italien": 2,

    "Géographie": 3,
    "Histoire": 3,
    "Biologie": 3,
    "Droit": 3,

    "Chimie": 4,
    "Mathématiques": 4,
    "AM": 4,
    "Physique": 4,
    "Économie": 4,
    "Sport": 4,
    "Informatique": 4
};

const LIBELLES_NIVEAU = {
    1: {nom: "Facile",    classe: "text-green-300 border-green-300"},
    2: {nom: "Moyen",     classe: "text-sky-300 border-sky-300"},
    3: {nom: "Difficile", classe: "text-amber-300 border-amber-300"},
    4: {nom: "Expert",    classe: "text-red-300 border-red-300"}
};

const QUESTIONS_CAPTCHA = {
    1: [
        {
            question: "Quelle est la capitale de la France ?",
            choix: ["Lyon", "Paris", "Marseille", "Bordeaux"],
            reponse: 1
        },
        {
            question: "Quelle couleur obtient-on en mélangeant du bleu et du jaune ?",
            choix: ["Violet", "Orange", "Vert", "Marron"],
            reponse: 2
        },
        {
            question: "Combien y a-t-il de jours dans une semaine ?",
            choix: ["5", "6", "7", "8"],
            reponse: 2
        },
        {
            question: "Sur quel continent se trouve la Suisse ?",
            choix: ["L'Asie", "L'Amérique", "L'Afrique", "L'Europe"],
            reponse: 3
        },
        {
            question: "Combien de côtés possède un triangle ?",
            choix: ["3", "4", "5", "6"],
            reponse: 0
        },
        {
            question: "Quel astre éclaire la Terre pendant la journée ?",
            choix: ["La Lune", "Mars", "Le Soleil", "Vénus"],
            reponse: 2
        },
        {
            question: "Quel animal est surnommé « le roi de la savane » ?",
            choix: ["Le zèbre", "Le lion", "La girafe", "L'autruche"],
            reponse: 1
        },
        {
            question: "Combien y a-t-il de mois dans une année ?",
            choix: ["10", "11", "12", "13"],
            reponse: 2
        }
    ],
    2: [
        {
            question: "Quel peintre a réalisé « La Joconde » ?",
            choix: ["Pablo Picasso", "Vincent van Gogh", "Léonard de Vinci", "Claude Monet"],
            reponse: 2
        },
        {
            question: "Quel est le plus grand océan du monde ?",
            choix: ["L'océan Atlantique", "L'océan Pacifique", "L'océan Indien", "L'océan Arctique"],
            reponse: 1
        },
        {
            question: "En quelle année l'être humain a-t-il marché sur la Lune pour la première fois ?",
            choix: ["1959", "1969", "1975", "1981"],
            reponse: 1
        },
        {
            question: "Quel est le symbole chimique de l'eau ?",
            choix: ["CO₂", "O₂", "H₂O", "NaCl"],
            reponse: 2
        },
        {
            question: "Qui a écrit le roman « Les Misérables » ?",
            choix: ["Émile Zola", "Victor Hugo", "Gustave Flaubert", "Molière"],
            reponse: 1
        },
        {
            question: "Combien y a-t-il de planètes dans notre système solaire ?",
            choix: ["7", "8", "9", "10"],
            reponse: 1
        },
        {
            question: "Quel grand fleuve traverse l'Égypte ?",
            choix: ["L'Amazone", "Le Danube", "Le Nil", "Le Tigre"],
            reponse: 2
        },
        {
            question: "Quelle est la capitale du Japon ?",
            choix: ["Kyoto", "Osaka", "Séoul", "Tokyo"],
            reponse: 3
        }
    ],
    3: [
        {
            question: "Quelle est la capitale de l'Australie ?",
            choix: ["Sydney", "Melbourne", "Canberra", "Brisbane"],
            reponse: 2
        },
        {
            question: "En quelle année est tombé le mur de Berlin ?",
            choix: ["1979", "1985", "1989", "1993"],
            reponse: 2
        },
        {
            question: "Quel organe humain produit l'insuline ?",
            choix: ["Le foie", "Le pancréas", "La rate", "Les reins"],
            reponse: 1
        },
        {
            question: "Quel traité a officiellement mis fin à la Première Guerre mondiale en 1919 ?",
            choix: ["Le traité de Rome", "Le traité de Versailles", "Le traité de Maastricht", "Le traité d'Utrecht"],
            reponse: 1
        },
        {
            question: "Quel est le plus long fleuve d'Europe ?",
            choix: ["Le Danube", "Le Rhin", "La Volga", "La Loire"],
            reponse: 2
        },
        {
            question: "Quel scientifique a formulé la théorie de l'évolution par sélection naturelle ?",
            choix: ["Louis Pasteur", "Gregor Mendel", "Charles Darwin", "Galilée"],
            reponse: 2
        },
        {
            question: "Quelle est la langue officielle du Brésil ?",
            choix: ["L'espagnol", "Le portugais", "Le français", "L'italien"],
            reponse: 1
        },
        {
            question: "Quel pays possède le plus grand nombre de fuseaux horaires (territoires d'outre-mer inclus) ?",
            choix: ["La Russie", "Les États-Unis", "La France", "Le Canada"],
            reponse: 2
        }
    ],
    4: [
        {
            question: "Quel est le symbole chimique du tungstène ?",
            choix: ["Tu", "Tg", "W", "Tn"],
            reponse: 2
        },
        {
            question: "En quelle année ont été signés les traités de Westphalie mettant fin à la guerre de Trente Ans ?",
            choix: ["1598", "1648", "1713", "1789"],
            reponse: 1
        },
        {
            question: "Quel mathématicien a démontré les théorèmes d'incomplétude en 1931 ?",
            choix: ["Alan Turing", "David Hilbert", "Kurt Gödel", "Henri Poincaré"],
            reponse: 2
        },
        {
            question: "Quelle est la capitale du Kazakhstan ?",
            choix: ["Almaty", "Astana", "Tachkent", "Bichkek"],
            reponse: 1
        },
        {
            question: "Qui a découvert la radioactivité naturelle en 1896 ?",
            choix: ["Ernest Rutherford", "Henri Becquerel", "Niels Bohr", "Max Planck"],
            reponse: 1
        },
        {
            question: "Quel est le numéro atomique de l'or (Au) ?",
            choix: ["47", "79", "82", "92"],
            reponse: 1
        },
        {
            question: "Quel philosophe a écrit la « Critique de la raison pure » (1781) ?",
            choix: ["Georg Hegel", "Emmanuel Kant", "Baruch Spinoza", "Arthur Schopenhauer"],
            reponse: 1
        },
        {
            question: "Quelle est approximativement la valeur de la constante de Planck h (en J·s) ?",
            choix: ["6,626 × 10⁻³⁴", "9,109 × 10⁻³¹", "1,602 × 10⁻¹⁹", "6,022 × 10²³"],
            reponse: 0
        }
    ]
};

function niveauDifficulteMatiere(matiereId) {
    let matiere = trouverMatiere(matiereId);
    if (!matiere) return 2;
    return NIVEAU_PAR_MATIERE[matiere.nom] || 2;
}

function choisirQuestionCaptcha(matiereId, indexExclu) {
    let niveau = niveauDifficulteMatiere(matiereId);
    let liste = QUESTIONS_CAPTCHA[niveau];
    let index = Math.floor(Math.random() * liste.length);
    if (liste.length > 1 && index === indexExclu) {
        index = (index + 1) % liste.length;
    }
    return {
        niveau: niveau,
        libelle: LIBELLES_NIVEAU[niveau],
        index: index,
        question: liste[index]
    };
}
