CREATE INDEX IF NOT EXISTS `verification_identifier_idx` ON `verification` (`identifier`);
CREATE INDEX IF NOT EXISTS `verification_identifier_createdAt_idx` ON `verification` (`identifier`, `createdAt`);
CREATE INDEX IF NOT EXISTS `verification_expiresAt_idx` ON `verification` (`expiresAt`);
