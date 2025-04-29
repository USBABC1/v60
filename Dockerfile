# Dockerfile (Exemplo para Next.js com Pages Router)

# 1. Base Image (Use uma versão LTS ou a que você usa localmente)
FROM node:20-alpine

# 2. Set working directory
WORKDIR /app

# 3. Variáveis de ambiente (Opcional, mas bom ter)
ENV NODE_ENV=production

# 4. Copiar package.json e package-lock.json PRIMEIRO
# Isso aproveita o cache do Docker se esses arquivos não mudarem
COPY package*.json ./

# 5. Instalar Dependências (Incluindo dependências de sistema para sharp/canvas)
# Adicionar dependências de sistema necessárias para sharp e canvas
RUN apk add --no-cache python3 build-base pkgconfig cairo-dev pango-dev libjpeg-turbo-dev giflib-dev libtool autoconf automake mesa-dev pixman-dev
# Adicionar fontes para chartjs-node-canvas
RUN apk add --no-cache fontconfig ttf-dejavu
# Instalar dependências do Node.js, omitindo devDependencies
RUN npm install --omit=dev --legacy-peer-deps

# 6. Copiar o resto do código da aplicação
COPY . .

# 7. Compilar o script de inicialização do banco de dados
# Compila o init-db.ts para init-db.js usando o TypeScript instalado nas dependências
RUN npx tsc --skipLibCheck true ./init-db.ts

# 8. Construir a Aplicação Next.js
# O Railway pode montar caches aqui automaticamente se detectar o RUN
RUN npm run build

# 9. Porta padrão do Next.js
EXPOSE 3000

# 10. Comando para iniciar a aplicação
# Executa o script de inicialização do banco de dados ANTES de iniciar a aplicação Next.js
CMD ["/bin/sh", "-c", "node ./init-db.js && next start"]
