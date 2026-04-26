# ══════════════════════════════════════════════════════
# SGP Backend — Dockerfile
# ══════════════════════════════════════════════════════

FROM node:20-alpine

# Directorio de trabajo dentro del contenedor
WORKDIR /app

# Copiar package.json primero (mejor uso del cache de Docker)
COPY package*.json ./

# Instalar dependencias
RUN npm install --production

# Copiar el resto del código
COPY . .

# Puerto que expone el backend
EXPOSE 3000

# Comando para arrancar
CMD ["node", "src/index.js"]
