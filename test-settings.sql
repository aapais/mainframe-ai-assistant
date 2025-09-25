-- Verificar se as configurações estão sendo salvas
SELECT 
    user_id,
    theme,
    language,
    api_rate_limit,
    api_timeout,
    updated_at
FROM user_settings
ORDER BY updated_at DESC
LIMIT 5;
