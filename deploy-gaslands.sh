#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# Exploitation de Gaslands Manager sur le serveur de production.
# Copié à la main par scp dans /opt/gaslands (docs/VPS_DEPLOYMENT.md).
# Copie adaptée de deploy-hdc.sh (Histoires de chimères), pas un script commun (#25). Les écarts
# avec ce modèle sont marqués « Écart Gaslands » : deux images (backend + frontend) pour un seul
# IMAGE_TAG, migrations TypeORM appliquées au démarrage du backend, services Compose postgres /
# backend / frontend du projet gaslands-prod, version lue sur /api/version.
#
# Usage :
#   ./deploy-gaslands.sh vX.Y.Z            déploie cette version
#   ./deploy-gaslands.sh sauvegarde-nuit   dump chiffré envoyé sur B2 (cron) - pas encore disponible
#   ./deploy-gaslands.sh                   menu
#
# Déployer :
#   1. Refuse un tag hors format vX.Y.Z, déjà en place, ou plus ancien que N-1.
#   2. Tire les DEUX images : si l'une manque sur ghcr, arrêt sans rien toucher.
#   3. Fait un dump de la base : sauvegardes/avant-deploiement-AAAA-MM-JJ-HHMM-vN.dump (vN : la
#      version en place, donc celle dont le dump porte le schéma).
#   4. Met IMAGE_TAG dans .env et relance : les migrations TypeORM s'appliquent au démarrage du
#      backend (DB_MIGRATIONS_RUN=true).
#   5. Attend le « healthy » du backend (120 s au plus), puis vérifie par HTTPS que /api/version
#      renvoie le nouveau tag.
#   6. Ajoute une ligne à deploiements.log, puis efface les images autres que N et N-1 (des deux
#      dépôts) et les dumps locaux de plus de 30 jours.
#
# En cas d'échec : arrêt de backend et frontend, base recréée vide, pg_restore du dump de l'étape 3,
# relance de la version précédente avec contrôle de version. Si cette restauration échoue : message
# CRITIQUE avec le chemin du dump. IMAGE_TAG doit déjà figurer dans .env (version en place).
#
# deploiements.log, une ligne par déploiement réussi : date, tag déployé, tag précédent (- s'il n'y
# en a pas), dump fait avant. La dernière ligne donne la version en place (N) et la précédente (N-1).
# Écart Gaslands : sans journal (premier passage par ce script, v1.0.0 déjà déployée à la main), la
# version en place est lue dans IMAGE_TAG de .env, pour qu'elle devienne N-1 du premier déploiement.
#
# Sauvegarder maintenant (option 3) : dump local manuel-AAAA-MM-JJ-HHMM-vN.dump, en clair.
#
# Restaurer (option 4) : un dump local choisi dans une liste, confirmation par RESTAURER. Refuse un
# dump d'une version plus récente que celle en place (« redéployez d'abord vD, puis restaurez »).
# Fait d'abord un dump avant-restauration-…-vN.dump, puis arrête backend et frontend, recrée la base,
# pg_restore, relance la version en place : elle applique au démarrage les migrations qui manquent
# au dump. Écart Gaslands : une restauration ne change JAMAIS IMAGE_TAG (deploy-hdc.sh, lui,
# relance la version d'un dump avant-vX.Y.Z).
#
# Revenir à la version précédente (option 2) et sauvegarde de nuit B2 : tickets séparés, l'entrée
# existe déjà mais affiche « pas encore disponible ».
#
# Ne construit rien sur le serveur et ne touche pas à Caddy (pile partagée docker/edge/).
# ============================================================

APP_DIR="${GASLANDS_DIR:-/opt/gaslands}"
COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE="$APP_DIR/.env"
LOG_FILE="$APP_DIR/deploiements.log"
DUMP_DIR="$APP_DIR/sauvegardes"
# Écart Gaslands : deux images, une seule version (IMAGE_TAG) pour les deux.
# IMAGE_REGISTRY : réservé à la recette sur une pile jetable (registre local), jamais défini en prod.
IMAGE_REGISTRY="${IMAGE_REGISTRY:-ghcr.io/arnaudbracchetti}"
IMAGES=(
  "$IMAGE_REGISTRY/gaslands-manager-backend"
  "$IMAGE_REGISTRY/gaslands-manager-frontend"
)
# Écart Gaslands : noms des services de docker-compose.prod.yml.
DB_SERVICE="postgres"
APP_SERVICES=(backend frontend)
HEALTH_SERVICE="backend"
HEALTH_TIMEOUT=120   # secondes d'attente du « healthy »
HEALTH_INTERVAL=5
DUMP_RETENTION_DAYS=30
TAG_PATTERN='v[0-9]+\.[0-9]+\.[0-9]+'

CYAN='\033[0;36m'; GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; NC='\033[0m'
step() { echo ""; echo -e "${CYAN}>> $1${NC}"; }
ok()   { echo -e "${GREEN}   OK : $1${NC}"; }
err()  { echo -e "${RED}   ERREUR : $1${NC}"; }
warn() { echo -e "${YELLOW}   ATTENTION : $1${NC}"; }

# Les dumps contiennent toutes les données (comptes joueurs) : lisibles par le seul compte deploy.
umask 077

cd "$APP_DIR" 2>/dev/null || { err "dossier $APP_DIR introuvable"; exit 1; }
[ -f "$ENV_FILE" ] || { err "$ENV_FILE introuvable"; exit 1; }
[ -f "$COMPOSE_FILE" ] || { err "$COMPOSE_FILE introuvable dans $APP_DIR"; exit 1; }

compose() { docker compose -f "$COMPOSE_FILE" "$@"; }

# Valeur de la variable $1 dans .env, vide si elle manque.
# Les guillemets éventuels (IMAGE_TAG="v1.0.0") sont retirés : sinon le tag ne se compare plus.
env_value() { grep -oP "^$1=\\K.*" "$ENV_FILE" | tr -d "\"'" || true; }
public_domain() { env_value PUBLIC_DOMAIN; }

# Les noms des dumps suivent l'heure de Paris, quelle que soit celle du serveur (UTC).
paris_date() { TZ=Europe/Paris date "$@"; }

# Chemin d'un nouveau dump $1-AAAA-MM-JJ-HHMM[-$2].dump ($2 : version en place), avec les secondes
# si ce nom est déjà pris : deux dumps faits dans la même minute ne s'écrasent pas.
new_dump_path() {
  local suffix="${2:+-$2}" path
  path="$DUMP_DIR/$1-$(paris_date +%F-%H%M)$suffix.dump"
  [ -e "$path" ] && path="$DUMP_DIR/$1-$(paris_date +%F-%H%M%S)$suffix.dump"
  echo "$path"
}

# Écart Gaslands : les dumps portent la version en place (schéma qu'ils contiennent), pour que la
# restauration refuse un dump plus récent que cette version (#25, compatibilité de version).
# Version portée par le nom du dump $1 (suffixe -vX.Y.Z.dump), vide si absente.
dump_version() {
  if [[ "$(basename "$1")" =~ -($TAG_PATTERN)\.dump$ ]]; then echo "${BASH_REMATCH[1]}"; fi
}

# Champ $1 de la dernière ligne du journal, vide s'il n'y en a pas.
last_log_field() {
  [ -f "$LOG_FILE" ] || return 0
  local value
  value="$(tail -n 1 "$LOG_FILE" | awk -v field="$1" '{ print $field }')"
  [ "$value" = "-" ] || echo "$value"
}
# Écart Gaslands : repli sur IMAGE_TAG de .env tant que le journal n'existe pas.
current_tag() {
  if [ -s "$LOG_FILE" ]; then last_log_field 2; else env_value IMAGE_TAG; fi
}
previous_tag_from_log() { last_log_field 3; }

# Ajoute au journal la ligne : date, tag $1 en place, tag $2 quitté (- si vide), dump $3 (- si vide).
append_log_line() { echo "$(date -Iseconds) $1 ${2:--} ${3:--}" >> "$LOG_FILE"; }

# Vrai si la réponse $1 est « o » ou « O ».
answered_yes() { [ "$1" = "o" ] || [ "$1" = "O" ]; }

# Le plus ancien des tags donnés (les vides sont ignorés).
oldest_tag() { printf '%s\n' "$@" | grep -v '^$' | sort -V | head -n 1 || true; }

# Vrai si le tag $1 est strictement plus ancien que le tag $2.
is_older() { [ "$1" != "$2" ] && [ "$(oldest_tag "$1" "$2")" = "$1" ]; }

set_image_tag() {
  if grep -q '^IMAGE_TAG=' "$ENV_FILE"; then
    sed -i "s/^IMAGE_TAG=.*/IMAGE_TAG=$1/" "$ENV_FILE"
  else
    echo "IMAGE_TAG=$1" >> "$ENV_FILE"
  fi
}

# Attend que le conteneur du service $1 soit « healthy ». 120 s couvrent un échec de migration au
# démarrage : Nest réessaie 9 fois (~30 s) avant que le conteneur ne boucle (#25, story 9).
wait_healthy() {
  local service="$1" elapsed=0 container health
  while [ "$elapsed" -lt "$HEALTH_TIMEOUT" ]; do
    container="$(compose ps -q "$service")"
    if [ -n "$container" ]; then
      health="$(docker inspect -f '{{.State.Health.Status}}' "$container" 2>/dev/null || true)"
      [ "$health" = "healthy" ] && return 0
    fi
    sleep "$HEALTH_INTERVAL"
    elapsed=$((elapsed + HEALTH_INTERVAL))
    echo "   ... $service pas encore healthy (${elapsed}s/${HEALTH_TIMEOUT}s)"
  done
  return 1
}

# Version que renvoie le site public, vide s'il ne répond pas.
# Écart Gaslands : /api/version ({ "version": "vX.Y.Z" }), /api/health ne porte pas la version.
# VERSION_URL : réservé à la recette sur une pile jetable (pas de Caddy en local), jamais défini en
# prod - le contrôle doit passer par Caddy en HTTPS, comme un joueur.
version_url() { echo "${VERSION_URL:-https://$(public_domain)/api/version}"; }
public_version() {
  curl -fsS --max-time 10 "$(version_url)" 2>/dev/null \
    | grep -oP '"version"\s*:\s*"\K[^"]*' || true
}

show_backend_logs() {
  echo "----- Dernières lignes du journal du backend -----"
  compose logs --tail=50 "$HEALTH_SERVICE" || true
  echo "--------------------------------------------------"
}

# Relance l'application sous le tag $1, attend le « healthy » du backend et vérifie la version
# publique.
start_app() {
  local tag="$1" version
  set_image_tag "$tag"
  # Écart Gaslands : backend d'abord, frontend ensuite. Un « up » global attendrait lui-même le
  # backend (depends_on service_healthy du frontend) et abandonnerait au bout des ~95 s de son
  # healthcheck : c'est wait_healthy, avec ses 120 s, qui doit fixer la limite. --no-build :
  # docker-compose.prod.yml garde une section build: pour l'usage local, le serveur ne construit
  # jamais rien.
  if ! compose up -d --no-build "$DB_SERVICE" "$HEALTH_SERVICE"; then
    err "le démarrage de $tag a échoué"
    show_backend_logs
    return 1
  fi
  if ! wait_healthy "$HEALTH_SERVICE"; then
    err "le backend ne devient pas healthy en ${HEALTH_TIMEOUT}s"
    show_backend_logs
    return 1
  fi
  if ! compose up -d --no-build; then
    err "le démarrage du frontend $tag a échoué"
    return 1
  fi
  version="$(public_version)"
  if [ "$version" != "$tag" ]; then
    err "$(version_url) renvoie « ${version:-rien} » au lieu de « $tag »"
    return 1
  fi
}

# Démarre la base et attend son « healthy ». Écart Gaslands : aussi appelé avant une restauration,
# la base pouvant être arrêtée (deploy-hdc.sh la suppose démarrée).
ensure_db_up() {
  compose up -d --no-build "$DB_SERVICE" || return 1
  wait_healthy "$DB_SERVICE"
}

# Dump de la base dans le fichier $1 : écrit à côté, puis renommé une fois complet.
dump_database() {
  local file="$1"
  mkdir -p "$DUMP_DIR"
  ensure_db_up || return 1
  # « < /dev/null » : sinon compose exec lit l'entrée du script et mange les réponses du menu.
  # shellcheck disable=SC2016 # les variables se lisent dans le conteneur.
  if compose exec -T "$DB_SERVICE" sh -c 'pg_dump -U "$POSTGRES_USER" -Fc "$POSTGRES_DB"' \
    < /dev/null > "$file.part" && [ -s "$file.part" ]; then
    mv "$file.part" "$file"
  else
    rm -f "$file.part"
    return 1
  fi
}

# Recrée la base vide puis y restaure le dump $1. Pas de pg_restore --clean : il peut laisser des
# objets créés après le dump. Backend et frontend doivent être arrêtés.
restore_database() {
  local file="$1"
  ensure_db_up || return 1
  # shellcheck disable=SC2016 # les variables se lisent dans le conteneur.
  compose exec -T "$DB_SERVICE" sh -c \
    'dropdb -U "$POSTGRES_USER" --force "$POSTGRES_DB" && createdb -U "$POSTGRES_USER" "$POSTGRES_DB"' \
    < /dev/null || return 1
  # shellcheck disable=SC2016 # idem.
  compose exec -T "$DB_SERVICE" sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --exit-on-error' \
    < "$file"
}

# Arrête backend et frontend, restaure le dump $1, puis relance l'application sous le tag $2 et
# contrôle sa version. Sert au retour automatique d'un déploiement comme à l'option 4.
restore_and_start() {
  local file="$1" tag="$2"
  step "Arrêt de ${APP_SERVICES[*]} et restauration de $file"
  # Écart Gaslands : deux services applicatifs à arrêter (le frontend n'écrit rien, mais on ne
  # sert pas l'interface pendant que la base est vide).
  compose stop "${APP_SERVICES[@]}" || return 1
  restore_database "$file" || return 1
  ok "base restaurée"
  step "Démarrage de $tag"
  start_app "$tag"
}

# Efface les dumps locaux de plus de DUMP_RETENTION_DAYS jours.
prune_old_dumps() {
  [ -d "$DUMP_DIR" ] || return 0
  find "$DUMP_DIR" -maxdepth 1 -type f -name '*.dump' -mmin +$((DUMP_RETENTION_DAYS * 24 * 60)) \
    -print -delete | sed 's/^/   effacé : /' || warn "ménage des dumps incomplet"
}

# Tire les deux images du tag $1. Écart Gaslands : si l'une manque, rien n'est touché (une version
# à moitié déployée n'existe pas).
pull_images() {
  local image
  for image in "${IMAGES[@]}"; do
    if ! docker pull "$image:$1"; then
      err "image $image:$1 introuvable sur ghcr : la CI du tag $1 a-t-elle réussi ? Rien n'a été touché."
      return 1
    fi
  done
}

# Efface, dans chacun des deux dépôts d'images, les tags autres que $1 et $2 (jamais Postgres).
remove_old_images() {
  local image
  for image in "${IMAGES[@]}"; do
    docker images "$image" --format '{{.Tag}}' \
      | { grep -vxF -e "$1" -e "${2:-$1}" -e '<none>' || true; } \
      | sed "s|^|$image:|" | xargs -r docker rmi || warn "ménage des images $image incomplet"
  done
}

# ── 1. Déployer une version ──────────────────────────────────────────
action_deploy() {
  local new_tag="${1:-}"
  if [ -z "$new_tag" ]; then
    read -rp "Version à déployer (ex. v1.2.3) : " new_tag
  fi

  if [[ ! "$new_tag" =~ ^${TAG_PATTERN}$ ]]; then
    err "la version doit suivre le format vX.Y.Z (reçu : « $new_tag »)"
    return 1
  fi

  local current previous oldest_allowed
  current="$(current_tag)"
  previous="$(previous_tag_from_log)"
  # Écart Gaslands : docker-compose.prod.yml exige IMAGE_TAG (${IMAGE_TAG:?}) même pour démarrer la
  # seule base, donc même pour le dump d'avant déploiement. Sans lui, rien ne peut tourner.
  if [ -z "$(env_value IMAGE_TAG)" ]; then
    err "IMAGE_TAG manque dans $ENV_FILE (version en place) : le renseigner avant de déployer."
    return 1
  fi
  # Une version plus ancienne que N et N-1 tournerait sur un schéma qu'elle ne connaît pas.
  # Après un retour, N-1 peut être plus récent que N : la borne est le plus ancien des deux.
  oldest_allowed="$(oldest_tag "$current" "$previous")"
  if [ -n "$oldest_allowed" ] && is_older "$new_tag" "$oldest_allowed"; then
    err "$new_tag est plus ancienne que $oldest_allowed : la base a des migrations qu'elle ne connaît pas."
    err "Pour remonter aussi loin, restaurer un dump de cette époque (option 4) après avoir redéployé."
    return 1
  fi

  # Redéployer N ferait oublier N-1 au journal et au ménage des images.
  if [ "$new_tag" = "$current" ]; then
    err "$new_tag est déjà en place."
    return 1
  fi

  step "Images $new_tag (backend et frontend)"
  pull_images "$new_tag" || return 1
  ok "images tirées"

  # Écart Gaslands : avant-deploiement-<date>-vN plutôt que avant-vX.Y.Z, pour que le nom porte la
  # version dont le dump contient le schéma (le tag visé est noté dans deploiements.log).
  local dump
  dump="$(new_dump_path avant-deploiement "$current")"
  step "Dump de la base avant $new_tag"
  if ! dump_database "$dump"; then
    err "dump impossible : déploiement arrêté, rien n'a été touché."
    return 1
  fi
  ok "$dump ($(du -h "$dump" | cut -f1))"

  step "Démarrage de $new_tag (version en place : ${current:-aucune})"
  if start_app "$new_tag"; then
    append_log_line "$new_tag" "$current" "$dump"
    ok "$new_tag répond sur https://$(public_domain)"
    step "Ménage des images"
    remove_old_images "$new_tag" "$current"
    ok "gardées : $new_tag et ${current:-aucune autre}"
    step "Ménage des dumps de plus de $DUMP_RETENTION_DAYS jours"
    prune_old_dumps
    return 0
  fi

  warn "Retour à $current avec le dump fait avant $new_tag"
  if restore_and_start "$dump" "$current"; then
    ok "$current répond de nouveau"
    err "Le déploiement de $new_tag a échoué et a été annulé. Voir le journal ci-dessus."
    return 1
  fi
  err "CRITIQUE : le retour à $current a échoué. Intervention manuelle immédiate sur le serveur."
  err "Dump d'avant le déploiement : $dump"
  err "IMAGE_TAG de $ENV_FILE vaut peut-être encore $new_tag : le remettre à $current avant tout « up »."
  return 2
}

# ── 2. Revenir à la version précédente ───────────────────────────────
action_rollback() {
  warn "pas encore disponible (ticket séparé). Rien n'a été touché."
  return 1
}

# ── 3. Sauvegarder maintenant ────────────────────────────────────────
action_manual_backup() {
  local dump
  dump="$(new_dump_path manuel "$(current_tag)")"
  step "Dump de la base"
  if ! dump_database "$dump"; then
    err "dump impossible."
    return 1
  fi
  ok "$dump ($(du -h "$dump" | cut -f1))"
  step "Ménage des dumps de plus de $DUMP_RETENTION_DAYS jours"
  prune_old_dumps
}

# ── Sauvegarde de nuit (cron) ────────────────────────────────────────
action_nightly_backup() {
  err "sauvegarde de nuit pas encore disponible (ticket séparé)."
  return 1
}

# ── 4. Restaurer une sauvegarde ──────────────────────────────────────
# Dumps locaux qu'on peut restaurer, du plus récent au plus ancien.
list_local_dumps() {
  [ -d "$DUMP_DIR" ] || return 0
  find "$DUMP_DIR" -maxdepth 1 -type f -name '*.dump' -printf '%T@ %p\n' | sort -rn | cut -d' ' -f2-
}

action_restore() {
  local dumps=() choice file
  mapfile -t dumps < <(list_local_dumps)

  step "Sauvegardes locales"
  local i
  for i in "${!dumps[@]}"; do
    printf '  %2d) %-56s %s  %s\n' "$((i + 1))" "$(basename "${dumps[$i]}")" \
      "$(paris_date -r "${dumps[$i]}" '+%d/%m/%Y %H:%M')" "$(du -h "${dumps[$i]}" | cut -f1)"
  done
  if [ "${#dumps[@]}" -eq 0 ]; then
    echo "   aucun dump local"
    return 1
  fi
  read -rp "Choix (vide pour annuler) : " choice
  if [[ "$choice" =~ ^[0-9]+$ ]] && [ "$choice" -ge 1 ] && [ "$choice" -le "${#dumps[@]}" ]; then
    file="${dumps[$((choice - 1))]}"
  else
    warn "restauration annulée, rien n'a été touché."
    return 1
  fi

  confirm_and_restore_dump "$file"
}

# Contrôle la compatibilité du dump $1 avec la version en place, demande de taper RESTAURER, fait un
# dump avant-restauration, restaure $1 et relance la version en place (IMAGE_TAG inchangé).
confirm_and_restore_dump() {
  local file="$1" current version
  current="$(env_value IMAGE_TAG)"
  if [ -z "$current" ]; then
    err "IMAGE_TAG manque dans $ENV_FILE : version à relancer inconnue. Rien n'a été touché."
    return 1
  fi
  # Un dump plus récent porte des migrations que la version en place ne connaît pas.
  version="$(dump_version "$file")"
  if [ -z "$version" ]; then
    err "version du dump inconnue (nom sans -vX.Y.Z) : compatibilité avec $current invérifiable. Rien n'a été touché."
    return 1
  fi
  if is_older "$current" "$version"; then
    err "ce dump vient de $version : redéployez d'abord $version, puis restaurez. Rien n'a été touché."
    return 1
  fi

  echo ""
  echo "   Dump        : $(basename "$file")"
  echo "   Date        : $(paris_date -r "$file" '+%d/%m/%Y à %H:%M') (heure de Paris)"
  echo "   Version     : ${version:-inconnue} (relancée : $current, IMAGE_TAG inchangé)"
  warn "la base actuelle sera effacée et remplacée par ce dump."
  local confirm
  read -rp "Taper RESTAURER pour continuer : " confirm
  if [ "$confirm" != "RESTAURER" ]; then
    warn "restauration annulée, rien n'a été touché."
    return 1
  fi

  local before
  before="$(new_dump_path avant-restauration "$current")"
  step "Dump de la base avant la restauration"
  if ! dump_database "$before"; then
    err "dump impossible : restauration arrêtée, rien n'a été touché."
    return 1
  fi
  ok "$before ($(du -h "$before" | cut -f1))"

  if ! restore_and_start "$file" "$current"; then
    err "CRITIQUE : la restauration a échoué. Intervention manuelle immédiate sur le serveur."
    err "Dump d'avant la restauration : $before (option 4 pour y revenir)."
    return 2
  fi
  ok "$(basename "$file") restauré, $current répond sur https://$(public_domain)"
}

# ── 5. État ──────────────────────────────────────────────────────────
action_status() {
  step "Versions"
  echo "   En place    : $(current_tag || true)"
  echo "   Précédente  : $(previous_tag_from_log || true)"
  local version
  version="$(public_version)"
  echo "   Répond sur $(version_url) : ${version:-aucune réponse}"

  step "Derniers déploiements"
  if [ -f "$LOG_FILE" ]; then tail -n 5 "$LOG_FILE" | sed 's/^/   /'; else echo "   aucun"; fi

  step "Conteneurs"
  compose ps

  step "Derniers dumps locaux"
  if compgen -G "$DUMP_DIR/*.dump" > /dev/null; then
    # shellcheck disable=SC2012 # noms de fichiers produits par ce script, sans espace.
    ls -lht "$DUMP_DIR"/*.dump | head -n 10 | sed 's/^/   /'
    echo "   Place prise : $(du -sh "$DUMP_DIR" | cut -f1)"
  else
    echo "   aucun"
  fi

  step "Images"
  docker images --format '   {{.Repository}}:{{.Tag}}  {{.Size}}' \
    | grep -e 'gaslands-manager-' -e 'postgres' || echo "   aucune"
}

menu() {
  while true; do
    echo ""
    echo "=== Gaslands Manager - exploitation ($APP_DIR) ==="
    echo "  1) Déployer une version"
    echo "  2) Revenir à la version précédente"
    echo "  3) Sauvegarder maintenant"
    echo "  4) Restaurer une sauvegarde"
    echo "  5) État"
    echo "  6) Quitter"
    local choice
    read -rp "Choix : " choice || exit 0
    # « || true » : sous set -e, l'échec d'une action ramène au menu au lieu de quitter le script.
    case "$choice" in
      1) action_deploy || true ;;
      2) action_rollback || true ;;
      3) action_manual_backup || true ;;
      4) action_restore || true ;;
      5) action_status || true ;;
      6) exit 0 ;;
      *) warn "choix invalide." ;;
    esac
  done
}

case "${1:-}" in
  "") menu ;;
  sauvegarde-nuit) action_nightly_backup ;;
  *) action_deploy "$1" ;;
esac
