#!/usr/bin/env bash
# Vérifie ce qu'un visiteur NON connecté peut faire sur la base (clé anon du fichier .env).
# Sans danger : uniquement des comptages, et des tentatives d'écriture volontairement
# invalides (champs obligatoires absents) qui ne peuvent créer aucune ligne.
#
# Usage : bash scripts/verifier-securite.sh
set -u
cd "$(dirname "$0")/.."
URL=$(grep '^VITE_SUPABASE_URL=' .env | cut -d= -f2- | tr -d '\r" ')
KEY=$(grep '^VITE_SUPABASE_ANON_KEY=' .env | cut -d= -f2- | tr -d '\r" ')
H=(-H "apikey: $KEY" -H "Authorization: Bearer $KEY")

lecture() { # table attendu
  local count
  count=$(curl -s -o /dev/null -D - -I --max-time 20 "$URL/rest/v1/$1?select=id" "${H[@]}" \
    -H "Prefer: count=exact" -H "Range: 0-0" | grep -i '^content-range' | sed 's#.*/##' | tr -d '\r')
  printf '  %-16s lignes lisibles : %-4s (attendu : %s)\n' "$1" "${count:-?}" "$2"
}

ecriture() { # table attendu
  local body code
  body=$(curl -s --max-time 20 -X POST "$URL/rest/v1/$1" "${H[@]}" -H "Content-Type: application/json" -d '{}')
  code=$(echo "$body" | grep -o '"code":"[^"]*"' | head -1 | cut -d'"' -f4)
  case "$code" in
    42501) verdict="refusée par la sécurité" ;;
    23502) verdict="AUTORISÉE (bloquée seulement par un champ manquant)" ;;
    *) verdict="réponse : ${code:-$body}" ;;
  esac
  printf '  %-16s écriture : %s (attendu : %s)\n' "$1" "$verdict" "$2"
}

echo "Visiteur non connecté :"
lecture stolen_vehicles 0
lecture profiles 0
lecture commissariats "tous (liste publique)"
ecriture stolen_vehicles "refusée"
ecriture commissariats "refusée"
ecriture profiles "refusée"

echo "Déclaration citoyenne (fonction contrôlée, données volontairement invalides) :"
resp=$(curl -s --max-time 20 -X POST "$URL/rest/v1/rpc/declare_stolen_vehicle" "${H[@]}" -H "Content-Type: application/json" \
  -d '{"p_plate_number":"","p_vin":"","p_brand":"","p_model":"","p_color":"","p_owner_name":"","p_owner_phone":"","p_commissariat_id":null,"p_stolen_date":null}')
echo "  réponse : $(echo "$resp" | grep -o '"message":"[^"]*"' | cut -d'"' -f4)  (attendu : « Indiquez la plaque ou le numéro de châssis. »)"
