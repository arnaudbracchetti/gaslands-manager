<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Saisons — Wireframes</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Kalam:wght@300;400;700&family=Caveat:wght@500;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="wf-styles.css">
</head>
<body>
<div class="app">

  <!-- ============ SIDEBAR ============ -->
  <aside class="sidebar">
    <div class="brand"><b>SAISONS</b><span>wireframes — Gaslands</span></div>
    <ul class="nav" id="nav">
      <li><button data-go="liste" class="on">Liste des saisons <span class="n">/seasons</span></button></li>
      <li><button data-go="creer">Créer une saison <span class="n">modale</span></button></li>
      <li><button data-go="rejoindre">Rejoindre via code <span class="n">/join/:code</span></button></li>
      <li><button data-go="detail">Détail saison <span class="n">/seasons/:id</span></button></li>
      <li><button data-go="partie">Ajouter une partie <span class="n">game-form</span></button></li>
    </ul>
    <div class="legend">
      <h4>Rôles &amp; états</h4>
      <div>
        <span class="badge orga">Organisateur</span>
        <span class="badge part">Participant</span>
        <span class="badge wait">En attente</span>
      </div>
      <div style="margin-top:10px">
        <span class="state construc"><span class="dot"></span>EN_CONSTRUCTION</span><br>
        <span class="state cours" style="margin-top:7px"><span class="dot"></span>EN_COURS</span><br>
        <span class="state fini" style="margin-top:7px"><span class="dot"></span>TERMINÉE</span>
      </div>
      <p class="tip">Croquis basse-fidélité — on explore la structure et le parcours, pas le visuel final. Ouvre <b>Tweaks</b> pour basculer croquis/propre, l'accent et les annotations.</p>
    </div>
  </aside>

  <!-- ============ MAIN ============ -->
  <main class="main">

    <!-- ========== LISTE ========== -->
    <section class="section active" id="s-liste">
      <div class="screen-head">
        <h1>Liste des saisons</h1>
        <span class="route">/seasons — smart</span>
      </div>
      <p class="lead">Point d'entrée unique : saisons organisées, participations et demandes en attente dans une seule vue, différenciées par badges. Actions globales : <b>+ Créer une saison</b> et <b>Rejoindre via code</b>.</p>

      <div class="variants">

        <!-- grille mixte — retenu -->
        <div class="variant wide">
          <div class="variant-label"><b>Grille mixte</b><span class="tag">Retenu</span></div>
          <div class="frame sketch">
            <div class="frame-bar"><div class="dots"><i></i><i></i><i></i></div><div class="url">app.gaslands.io/seasons</div></div>
            <div class="frame-body">
              <div class="appbar">
                <div class="ttl">Mes saisons</div>
                <div class="row-actions">
                  <button class="btn ghost sm">⌗ Rejoindre via code</button>
                  <button class="btn accent sm">+ Créer une saison</button>
                </div>
              </div>
              <div class="grid">
                <div class="card sketch">
                  <div class="top"><h3 class="nm">Coupe Verney</h3><span class="state construc"><span class="dot"></span>CONSTR.</span></div>
                  <div class="meta"><span class="badge orga">Organisateur</span></div>
                  <div class="alert flat mb0" style="margin:10px 0 0">2 demandes à valider</div>
                </div>
                <div class="card sketch hd2">
                  <div class="top"><h3 class="nm">Ligue Rust Belt</h3><span class="state cours"><span class="dot"></span>EN COURS</span></div>
                  <div class="meta"><span class="badge part">Participant</span><span class="small ink2">· Scrap Kings</span></div>
                  <div class="foot"><span class="small muted">8 équipes · 5 parties</span><span class="small">Ouvrir →</span></div>
                </div>
                <div class="card sketch hd3">
                  <div class="top"><h3 class="nm">Tournoi Carnage</h3><span class="state fini"><span class="dot"></span>FINIE</span></div>
                  <div class="meta"><span class="badge part">Participant</span><span class="small ink2">· Furies</span></div>
                  <div class="foot"><span class="small muted">archivée · lecture seule</span><span class="small">Ouvrir →</span></div>
                </div>
                <div class="card sketch">
                  <div class="top"><h3 class="nm">Death Race 26</h3><span class="state construc"><span class="dot"></span>CONSTR.</span></div>
                  <div class="meta"><span class="badge wait">En attente</span></div>
                  <div class="foot"><span class="small muted">demande envoyée</span><span class="small muted">verrouillé</span></div>
                </div>
              </div>
              <div class="callout">Une carte = une ligne où je suis impliqué. Le badge dit pourquoi.</div>
            </div>
          </div>
        </div>


      </div>
    </section>

    <!-- ========== CREER ========== -->
    <section class="section" id="s-creer">
      <div class="screen-head">
        <h1>Créer une saison</h1>
        <span class="route">modale — POST /api/seasons { name, teamId }</span>
      </div>
      <p class="lead">Modale simple façon <b>team-form</b> : un nom + le choix de l'équipe que je vais engager. À la création je deviens automatiquement organisateur, status VALIDATED, et un code d'invitation est généré.</p>

      <div class="variants">
        <div class="variant">
          <div class="variant-label"><b>Le formulaire</b></div>
          <div class="frame sketch">
            <div class="frame-bar"><div class="dots"><i></i><i></i><i></i></div><div class="url">/seasons → modale</div></div>
            <div class="modal-stage">
              <div class="modal sketch">
                <div class="mh"><b>Nouvelle saison</b><span class="x">✕</span></div>
                <div class="field"><label>Nom de la saison</label><div class="input">Coupe Verney</div></div>
                <div class="field"><label>Mon équipe engagée <span class="small muted">— optionnel</span></label><div class="input select">Furies</div>
                  <div class="spaced" style="margin-top:7px;justify-content:space-between"><button class="btn ghost sm">+ Créer une nouvelle équipe</button><span class="small muted">ou laisser vide</span></div>
                  <div class="callout">L'organisateur n'est pas obligé d'engager une équipe : il peut gérer la saison sans, ou en créer une à la volée ici. Sinon, une seule équipe par saison.</div>
                </div>
                <div class="mfoot"><button class="btn">Annuler</button><button class="btn accent">Créer la saison</button></div>
              </div>
            </div>
          </div>
        </div>

        <div class="variant">
          <div class="variant-label"><b>Juste après</b><span>état initial</span></div>
          <div class="frame sketch hd2">
            <div class="frame-bar"><div class="dots"><i></i><i></i><i></i></div><div class="url">/seasons/12 — créée</div></div>
            <div class="frame-body">
              <div class="banner sketch hd3" style="margin-bottom:12px">
                <span class="state construc"><span class="dot"></span>EN_CONSTRUCTION</span>
                <span class="code">🔗 <b>ABCD-1234</b> · copier</span>
                <span class="spacer"></span>
                <button class="btn accent sm">Passer EN_COURS</button>
              </div>
              <div class="card sketch hd2" style="margin-bottom:12px;background:var(--paper2)">
                <p class="small ink2 mb0 mt0">Aucun participant pour l'instant. Partage le code d'invitation pour que d'autres équipes puissent rejoindre.</p>
              </div>
              <div class="sec-h"><span class="lbl"><b>Participants</b><span>1</span></span></div>
              <div class="prow mb0" style="margin-bottom:8px"><span class="avatar">AL</span><div class="who"><b>Alice · Furies</b><small>moi — avec équipe</small></div><span class="badge orga">Organisateur</span></div>
              <div class="prow mb0" style="border-style:dashed"><span class="avatar">AL</span><div class="who"><b>Alice</b><small>moi — sans équipe engagée</small></div><span class="badge orga">Organisateur</span></div>
              <div class="callout">Deux états possibles : avec ou sans équipe engagée. Sans équipe, on affiche juste le nom de l'organisateur.</div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ========== REJOINDRE ========== -->
    <section class="section" id="s-rejoindre">
      <div class="screen-head">
        <h1>Rejoindre via code</h1>
        <span class="route">/seasons/join/:code — smart</span>
      </div>
      <p class="lead">Flux en 3 étapes : saisie du code → confirmation de la saison + choix d'équipe → demande envoyée (PENDING). Chaque frame ci-dessous est un écran distinct de la cinématique.</p>

      <!-- ÉTAPE 1 : saisie du code -->
      <div class="sec-h" style="margin-top:22px"><span class="lbl"><b>Étape 1</b><span>Saisir le code</span></span><span class="steps"><i class="on">1</i><span class="ln"></span><i>2</i><span class="ln"></span><i>3</i></span></div>
      <div class="variants">
        <div class="variant">
          <div class="variant-label"><b>Via modale</b><span>depuis la liste /seasons</span></div>
          <div class="frame sketch">
            <div class="frame-bar"><div class="dots"><i></i><i></i><i></i></div><div class="url">/seasons → modale</div></div>
            <div class="modal-stage" style="min-height:220px">
              <div class="modal sketch">
                <div class="mh"><b>Rejoindre via code</b><span class="x">✕</span></div>
                <div class="field"><label>Code d'invitation</label><div class="input" style="letter-spacing:3px;font-size:16px">ABCD-1234</div></div>
                <div class="mfoot"><button class="btn">Annuler</button><button class="btn accent">Valider le code →</button></div>
              </div>
            </div>
          </div>
        </div>
        <div class="variant">
          <div class="variant-label"><b>Via lien direct</b><span>partage par URL — saute l'étape 1</span></div>
          <div class="frame sketch hd2">
            <div class="frame-bar"><div class="dots"><i></i><i></i><i></i></div><div class="url">/seasons/join/ABCD-1234</div></div>
            <div class="frame-body" style="display:flex;align-items:center;justify-content:center;min-height:140px">
              <div class="ph" style="width:100%;padding:22px;text-align:center">Code résolu automatiquement depuis l'URL<br><span class="small muted">→ passe directement à l'étape 2</span></div>
            </div>
          </div>
        </div>
      </div>

      <!-- ÉTAPE 2 : confirmation + choix équipe -->
      <hr class="dash-rule">
      <div class="sec-h"><span class="lbl"><b>Étape 2</b><span>Confirmer &amp; choisir son équipe</span></span><span class="steps"><i class="done">1</i><span class="ln"></span><i class="on">2</i><span class="ln"></span><i>3</i></span></div>
      <div class="variants">
        <div class="variant">
          <div class="variant-label"><b>Code valide</b><span>saison EN_CONSTRUCTION</span></div>
          <div class="frame sketch">
            <div class="frame-bar"><div class="dots"><i></i><i></i><i></i></div><div class="url">/seasons/join/ABCD-1234</div></div>
            <div class="frame-body">
              <div class="card sketch mb0" style="margin-bottom:14px">
                <h3 class="nm mt0">Coupe Verney</h3>
                <div class="meta"><span class="state construc"><span class="dot"></span>EN_CONSTRUCTION</span></div>
                <p class="small ink2 mb0" style="margin-top:8px">Organisée par <b>Alice</b> · 3 participants validés</p>
              </div>
              <div class="field"><label>Avec quelle équipe ?</label><div class="input select">Roadkill</div>
                <div class="callout">Seules mes équipes non déjà engagées ailleurs dans cette saison sont proposées.</div>
              </div>
              <button class="btn accent" style="width:100%;text-align:center">Demander à rejoindre →</button>
            </div>
          </div>
        </div>
        <div class="variant">
          <div class="variant-label"><b>Cas d'erreur</b><span>code invalide / saison fermée</span></div>
          <div class="frame sketch hd2">
            <div class="frame-bar"><div class="dots"><i></i><i></i><i></i></div><div class="url">/seasons/join/XXXX</div></div>
            <div class="frame-body">
              <div class="alert" style="margin-bottom:12px">Code invalide ou expiré</div>
              <div class="alert flat" style="margin-bottom:12px">Saison déjà EN_COURS — inscriptions fermées</div>
              <div class="alert flat" style="margin-bottom:12px">Tu es déjà participant de cette saison</div>
              <div class="alert flat">Demande déjà envoyée — en attente de validation</div>
              <button class="btn" style="width:100%;text-align:center;margin-top:14px">← Retour à mes saisons</button>
            </div>
          </div>
        </div>
      </div>

      <!-- ÉTAPE 3 : confirmation PENDING -->
      <hr class="dash-rule">
      <div class="sec-h"><span class="lbl"><b>Étape 3</b><span>Demande envoyée</span></span><span class="steps"><i class="done">1</i><span class="ln"></span><i class="done">2</i><span class="ln"></span><i class="on">3</i></span></div>
      <div class="variants">
        <div class="variant">
          <div class="variant-label"><b>Confirmation PENDING</b></div>
          <div class="frame sketch">
            <div class="frame-bar"><div class="dots"><i></i><i></i><i></i></div><div class="url">/seasons/join/ABCD-1234 — envoyé</div></div>
            <div class="frame-body" style="text-align:center;padding:32px 18px">
              <div style="font-family:var(--font-head);font-size:28px;margin-bottom:10px">Demande envoyée !</div>
              <p class="small ink2" style="margin:0 0 18px">Tu rejoindras <b>Coupe Verney</b> avec <b>Roadkill</b> dès que l'organisateur aura validé ta demande.</p>
              <div class="prow wait" style="text-align:left;margin-bottom:18px"><span class="avatar">CV</span><div class="who"><b>Coupe Verney</b><small>Roadkill · demande en attente</small></div><span class="badge wait">En attente</span></div>
              <button class="btn accent" style="width:100%">← Retour à mes saisons</button>
              <div class="callout" style="text-align:left">La saison apparaît dans la liste avec le badge "En attente" jusqu'à validation.</div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ========== DETAIL ========== -->
    <section class="section" id="s-detail">
      <div class="screen-head">
        <h1>Détail de la saison</h1>
        <span class="route">/seasons/:id — Participants · Parties · Paramètres</span>
      </div>
      <p class="lead">Structure retenue : <b>sections empilées</b>. Bandeau d'état + code + transition et actions Valider/Refuser/Promouvoir/Retirer visibles uniquement par l'organisateur. Vues organisateur et participant côte à côte, puis variantes du bandeau à trancher.</p>

      <div>
        <div class="variants">
          <!-- ORGA -->
          <div class="variant">
            <div class="variant-label"><b>Vue organisateur</b><span class="tag">Sections empilées</span></div>
            <div class="frame sketch">
              <div class="frame-bar"><div class="dots"><i></i><i></i><i></i></div><div class="url">/seasons/12</div></div>
              <div class="frame-body">
                <h2 class="h-title mt0" style="margin-bottom:10px">Coupe Verney</h2>
                <div class="card sketch hd2" style="margin-bottom:14px">
                  <div class="top"><span class="state construc"><span class="dot"></span>EN_CONSTRUCTION</span><span class="code">🔗 <b>ABCD-1234</b></span></div>
                  <p class="small ink2" style="margin:8px 0 8px">Inscriptions ouvertes. Valide les demandes avant de lancer.</p>
                  <div class="spaced" style="justify-content:flex-end"><button class="btn accent sm">Lancer → EN_COURS</button></div>
                </div>

                <div class="sec">
                  <div class="sec-h"><span class="lbl"><b>Participants</b><span>3 validés · 2 en attente</span></span></div>
                  <div class="prow mb0" style="margin-bottom:8px"><span class="avatar">AL</span><div class="who"><b>Alice · Furies</b></div><span class="badge orga">Organisateur</span></div>
                  <div class="prow mb0" style="margin-bottom:8px"><span class="avatar">BO</span><div class="who"><b>Bob · Scrap Kings</b></div><button class="btn sm">Promouvoir</button><button class="btn sm danger">Retirer</button></div>
                  <div class="prow wait mb0"><span class="avatar">DA</span><div class="who"><b>Dan · Roadkill</b><small>demande</small></div><button class="btn sm accent">Valider</button><button class="btn sm danger">Refuser</button></div>
                </div>

                <hr class="dash-rule">
                <div class="sec">
                  <div class="sec-h"><span class="lbl"><b>Parties</b><span>4</span></span><button class="btn accent sm">+ Ajouter</button></div>
                  <div class="prow mb0" style="margin-bottom:8px"><span class="avatar">M1</span><div class="who"><b>Manche 1</b><small>12/06 · 3 équipes</small></div><button class="btn sm">Modifier</button></div>
                  <div class="prow mb0"><span class="avatar">M2</span><div class="who"><b>Manche 2</b><small>19/06 · 4 équipes</small></div><button class="btn sm">Modifier</button></div>
                </div>

                <hr class="dash-rule">
                <div class="sec">
                  <div class="sec-h"><span class="lbl"><b>Paramètres</b></span></div>
                  <div class="spaced"><button class="btn">Renommer</button><button class="btn danger">Supprimer la saison</button></div>
                </div>
                <div class="callout">Tout sur une page : scroll naturel, le contexte reste visible.</div>
              </div>
            </div>
          </div>

          <!-- PARTICIPANT -->
          <div class="variant">
            <div class="variant-label"><b>Vue participant</b><span class="tag">Même page, lecture</span></div>
            <div class="frame sketch hd3">
              <div class="frame-bar"><div class="dots"><i></i><i></i><i></i></div><div class="url">/seasons/12</div></div>
              <div class="frame-body">
                <h2 class="h-title mt0" style="margin-bottom:10px">Coupe Verney</h2>
                <div class="banner sketch hd2">
                  <span class="state construc"><span class="dot"></span>EN_CONSTRUCTION</span>
                  <span class="spacer"></span>
                  <span class="small muted">Gérée par Alice</span>
                </div>
                <div class="callout mt0" style="margin:6px 0 12px">Ni code, ni bouton de transition, ni actions sur les lignes.</div>

                <div class="sec mt0">
                  <div class="sec-h"><span class="lbl"><b>Participants</b><span>3 validés</span></span></div>
                  <div class="prow mb0" style="margin-bottom:8px"><span class="avatar">AL</span><div class="who"><b>Alice · Furies</b></div><span class="badge orga">Orga</span></div>
                  <div class="prow mb0" style="margin-bottom:8px"><span class="avatar">BO</span><div class="who"><b>Bob · Scrap Kings</b></div><span class="badge part">Joueur</span></div>
                  <div class="prow mb0"><span class="avatar">MO</span><div class="who"><b>Moi · Roadkill</b></div><span class="badge part">Joueur</span></div>
                </div>

                <hr class="dash-rule">
                <div class="sec">
                  <div class="sec-h"><span class="lbl"><b>Parties</b><span>4</span></span></div>
                  <div class="prow mb0" style="margin-bottom:8px"><span class="avatar">M1</span><div class="who"><b>Manche 1</b><small>12/06 · 3 équipes · je joue</small></div></div>
                  <div class="prow mb0"><span class="avatar">M2</span><div class="who"><b>Manche 2</b><small>19/06 · 4 équipes</small></div></div>
                </div>
                <div class="callout">Lecture seule : pas de section Paramètres.</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- banner variations -->
      <hr class="dash-rule">
      <div class="sec-h"><span class="lbl"><b>Bandeau d'état</b><span>à trancher — organisateur uniquement</span></span></div>
      <div>
        <p class="lead mt0">Le bandeau pilote le cycle de vie. 3 traitements selon le poids qu'on veut lui donner.</p>
        <div class="variants">

          <!-- état 1 -->
          <div class="variant">
            <div class="variant-label"><b>État 1 / 3</b><span class="tag">EN_CONSTRUCTION</span></div>
            <div class="frame sketch"><div class="frame-bar"><div class="dots"><i></i><i></i><i></i></div><div class="url">/seasons/12</div></div>
              <div class="frame-body tight">
                <div class="card sketch mb0">
                  <div class="top"><span class="state construc"><span class="dot"></span>EN_CONSTRUCTION</span><span class="code">🔗 <b>ABCD-1234</b></span></div>
                  <p class="small ink2" style="margin:10px 0 8px">Les inscriptions sont ouvertes. Valide les demandes avant de lancer la saison.</p>
                  <div class="spaced" style="justify-content:flex-end">
                    <button class="btn sm" style="color:var(--muted);border-color:var(--muted)" disabled>← Retour impossible</button>
                    <button class="btn accent sm">Lancer → EN_COURS</button>
                  </div>
                </div>
                <div class="callout">Premier état : pas de retour en arrière possible depuis ici.</div>
              </div>
            </div>
          </div>

          <!-- état 2 -->
          <div class="variant">
            <div class="variant-label"><b>État 2 / 3</b><span class="tag">EN_COURS</span></div>
            <div class="frame sketch hd2"><div class="frame-bar"><div class="dots"><i></i><i></i><i></i></div><div class="url">/seasons/12</div></div>
              <div class="frame-body tight">
                <div class="card sketch mb0">
                  <div class="top"><span class="state cours"><span class="dot"></span>EN_COURS</span><span class="code">🔗 <b>ABCD-1234</b></span></div>
                  <p class="small ink2" style="margin:10px 0 8px">Inscriptions fermées. Les parties restent ajoutables.</p>
                  <div class="spaced" style="justify-content:space-between">
                    <button class="btn sm danger">← Rouvrir EN_CONSTRUCTION</button>
                    <button class="btn accent sm">Clôturer → TERMINÉE</button>
                  </div>
                </div>
                <div class="callout">Les deux directions sont disponibles. Confirmation requise dans les deux cas.</div>
              </div>
            </div>
          </div>

          <!-- état 3 -->
          <div class="variant">
            <div class="variant-label"><b>État 3 / 3</b><span class="tag">TERMINÉE</span></div>
            <div class="frame sketch hd3"><div class="frame-bar"><div class="dots"><i></i><i></i><i></i></div><div class="url">/seasons/12</div></div>
              <div class="frame-body tight">
                <div class="card sketch mb0">
                  <div class="top"><span class="state fini"><span class="dot"></span>TERMINÉE</span></div>
                  <p class="small ink2" style="margin:10px 0 8px">Saison archivée. Lecture seule.</p>
                  <div class="spaced" style="justify-content:space-between">
                    <button class="btn sm danger">← Rouvrir EN_COURS</button>
                    <button class="btn sm" style="color:var(--muted);border-color:var(--muted)" disabled>Suivant impossible</button>
                  </div>
                </div>
                <div class="callout">Dernier état : seul le retour vers EN_COURS est possible.</div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>

    <!-- ========== PARTIE ========== -->
    <section class="section" id="s-partie">
      <div class="screen-head">
        <h1>Ajouter une partie</h1>
        <span class="route">game-form — POST /api/seasons/:id/games</span>
      </div>
      <p class="lead">Ouverte par l'organisateur depuis la section Parties. Nom, date optionnelle, et sélection multiple parmi les participants <b>validés</b> de la saison (sous-ensemble qui joue cette partie). Pas de résultats — hors scope.</p>

      <div class="variants">
        <div class="variant">
          <div class="variant-label"><b>Le formulaire</b></div>
          <div class="frame sketch">
            <div class="frame-bar"><div class="dots"><i></i><i></i><i></i></div><div class="url">/seasons/12 → game-form</div></div>
            <div class="modal-stage">
              <div class="modal sketch" style="width:min(440px,100%)">
                <div class="mh"><b>Nouvelle partie</b><span class="x">✕</span></div>
                <div class="field"><label>Nom</label><div class="input">Manche 3 — Démolition</div></div>
                <div class="field"><label>Date prévue (optionnel)</label><div class="input select">26/06/2026</div></div>
                <div class="field"><label>Équipes engagées</label>
                  <div class="cols2" style="margin-top:6px">
                    <div class="input" style="text-align:center">☑ Furies</div>
                    <div class="input" style="text-align:center">☑ Scrap Kings</div>
                    <div class="input" style="text-align:center;color:var(--muted)">☐ Roadkill</div>
                    <div class="input" style="text-align:center">☑ Slime</div>
                  </div>
                  <div class="callout">Seuls les participants VALIDATED sont proposés.</div>
                </div>
                <div class="mfoot"><button class="btn">Annuler</button><button class="btn accent">Créer la partie</button></div>
              </div>
            </div>
          </div>
        </div>

        <div class="variant">
          <div class="variant-label"><b>Dans la liste après création</b></div>
          <div class="frame sketch hd2">
            <div class="frame-bar"><div class="dots"><i></i><i></i><i></i></div><div class="url">/seasons/12 — Parties</div></div>
            <div class="frame-body">
              <div class="sec-h mt0"><span class="lbl"><b>Parties</b><span>5</span></span><button class="btn accent sm">+ Ajouter</button></div>
              <div class="prow mb0" style="margin-bottom:8px"><span class="avatar">M1</span><div class="who"><b>Manche 1</b><small>12/06 · 3 équipes</small></div><button class="btn sm">Modifier</button><button class="btn sm danger">✕</button></div>
              <div class="prow mb0" style="margin-bottom:8px"><span class="avatar">M2</span><div class="who"><b>Manche 2</b><small>19/06 · 4 équipes</small></div><button class="btn sm">Modifier</button><button class="btn sm danger">✕</button></div>
              <div class="prow mb0" style="margin-bottom:8px;border-color:var(--accent)"><span class="avatar" style="border-color:var(--accent)">M3</span><div class="who"><b>Manche 3 — Démolition</b><small>26/06 · 3 équipes · nouveau</small></div><button class="btn sm">Modifier</button></div>
              <div class="prow mb0"><span class="avatar">M4</span><div class="who"><b>Manche 4</b><small>date à définir · 4 équipes</small></div><button class="btn sm">Modifier</button></div>
              <div class="callout">Modifier/Supprimer réservés à l'organisateur. La date peut rester nulle.</div>
            </div>
          </div>
        </div>
      </div>
    </section>

  </main>
</div>

<!-- tweaks mount -->
<div id="tweaks-root"></div>

<script src="https://unpkg.com/react@18.3.1/umd/react.development.js" integrity="sha384-hD6/rw4ppMLGNu3tX5cjIb+uRZ7UkRJ6BPkLpg4hAu/6onKUg4lLsHAs9EBPT82L" crossorigin="anonymous"></script>
<script src="https://unpkg.com/react-dom@18.3.1/umd/react-dom.development.js" integrity="sha384-u6aeetuaXnQ38mYT8rp6sbXaQe3NL9t+IBXmnYxwkUI2Hw4bsp2Wvmx4yRQF1uAm" crossorigin="anonymous"></script>
<script src="https://unpkg.com/@babel/standalone@7.29.0/babel.min.js" integrity="sha384-m08KidiNqLdpJqLq95G/LEi8Qvjl/xUYll3QILypMoQ65QorJ9Lvtp2RXYGBFj1y" crossorigin="anonymous"></script>
<script src="wf-nav.js"></script>
<script type="text/babel" src="tweaks-panel.jsx"></script>
<script type="text/babel" src="wf-tweaks.jsx"></script>
</body>
</html>
