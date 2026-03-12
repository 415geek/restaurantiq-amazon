#!/usr/bin/env bash
set -euo pipefail

BASE_SHA="${1:-}"
HEAD_SHA="${2:-HEAD}"

if [[ -z "${BASE_SHA}" ]]; then
  echo "Usage: $0 <base_sha> [head_sha]" >&2
  exit 2
fi

# New branch pushes use all-zero base; compare against previous commit when possible.
if [[ "${BASE_SHA}" =~ ^0+$ ]]; then
  if git rev-parse "${HEAD_SHA}~1" >/dev/null 2>&1; then
    BASE_SHA="${HEAD_SHA}~1"
  else
    BASE_SHA="$(git hash-object -t tree /dev/null)"
  fi
fi

CHANGED_FILES="$(git diff --name-only "${BASE_SHA}" "${HEAD_SHA}")"

if [[ -z "${CHANGED_FILES}" ]]; then
  echo "No changed files detected. Skip bilingual module docs check."
  exit 0
fi

has_product_change=0
has_doc_zh=0
has_doc_en=0

while IFS= read -r file; do
  [[ -z "${file}" ]] && continue

  case "${file}" in
    docs/PRODUCT_MODULES_ZH.md)
      has_doc_zh=1
      ;;
    docs/PRODUCT_MODULES_EN.md)
      has_doc_en=1
      ;;
  esac

  case "${file}" in
    app/*|components/*|lib/*|hooks/*|public/*|restaurantiq-agents/*|middleware.ts|next.config.ts|package.json|package-lock.json)
      has_product_change=1
      ;;
  esac
done <<< "${CHANGED_FILES}"

if [[ "${has_doc_zh}" -ne "${has_doc_en}" ]]; then
  echo "Bilingual docs must be updated together." >&2
  echo "Please update both files in the same commit:" >&2
  echo "  - docs/PRODUCT_MODULES_ZH.md" >&2
  echo "  - docs/PRODUCT_MODULES_EN.md" >&2
  exit 1
fi

if [[ "${has_product_change}" -eq 1 && ( "${has_doc_zh}" -ne 1 || "${has_doc_en}" -ne 1 ) ]]; then
  echo "Product-impacting files changed without bilingual module doc updates." >&2
  echo "Please update and commit both files:" >&2
  echo "  - docs/PRODUCT_MODULES_ZH.md" >&2
  echo "  - docs/PRODUCT_MODULES_EN.md" >&2
  exit 1
fi

echo "Bilingual module docs check passed."
