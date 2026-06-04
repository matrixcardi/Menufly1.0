#!/bin/bash

# migrate-storage.sh
# Script para migrar arquivos do Storage do projeto antigo para o novo.
# Este script utiliza o Node.js para garantir a integridade dos uploads de arquivos binários.

if [ -z "$SOURCE_URL" ] || [ -z "$TARGET_URL" ] || [ -z "$TARGET_SERVICE_ROLE_KEY" ]; then
    echo "Erro: As variáveis de ambiente SOURCE_URL, TARGET_URL e TARGET_SERVICE_ROLE_KEY devem estar definidas."
    echo "Exemplo:"
    echo "  export SOURCE_URL=\"https://tviknowihpwolwfjuwog.supabase.co\""
    echo "  export TARGET_URL=\"https://yiwhokrotzodahdefjaf.supabase.co\""
    echo "  export TARGET_SERVICE_ROLE_KEY=\"sua_service_role_key_aqui\""
    exit 1
fi

echo "Iniciando migração de storage..."
node migrate-storage.js
