#!/usr/bin/env node

/**
 * Servidor de autenticação Windows com PostgreSQL
 * Porta: 3004
 *
 * Este servidor:
 * 1. Detecta automaticamente o usuário Windows
 * 2. Salva as sessões no PostgreSQL
 * 3. Mantém histórico de logins
 */

const http = require('http');
const crypto = require('crypto');
const os = require('os');
const { Client } = require('./sso-deps/node_modules/pg');

const PORT = 3004;
const DATABASE_CONFIG = {
    host: 'localhost',
    port: 5432,
    database: 'mainframe_ai',
    user: 'mainframe_user',
    password: 'mainframe'
};

// Chave secreta para JWT (em produção, use variável de ambiente)
const JWT_SECRET = 'mainframe-ai-secret-key-2024';

// Função para criar conexão com o banco
async function getDBConnection() {
    const client = new Client(DATABASE_CONFIG);
    await client.connect();
    return client;
}

// Função para gerar token JWT simples
function generateToken(payload) {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64');
    const payloadStr = Buffer.from(JSON.stringify(payload)).toString('base64');
    const signature = crypto
        .createHmac('sha256', JWT_SECRET)
        .update(`${header}.${payloadStr}`)
        .digest('base64');

    return `${header}.${payloadStr}.${signature}`;
}

// Função para obter informações do usuário Windows
function getWindowsUserInfo() {
    const username = process.env.USERNAME || process.env.USER || os.userInfo().username;
    const hostname = os.hostname();
    const domain = process.env.USERDOMAIN || 'LOCAL';

    return {
        username: username.toLowerCase(),
        display_name: username,
        computer: hostname,
        domain: domain,
        email: `${username.toLowerCase()}@${domain.toLowerCase()}.local`
    };
}

// Função para salvar ou atualizar usuário no banco
async function saveUserToDB(userInfo) {
    const client = await getDBConnection();

    try {
        // Gera ID único para o usuário
        const userId = crypto
            .createHash('sha256')
            .update(`${userInfo.username}@${userInfo.computer}`)
            .digest('hex')
            .substring(0, 16);

        // Verifica se o usuário já existe
        const checkUser = await client.query(
            'SELECT id FROM users WHERE id = $1',
            [userId]
        );

        if (checkUser.rows.length === 0) {
            // Insere novo usuário
            await client.query(
                `INSERT INTO users (id, username, display_name, email, computer, domain, role, is_active, created_at, last_login)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                [userId, userInfo.username, userInfo.display_name, userInfo.email,
                 userInfo.computer, userInfo.domain, 'user', true]
            );
            console.log(`✅ Novo usuário criado: ${userInfo.username}`);
        } else {
            // Atualiza último login
            await client.query(
                'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
                [userId]
            );
            console.log(`✅ Último login atualizado: ${userInfo.username}`);
        }

        return userId;
    } finally {
        await client.end();
    }
}

// Função para criar sessão no banco
async function createSession(userId, token, ipAddress, userAgent) {
    const client = await getDBConnection();

    try {
        // Define expiração em 8 horas
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 8);

        // Insere nova sessão
        await client.query(
            `INSERT INTO sessions (user_id, token, ip_address, user_agent, expires_at, is_active)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [userId, token, ipAddress, userAgent, expiresAt, true]
        );

        console.log(`✅ Sessão criada para usuário: ${userId}`);

        // Registra no log de autenticação
        const userResult = await client.query('SELECT username FROM users WHERE id = $1', [userId]);
        const username = userResult.rows[0]?.username || 'unknown';

        await client.query(
            `INSERT INTO auth_logs (user_id, username, action, ip_address, user_agent, success)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [userId, username, 'login', ipAddress, userAgent, true]
        );

    } finally {
        await client.end();
    }
}

// Função para verificar token válido
async function verifyToken(token) {
    const client = await getDBConnection();

    try {
        const result = await client.query(
            `SELECT s.*, u.username, u.display_name, u.email, u.computer, u.role
             FROM sessions s
             JOIN users u ON s.user_id = u.id
             WHERE s.token = $1
             AND s.is_active = true
             AND s.expires_at > CURRENT_TIMESTAMP`,
            [token]
        );

        if (result.rows.length > 0) {
            return result.rows[0];
        }

        return null;
    } finally {
        await client.end();
    }
}

// Servidor HTTP
const server = http.createServer(async (req, res) => {
    // Headers CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Content-Type', 'application/json');

    // Handle OPTIONS
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    const url = new URL(req.url, `http://localhost:${PORT}`);

    // Extrai IP e User-Agent
    const ipAddress = req.headers['x-forwarded-for'] || req.connection.remoteAddress || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'Unknown';

    try {
        // Rota: Status do servidor
        if (url.pathname === '/api/auth/status') {
            const userInfo = getWindowsUserInfo();
            res.writeHead(200);
            res.end(JSON.stringify({
                success: true,
                message: 'Servidor de autenticação Windows rodando',
                windows_user: userInfo.username,
                computer: userInfo.computer,
                domain: userInfo.domain,
                database: 'PostgreSQL conectado'
            }));
            return;
        }

        // Rota: Login com Windows
        if (url.pathname === '/api/auth/windows/login') {
            console.log('\n🔐 Requisição de login recebida...');

            const userInfo = getWindowsUserInfo();

            // Salva/atualiza usuário no banco
            const userId = await saveUserToDB(userInfo);

            // Gera token
            const tokenPayload = {
                id: userId,
                username: userInfo.username,
                computer: userInfo.computer,
                iat: Date.now(),
                exp: Date.now() + (8 * 60 * 60 * 1000) // 8 horas
            };

            const token = generateToken(tokenPayload);

            // Cria sessão no banco
            await createSession(userId, token, ipAddress, userAgent);

            res.writeHead(200);
            res.end(JSON.stringify({
                success: true,
                token: token,
                user: {
                    id: userId,
                    username: userInfo.username,
                    display_name: userInfo.display_name,
                    email: userInfo.email,
                    computer: userInfo.computer,
                    domain: userInfo.domain,
                    role: 'user'
                },
                expires_in: 28800, // 8 horas em segundos
                message: 'Login realizado com sucesso'
            }));

            console.log(`✅ Login bem-sucedido: ${userInfo.username}@${userInfo.computer}`);
            return;
        }

        // Rota: Verificar token
        if (url.pathname === '/api/auth/verify') {
            const authHeader = req.headers.authorization;

            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                res.writeHead(401);
                res.end(JSON.stringify({
                    success: false,
                    error: 'Token não fornecido'
                }));
                return;
            }

            const token = authHeader.substring(7);
            const session = await verifyToken(token);

            if (session) {
                res.writeHead(200);
                res.end(JSON.stringify({
                    success: true,
                    user: {
                        id: session.user_id,
                        username: session.username,
                        display_name: session.display_name,
                        email: session.email,
                        computer: session.computer,
                        role: session.role
                    },
                    expires_at: session.expires_at
                }));
            } else {
                res.writeHead(401);
                res.end(JSON.stringify({
                    success: false,
                    error: 'Token inválido ou expirado'
                }));
            }
            return;
        }

        // Rota: Logout
        if (url.pathname === '/api/auth/logout') {
            const authHeader = req.headers.authorization;

            if (authHeader && authHeader.startsWith('Bearer ')) {
                const token = authHeader.substring(7);
                const client = await getDBConnection();

                try {
                    // Desativa a sessão
                    await client.query(
                        'UPDATE sessions SET is_active = false WHERE token = $1',
                        [token]
                    );

                    // Registra logout
                    const session = await client.query(
                        'SELECT user_id FROM sessions WHERE token = $1',
                        [token]
                    );

                    if (session.rows.length > 0) {
                        await client.query(
                            `INSERT INTO auth_logs (user_id, username, action, ip_address, user_agent, success)
                             VALUES ($1, (SELECT username FROM users WHERE id = $1), $2, $3, $4, $5)`,
                            [session.rows[0].user_id, 'logout', ipAddress, userAgent, true]
                        );
                    }
                } finally {
                    await client.end();
                }
            }

            res.writeHead(200);
            res.end(JSON.stringify({
                success: true,
                message: 'Logout realizado com sucesso'
            }));
            return;
        }

        // Rota não encontrada
        res.writeHead(404);
        res.end(JSON.stringify({
            success: false,
            error: 'Endpoint não encontrado'
        }));

    } catch (error) {
        console.error('❌ Erro:', error);
        res.writeHead(500);
        res.end(JSON.stringify({
            success: false,
            error: error.message
        }));
    }
});

// Inicia o servidor
server.listen(PORT, async () => {
    console.log('=' .repeat(60));
    console.log('🚀 SERVIDOR DE AUTENTICAÇÃO WINDOWS + POSTGRESQL');
    console.log('=' .repeat(60));
    console.log(`✅ Servidor rodando na porta ${PORT}`);
    console.log(`📊 Base de dados: mainframe_ai`);

    // Testa conexão com o banco
    try {
        const client = await getDBConnection();
        await client.query('SELECT 1');
        await client.end();
        console.log('✅ Conexão com PostgreSQL estabelecida');
    } catch (error) {
        console.error('❌ Erro ao conectar com PostgreSQL:', error.message);
    }

    const userInfo = getWindowsUserInfo();
    console.log(`\n👤 Usuário Windows detectado: ${userInfo.username}`);
    console.log(`💻 Computador: ${userInfo.computer}`);
    console.log(`🏢 Domínio: ${userInfo.domain}`);

    console.log('\n📝 Endpoints disponíveis:');
    console.log('   GET  /api/auth/status - Status do servidor');
    console.log('   GET  /api/auth/windows/login - Login com Windows');
    console.log('   POST /api/auth/verify - Verificar token');
    console.log('   POST /api/auth/logout - Fazer logout');

    console.log('\n✨ Servidor pronto para autenticação!');
    console.log('=' .repeat(60));
});