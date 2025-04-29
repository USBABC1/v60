# Dockerfile (Exemplo para Next.js com Pages Router)

# 1. Base Image (Use uma versão LTS ou a que você usa localmente)
FROM node:18-slim

# 2. Set working directory
WORKDIR /app

# 3. Variáveis de ambiente (Opcional, mas bom ter)
ENV NODE_ENV=production
# Para buildpacks do Railway/Nixpacks (se aplicável, pode não ser necessário se definir o PATH manualmente)
# ENV NIXPACKS_PATH=/app/node_modules/.bin:$NIXPACKS_PATH

# 4. Copiar package.json e package-lock.json PRIMEIRO
# Isso aproveita o cache do Docker se esses arquivos não mudarem
COPY package*.json ./

# 5. Instalar Dependências (USANDO npm install em vez de ci - como tentamos antes)
# Use --omit=dev para pular devDependencies em produção
# A flag --legacy-peer-deps pode ajudar com conflitos de dependência mais antigos
RUN npm install --omit=dev --legacy-peer-deps

# 6. Copiar o resto do código da aplicação
COPY . .

# 7. Construir a Aplicação
# O Railway pode montar caches aqui automaticamente se detectar o RUN
RUN npm run build

# 8. Comando para iniciar a aplicação
# <<< CORREÇÃO AQUI >>>
# Porta padrão do Next.js (Comentário na linha anterior)
EXPOSE 3000
# <<< FIM DA CORREÇÃO >>>
CMD ["npm", "start"]
