-- Prisma Migrate crée une base « fantôme » temporaire en développement.
-- L'utilisateur applicatif reçoit donc les droits globaux nécessaires (poste local uniquement).
GRANT ALL PRIVILEGES ON *.* TO 'relaytour'@'%';
FLUSH PRIVILEGES;
