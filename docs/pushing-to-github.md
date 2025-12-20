# Guía rápida para subir la rama local a GitHub

Actualmente el repo no tiene remoto configurado. Sigue estos pasos para publicar la rama local `work` (o cualquier otra) y probarla en GitHub.

1. **Añade el remoto** (sustituye `<org>` o `<user>`):
   ```bash
   git remote add origin git@github.com:<org>/castor.git
   # o: git remote add origin https://github.com/<org>/castor.git
   ```
2. **Verifica el remoto**:
   ```bash
   git remote -v
   ```
3. **Sincroniza referencias** (opcional, si el repo ya existe en GitHub):
   ```bash
   git fetch origin
   ```
4. **Publica la rama actual (`work`) o crea una nueva**:
   ```bash
   # desde la rama actual
   git push -u origin work

   # o bien crea una rama nueva antes de subir
   git checkout -b feature/ajustes-ai
   git push -u origin feature/ajustes-ai
   ```
5. **Abre el Pull Request** desde GitHub comparando tu rama con `main`. Revisa que las pruebas hayan pasado y que no haya secretos en el historial.

> Consejos rápidos: usa `git status` para confirmar que el árbol está limpio antes de subir, y evita incluir `.env` o claves secretas en los commits.
