#!/bin/bash
echo "🚀 Fazendo deploy da nova versão..."
git add .
git commit -m "🎉 Update $(date)"
git push origin main
echo "✅ Deploy enviado!"