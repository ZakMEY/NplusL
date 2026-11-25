// ===================================================================
// affichage.js : génération du HTML et gestion des clics
// Ce fichier lit les données UNIQUEMENT via les fonctions de data.js.
// ===================================================================


// Établissement actuellement ouvert.
let etablissementCourant = null;

// Prof dont on regarde la fiche (résumé + bouton noter + toutes les notes).
let profOuvert = null;

// Prof que l'on est en train de noter.
// null = on ajoute un NOUVEAU prof (le formulaire demande alors son nom).
let profCourant = null;

// État du mode administrateur et écran actuellement affiché.
let estAdmin = false;
let sectionCourante = 'section-etablissements';

// Données de la note en attente de validation du captcha.
let noteEnAttente = null;
let captchaCourant = null;

// État de la modale de compte utilisateur.
let modeAuth = 'connexion';
let actionApresConnexion = null;


// ----- Popup Biscuits & Explosion -----

function accepterBiscuits() {
    document.getElementById('contenu-site').classList.remove('hidden');
    document.getElementById('overlay-biscuits').classList.add('hidden');
}

function repondreBiscuitsEncore() {
    let overlay = document.getElementById('overlay-biscuits');
    let carte = document.getElementById('carte-biscuits');
    let zone = document.getElementById('zone-explosion');
    let refuse = document.getElementById('ecran-refuse');
    let site = document.getElementById('contenu-site');

    refuse.classList.add('hidden');
    zone.classList.add('hidden');
    zone.innerHTML = '';
    overlay.classList.remove('anim-secousse', 'bg-black/95');
    site.classList.remove('hidden');
    carte.classList.remove('hidden');
}

function jouerSonExplosion() {
    try {
        let AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        let ctx = new AudioCtx();
        let duree = 0.8;
        let buffer = ctx.createBuffer(1, ctx.sampleRate * duree, ctx.sampleRate);
        let canal = buffer.getChannelData(0);
        for (let i = 0; i < canal.length; i++) {
            canal[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / canal.length, 2);
        }
        let bruit = ctx.createBufferSource();
        bruit.buffer = buffer;

        let filtre = ctx.createBiquadFilter();
        filtre.type = 'lowpass';
        filtre.frequency.setValueAtTime(600, ctx.currentTime);
        filtre.frequency.exponentialRampToValueAtTime(60, ctx.currentTime + duree);

        let gain = ctx.createGain();
        gain.gain.setValueAtTime(0.6, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duree);

        bruit.connect(filtre);
        filtre.connect(gain);
        gain.connect(ctx.destination);
        bruit.start();
    } catch (e) {
        // Ignorer si l'audio est bloqué par le navigateur
    }
}

function refuserBiscuits() {
    let overlay = document.getElementById('overlay-biscuits');
    let carte = document.getElementById('carte-biscuits');
    let zone = document.getElementById('zone-explosion');
    let refuse = document.getElementById('ecran-refuse');
    let site = document.getElementById('contenu-site');

    carte.classList.add('hidden');
    site.classList.add('hidden');
    overlay.classList.remove('anim-secousse');
    void overlay.offsetWidth;
    overlay.classList.add('anim-secousse', 'bg-black/95');

    jouerSonExplosion();

    let symboles = ['💥', '🔥', '🍪', '💨', '✨', '⚡'];
    let html = '<div class="explosion-flash"></div><div class="explosion-onde"></div>';

    for (let i = 0; i < 42; i++) {
        let angle = (Math.PI * 2 * i) / 42 + (Math.random() - 0.5) * 0.3;
        let distance = 120 + Math.random() * 300;
        let dx = Math.round(Math.cos(angle) * distance) + 'px';
        let dy = Math.round(Math.sin(angle) * distance) + 'px';
        let rot = Math.round((Math.random() - 0.5) * 720) + 'deg';
        let taille = Math.round(18 + Math.random() * 28) + 'px';
        let duree = (0.65 + Math.random() * 0.45).toFixed(2) + 's';
        let symbole = symboles[Math.floor(Math.random() * symboles.length)];

        html += `<span class="explosion-particule" style="--dx:${dx}; --dy:${dy}; --rot:${rot}; --taille:${taille}; --duree:${duree};">${symbole}</span>`;
    }

    zone.innerHTML = html;
    zone.classList.remove('hidden');

    setTimeout(function () {
        refuse.classList.remove('hidden');
    }, 850);
}


// ----- Outils -----

function echapper(texte) {
    return String(texte)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formaterDate(date) {
    let p = date.split('-');
    return p[2] + '.' + p[1] + '.' + p[0];
}

function formaterNote(valeur) {
    return String(valeur).replace('.', ',');
}

function montrerErreur(idErreur, message) {
    let zone = document.getElementById(idErreur);
    if (message) {
        zone.textContent = message;
        zone.classList.remove('hidden');
    } else {
        zone.textContent = '';
        zone.classList.add('hidden');
    }
}

const CHAMPS_NOTE = [
    {cle: 'nom',         champ: 'nom-prof',         erreur: 'erreur-nom',         rouge: 'input-error'},
    {cle: 'matiere',     champ: 'matiere-note',     erreur: 'erreur-matiere',     rouge: 'select-error'},
    {cle: 'note',        champ: 'valeur-note',      erreur: 'erreur-note',        rouge: 'input-error'},
    {cle: 'commentaire', champ: 'commentaire-note', erreur: 'erreur-commentaire', rouge: 'textarea-error'},
    {cle: 'date',        champ: 'date-note',        erreur: 'erreur-date',        rouge: 'input-error'}
];

function afficherErreursNote(erreurs) {
    CHAMPS_NOTE.forEach(function (c) {
        let message = erreurs[c.cle];
        montrerErreur(c.erreur, message);
        document.getElementById(c.champ).classList.toggle(c.rouge, Boolean(message));
    });
}


// ----- Comptes utilisateurs -----

function mettreAJourBoutonCompte() {
    let btn = document.getElementById('btn-compte');
    let user = obtenirUtilisateurCourant();
    if (user) {
        btn.className = 'btn btn-chalk-ghost btn-xs text-green-300';
        btn.innerHTML = `<i class="fa-solid fa-user-check"></i> ${echapper(user.pseudo)}`;
    } else {
        btn.className = 'btn btn-chalk-ghost btn-xs';
        btn.innerHTML = '<i class="fa-solid fa-user"></i> Connexion';
    }
}

function clicCompte() {
    ouvrirModalCompte(null, null);
}

function ouvrirModalCompte(messageContexte, suiteCallback) {
    actionApresConnexion = suiteCallback || null;
    let user = obtenirUtilisateurCourant();

    if (user) {
        document.getElementById('vue-auth-formulaire').classList.add('hidden');
        document.getElementById('vue-auth-profil').classList.remove('hidden');
        document.getElementById('profil-pseudo').textContent = user.pseudo;
        document.getElementById('profil-email').textContent = user.email;
    } else {
        document.getElementById('vue-auth-profil').classList.add('hidden');
        document.getElementById('vue-auth-formulaire').classList.remove('hidden');

        let zoneCtx = document.getElementById('message-auth-contexte');
        if (messageContexte) {
            zoneCtx.textContent = messageContexte;
            zoneCtx.classList.remove('hidden');
        } else {
            zoneCtx.textContent = '';
            zoneCtx.classList.add('hidden');
        }

        document.getElementById('auth-pseudo').value = '';
        document.getElementById('auth-email').value = '';
        document.getElementById('auth-mdp').value = '';
        montrerErreur('erreur-auth', null);
        montrerErreur('succes-auth', null);
        changerModeAuth('connexion');
    }

    document.getElementById('modal-compte').showModal();
}

function fermerModalCompte() {
    actionApresConnexion = null;
    document.getElementById('modal-compte').close();
}

function changerModeAuth(mode) {
    modeAuth = mode;
    let estInscription = (mode === 'inscription');

    document.getElementById('bloc-auth-pseudo').classList.toggle('hidden', !estInscription);
    document.getElementById('auth-pseudo').required = estInscription;

    document.getElementById('tab-connexion').className = estInscription
        ? 'btn btn-chalk-ghost btn-sm flex-1'
        : 'btn btn-chalk-primary btn-sm flex-1';
    document.getElementById('tab-inscription').className = estInscription
        ? 'btn btn-chalk-primary btn-sm flex-1'
        : 'btn btn-chalk-ghost btn-sm flex-1';

    document.getElementById('btn-submit-auth').textContent = estInscription
        ? 'Créer mon compte'
        : 'Se connecter';

    montrerErreur('erreur-auth', null);
    montrerErreur('succes-auth', null);
}

async function soumettreAuth(event) {
    event.preventDefault();
    let pseudo = document.getElementById('auth-pseudo').value;
    let email = document.getElementById('auth-email').value;
    let mdp = document.getElementById('auth-mdp').value;
    let btn = document.getElementById('btn-submit-auth');

    montrerErreur('erreur-auth', null);
    montrerErreur('succes-auth', null);
    btn.disabled = true;

    let resultat;
    if (modeAuth === 'inscription') {
        resultat = await inscrireUtilisateur(pseudo, email, mdp);
    } else {
        resultat = await connecterUtilisateur(email, mdp);
    }

    btn.disabled = false;

    if (!resultat.ok) {
        montrerErreur('erreur-auth', resultat.erreur);
        return;
    }

    if (resultat.confirmationRequise) {
        montrerErreur('succes-auth', resultat.message);
        return;
    }

    let suite = actionApresConnexion;
    actionApresConnexion = null;
    document.getElementById('modal-compte').close();
    mettreAJourBoutonCompte();
    rafraichirEcranCourant();

    if (typeof suite === 'function') {
        suite();
    }
}

async function seDeconnecter() {
    await deconnecterUtilisateur();
    fermerModalCompte();
    mettreAJourBoutonCompte();
    rafraichirEcranCourant();
}

function exigerConnexion(message, action) {
    if (estConnecte()) {
        action();
    } else {
        ouvrirModalCompte(message, action);
    }
}


// ----- Mode Admin -----

function mettreAJourBoutonAdmin() {
    let btn = document.getElementById('btn-admin');
    if (estAdmin) {
        btn.className = 'btn btn-chalk-primary btn-xs';
        btn.innerHTML = '<i class="fa-solid fa-unlock"></i> Admin · Quitter';
    } else {
        btn.className = 'btn btn-chalk-ghost btn-xs';
        btn.innerHTML = '<i class="fa-solid fa-lock"></i> Admin';
    }
}

function clicAdmin() {
    if (estAdmin) {
        estAdmin = false;
        quitterModeAdmin();
        mettreAJourBoutonAdmin();
        rafraichirEcranCourant();
    } else {
        let champ = document.getElementById('champ-code-admin');
        champ.value = '';
        champ.classList.remove('input-error');
        montrerErreur('erreur-admin', null);
        document.getElementById('modal-admin').showModal();
        champ.focus();
    }
}

function fermerModalAdmin() {
    document.getElementById('modal-admin').close();
}

async function validerCodeAdmin(event) {
    event.preventDefault();
    let champ = document.getElementById('champ-code-admin');

    let valide = await verifierCodeAdmin(champ.value);
    if (valide) {
        estAdmin = true;
        mettreAJourBoutonAdmin();
        fermerModalAdmin();
        rafraichirEcranCourant();
    } else {
        montrerErreur('erreur-admin', 'Code incorrect.');
        champ.classList.add('input-error');
    }
}

async function confirmerSuppressionEtablissement(id) {
    let etab = trouverEtablissement(id);
    if (!etab) return;
    if (confirm(`Supprimer l'établissement « ${etab.nom} » ainsi que tous ses profs et notes ?`)) {
        let res = await supprimerEtablissement(id);
        if (!res.ok) {
            alert(res.erreur || 'Erreur lors de la suppression.');
            return;
        }
        afficherEtablissements();
    }
}

async function confirmerSuppressionProf(id) {
    let prof = trouverProf(id);
    if (!prof) return;
    if (confirm(`Supprimer le prof « ${prof.nom} » et toutes ses notes ?`)) {
        let res = await supprimerProf(id);
        if (!res.ok) {
            alert(res.erreur || 'Erreur lors de la suppression.');
            return;
        }
        afficherDetailEtablissement();
    }
}

async function confirmerSuppressionNote(id) {
    if (confirm('Supprimer cette note ?')) {
        let res = await supprimerNote(id, estAdmin);
        if (!res.ok) {
            alert(res.erreur || 'Erreur lors de la suppression.');
            return;
        }
        afficherFicheProf();
    }
}


// ----- Captcha Culture Générale -----

function afficherQuestionCaptcha(matiereId, indexExclu) {
    captchaCourant = choisirQuestionCaptcha(matiereId, indexExclu);
    let matiere = trouverMatiere(matiereId);

    let badge = document.getElementById('badge-difficulte-captcha');
    badge.textContent = `Niveau ${captchaCourant.niveau}/4 · ${captchaCourant.libelle.nom}`;
    badge.className = `badge badge-outline text-xs ${captchaCourant.libelle.classe}`;

    document.getElementById('info-matiere-captcha').textContent =
        `Matière notée : ${matiere ? matiere.nom : ''}`;
    document.getElementById('question-captcha').textContent = captchaCourant.question.question;

    let lettres = ['A', 'B', 'C', 'D'];
    let html = '';
    captchaCourant.question.choix.forEach(function (texteChoix, idx) {
        html += `<button type="button" class="btn btn-chalk-choice w-full" onclick="verifierReponseCaptcha(${idx})">
                    <span class="font-bold text-amber-200 mr-2">${lettres[idx]}.</span>
                    <span>${echapper(texteChoix)}</span>
                 </button>`;
    });
    document.getElementById('choix-captcha').innerHTML = html;
}

function ouvrirCaptcha(matiereId) {
    montrerErreur('erreur-captcha', null);
    afficherQuestionCaptcha(matiereId, -1);
    document.getElementById('modal-captcha').showModal();
}

function fermerModalCaptcha() {
    noteEnAttente = null;
    captchaCourant = null;
    document.getElementById('modal-captcha').close();
}

async function verifierReponseCaptcha(indexChoisi) {
    if (!captchaCourant || !noteEnAttente) return;

    if (indexChoisi === captchaCourant.question.reponse) {
        let n = noteEnAttente;
        // Désactive les boutons pendant l'enregistrement
        document.querySelectorAll('#choix-captcha button').forEach(b => b.disabled = true);

        let res;
        if (n.profId === null) {
            res = await ajouterProfAvecNote(
                n.etablissementId, n.nomProf, n.matiereId, n.valeur, n.commentaire, n.date
            );
        } else {
            res = await ajouterNote(n.profId, n.matiereId, n.valeur, n.commentaire, n.date);
        }

        if (!res.ok) {
            document.querySelectorAll('#choix-captcha button').forEach(b => b.disabled = false);
            montrerErreur('erreur-captcha', res.erreur || 'Erreur lors de la sauvegarde.');
            return;
        }

        document.getElementById('modal-captcha').close();
        noteEnAttente = null;
        captchaCourant = null;
        profCourant = null;

        if (n.profId === null) {
            afficherDetailEtablissement();
        } else {
            afficherFicheProf();
        }
    } else {
        montrerErreur('erreur-captcha', 'Mauvaise réponse ! Voici une nouvelle question.');
        afficherQuestionCaptcha(noteEnAttente.matiereId, captchaCourant.index);
    }
}


// ----- Navigation -----

function afficherSection(id) {
    let sections = ['section-etablissements', 'section-etablissement', 'section-prof', 'section-note'];
    sections.forEach(function (section) {
        document.getElementById(section).classList.add('hidden');
    });
    document.getElementById(id).classList.remove('hidden');
    sectionCourante = id;
}

function rafraichirEcranCourant() {
    if (sectionCourante === 'section-etablissements') {
        afficherEtablissements();
    } else if (sectionCourante === 'section-etablissement') {
        afficherDetailEtablissement();
    } else if (sectionCourante === 'section-prof') {
        afficherFicheProf();
    }
}

async function retourAccueil() {
    etablissementCourant = null;
    profOuvert = null;
    profCourant = null;
    if (estEnLigne()) {
        await chargerDonnees();
    }
    afficherEtablissements();
}

function retourEtablissement() {
    profOuvert = null;
    afficherDetailEtablissement();
}

function ouvrirEtablissement(id) {
    etablissementCourant = id;
    document.getElementById('recherche-prof').value = '';
    afficherDetailEtablissement();
}


// ----- Écran 1 : liste des établissements -----

function afficherEtablissements() {
    let html = '';
    listerEtablissements().forEach(function (etablissement) {
        let nbProfs = listerProfs(etablissement.id).length;
        let texteProfs = nbProfs + (nbProfs > 1 ? ' profs' : ' prof');

        let btnSupprimer = '';
        if (estAdmin) {
            btnSupprimer = `<button type="button" onclick="confirmerSuppressionEtablissement(${etablissement.id})"
                                    class="btn btn-chalk-ghost btn-xs text-red-300" title="Supprimer">
                                <i class="fa-solid fa-trash"></i>
                            </button>`;
        }

        html += `<li class="flex items-center gap-1 border-b chalk-divider last:border-b-0">
                    <button type="button" onclick="ouvrirEtablissement(${etablissement.id})"
                            class="flex flex-1 items-center gap-2 px-2 py-3 text-left rounded-lg cursor-pointer hover:bg-white/10 active:bg-white/15 transition-colors">
                        <span class="flex-1 font-medium text-lg">${echapper(etablissement.nom)}</span>
                        <span class="chalk-muted text-sm">${texteProfs}</span>
                        <i class="fa-solid fa-chevron-right text-xs chalk-muted"></i>
                    </button>
                    ${btnSupprimer}
                 </li>`;
    });

    if (html === '') {
        html = '<li class="chalk-muted">Aucun établissement pour l\'instant. Ajoute le tien ci-dessous.</li>';
    }

    document.getElementById('liste-etablissements').innerHTML = html;
    afficherSection('section-etablissements');
}

function validerEtablissement() {
    exigerConnexion('Connecte-toi ou crée un compte pour ajouter un établissement.', async function () {
        let champ = document.getElementById('nom-etablissement');
        let btn = document.getElementById('btn-ajouter-etab');
        let erreur = verifierNomEtablissement(champ.value);

        montrerErreur('erreur-etablissement', erreur);
        champ.classList.toggle('input-error', erreur !== null);

        if (erreur === null) {
            btn.disabled = true;
            let res = await ajouterEtablissement(champ.value);
            btn.disabled = false;

            if (!res.ok) {
                montrerErreur('erreur-etablissement', res.erreur || 'Erreur lors de l\'ajout.');
                return;
            }
            champ.value = '';
            afficherEtablissements();
        }
    });
}


// ----- Écran 2 : un établissement et ses profs -----

function afficherDetailEtablissement() {
    let etab = trouverEtablissement(etablissementCourant);
    if (!etab) {
        afficherEtablissements();
        return;
    }
    document.getElementById('titre-etablissement').textContent = etab.nom;
    afficherClassement();
    afficherProfs();
    afficherSection('section-etablissement');
}

function afficherClassement() {
    let classement = classementEtablissement(etablissementCourant);
    let contenu;

    if (classement === null) {
        contenu = '<p class="chalk-muted">Pas encore de notes dans cet établissement.</p>';
    } else {
        contenu = ligneClassement('fa-trophy', 'text-green-300', 'Mieux noté', classement.meilleur);
        if (classement.pire !== null) {
            contenu += ligneClassement('fa-arrow-trend-down', 'text-red-300', 'Moins bien noté', classement.pire);
        }
    }

    document.getElementById('bloc-classement').innerHTML =
        `<div class="card-body p-4 gap-3">
            <h2 class="card-title text-xl">Classement</h2>
            ${contenu}
         </div>`;
}

function ligneClassement(icone, couleur, titre, entree) {
    let nb = entree.nb;
    return `<div class="flex items-center gap-3">
                <i class="fa-solid ${icone} ${couleur} w-5 text-center"></i>
                <div class="flex-1">
                    <div class="text-xs chalk-muted">${titre}</div>
                    <div class="font-semibold text-lg">${echapper(entree.prof.nom)}</div>
                </div>
                <span class="font-bold whitespace-nowrap text-amber-200">${entree.moyenne.toFixed(1)} / 10
                    <span class="font-normal chalk-muted text-sm">(${nb} ${nb > 1 ? 'notes' : 'note'})</span>
                </span>
            </div>`;
}

function afficherProfs() {
    let recherche = document.getElementById('recherche-prof').value.trim().toLowerCase();
    let html = '';

    listerProfs(etablissementCourant).forEach(function (prof) {
        if (recherche !== '' && !prof.nom.toLowerCase().includes(recherche)) {
            return;
        }

        let moyenne = moyenneProf(prof.id);
        let texteMoyenne = 'Pas de note';
        if (moyenne !== null) {
            let nb = compterNotes(prof.id);
            texteMoyenne = moyenne.toFixed(1) + ' / 10 (' + nb + (nb > 1 ? ' notes)' : ' note)');
        }

        let matieres = listerMatieresDeProf(prof.id).map(m => echapper(m.nom)).join(', ');

        let btnSupprimer = '';
        if (estAdmin) {
            btnSupprimer = `<button type="button" onclick="confirmerSuppressionProf(${prof.id})"
                                    class="btn btn-chalk-ghost btn-xs text-red-300" title="Supprimer">
                                <i class="fa-solid fa-trash"></i>
                            </button>`;
        }

        html += `<li class="flex items-center gap-1 border-b chalk-divider last:border-b-0">
                    <button type="button" onclick="ouvrirProf(${prof.id})"
                            class="flex flex-1 items-center gap-2 px-2 py-3 text-left rounded-lg cursor-pointer hover:bg-white/10 active:bg-white/15 transition-colors">
                        <div class="flex-1">
                            <div class="font-semibold text-lg">${echapper(prof.nom)}</div>
                            <div class="text-sm chalk-muted">${matieres}</div>
                        </div>
                        <span class="font-bold whitespace-nowrap text-amber-200">${texteMoyenne}</span>
                        <i class="fa-solid fa-chevron-right text-xs chalk-muted"></i>
                    </button>
                    ${btnSupprimer}
                 </li>`;
    });

    if (html === '') {
        if (recherche !== '') {
            html = '<li class="chalk-muted py-2">Aucun prof ne correspond. Utilise « Ajouter un prof ».</li>';
        } else {
            html = '<li class="chalk-muted py-2">Aucun prof dans cet établissement.</li>';
        }
    }
    document.getElementById('liste-profs').innerHTML = html;
}


// ----- Écran 3 : fiche d'un prof (résumé + bouton noter + toutes les notes) -----

function ouvrirProf(profId) {
    profOuvert = profId;
    afficherFicheProf();
}

function afficherFicheProf() {
    let prof = trouverProf(profOuvert);
    if (!prof) {
        afficherDetailEtablissement();
        return;
    }
    document.getElementById('titre-prof').textContent = prof.nom;

    let moyenne = moyenneProf(prof.id);
    let nb = compterNotes(prof.id);
    let texteMoyenne = 'Pas encore de note';
    if (moyenne !== null) {
        texteMoyenne = moyenne.toFixed(1) + ' / 10 (' + nb + (nb > 1 ? ' notes)' : ' note)');
    }
    let matieres = listerMatieresDeProf(prof.id).map(m => echapper(m.nom)).join(', ');

    document.getElementById('resume-prof').innerHTML =
        `<div class="text-2xl font-bold text-amber-200">${texteMoyenne}</div>
         <div class="chalk-muted">${matieres}</div>`;

    let user = obtenirUtilisateurCourant();
    let html = '';
    listerNotesRecentes(prof.id).forEach(function (note) {
        let matiere = trouverMatiere(note.matiereId);
        let commentaire = '';
        if (note.commentaire !== '') {
            commentaire = `<p class="mt-1">${echapper(note.commentaire)}</p>`;
        }

        let estSaNote = Boolean(user && note.userId && note.userId === user.id);
        let badgeToi = estSaNote
            ? '<span class="badge badge-outline badge-xs text-green-300 border-green-300 ml-1">Ta note</span>'
            : '';

        let btnSupprimer = '';
        if (estAdmin || estSaNote) {
            btnSupprimer = `<button type="button" onclick="confirmerSuppressionNote(${note.id})"
                                    class="btn btn-chalk-ghost btn-xs text-red-300" title="Supprimer">
                                <i class="fa-solid fa-trash"></i>
                            </button>`;
        }

        html += `<li class="py-3 border-b chalk-divider last:border-b-0">
                    <div class="flex items-center justify-between gap-2">
                        <span class="font-bold text-lg text-amber-200">
                            ${formaterNote(note.valeur)} / 10 ${badgeToi}
                        </span>
                        <div class="flex items-center gap-2">
                            <span class="text-sm chalk-muted">
                                ${matiere ? echapper(matiere.nom) : ''} · ${formaterDate(note.date)}
                            </span>
                            ${btnSupprimer}
                        </div>
                    </div>
                    ${commentaire}
                 </li>`;
    });

    if (html === '') {
        html = '<li class="chalk-muted py-2">Aucune note pour l\'instant.</li>';
    }
    document.getElementById('liste-avis').innerHTML = html;

    afficherSection('section-prof');
}


// ----- Écran 4 : formulaire de note -----

function ouvrirFormNote(profId) {
    let msg = profId === null
        ? 'Connecte-toi ou crée un compte pour ajouter un prof et lui donner une note.'
        : 'Connecte-toi ou crée un compte pour donner une note.';

    exigerConnexion(msg, function () {
        profCourant = profId;

        let options = '';
        listerMatieres().forEach(function (matiere) {
            options += `<option value="${matiere.id}">${echapper(matiere.nom)}</option>`;
        });
        let selection = document.getElementById('matiere-note');
        selection.innerHTML = options;

        if (profId === null) {
            document.getElementById('titre-note').textContent = 'Ajouter un prof et lui donner une note';
            document.getElementById('bloc-nom-prof').classList.remove('hidden');
            document.getElementById('civilite-prof').value = 'M.';
        } else {
            document.getElementById('titre-note').textContent = 'Donne ta note à ' + trouverProf(profId).nom;
            document.getElementById('bloc-nom-prof').classList.add('hidden');

            let matieresProf = listerMatieresDeProf(profId);
            if (matieresProf.length > 0) {
                selection.value = matieresProf[0].id;
            }
        }

        document.getElementById('nom-prof').value = '';
        document.getElementById('valeur-note').value = '';
        document.getElementById('commentaire-note').value = '';
        afficherErreursNote({});

        let champDate = document.getElementById('date-note');
        champDate.value = dateAujourdhui();
        champDate.max = dateAujourdhui();

        afficherSection('section-note');
    });
}

function validerNote() {
    let texteNote = document.getElementById('valeur-note').value.trim();
    let valeur = NaN;
    if (texteNote !== '') {
        valeur = Number(texteNote);
    }

    let matiereId = Number(document.getElementById('matiere-note').value);
    let commentaire = document.getElementById('commentaire-note').value;
    let date = document.getElementById('date-note').value;

    let civilite = document.getElementById('civilite-prof').value;
    let nomBrut = document.getElementById('nom-prof').value;
    let nomComplet = construireNomProf(civilite, nomBrut);

    let erreurs = verifierNote(matiereId, valeur, commentaire, date);
    if (profCourant === null) {
        let erreurNom = verifierNomProf(etablissementCourant, nomComplet);
        if (erreurNom !== null) {
            erreurs.nom = erreurNom;
        }
    }
    afficherErreursNote(erreurs);
    if (Object.keys(erreurs).length > 0) {
        return;
    }

    noteEnAttente = {
        profId: profCourant,
        etablissementId: etablissementCourant,
        nomProf: nomComplet,
        matiereId: matiereId,
        valeur: valeur,
        commentaire: commentaire,
        date: date
    };
    ouvrirCaptcha(matiereId);
}

function annulerNote() {
    let etaitNouveauProf = (profCourant === null);
    profCourant = null;
    if (etaitNouveauProf) {
        afficherDetailEtablissement();
    } else {
        afficherFicheProf();
    }
}


// ----- Démarrage -----

async function demarrerApplication() {
    mettreAJourBoutonAdmin();

    let statut = document.getElementById('statut-stockage');
    statut.innerHTML = estEnLigne()
        ? '<i class="fa-solid fa-cloud text-green-300"></i> Mode en ligne (Supabase)'
        : '<i class="fa-solid fa-laptop"></i> Mode local (configure Supabase dans data.js pour partager en ligne)';

    await chargerSessionUtilisateur();
    mettreAJourBoutonCompte();

    ecouterChangementsSession(function () {
        mettreAJourBoutonCompte();
        rafraichirEcranCourant();
    });

    let res = await chargerDonnees();
    if (!res.ok) {
        document.getElementById('liste-etablissements').innerHTML =
            `<li class="text-red-300">Impossible de charger les données en ligne : ${echapper(res.erreur)}</li>`;
        return;
    }

    afficherEtablissements();
}

demarrerApplication();
