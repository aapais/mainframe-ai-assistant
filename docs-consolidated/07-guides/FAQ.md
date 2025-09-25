# FAQ - Perguntas Frequentes
## Sistema de Gestão de Incidentes - Versão 2.0

### 📋 Índice
1. [Uso Geral](#uso-geral)
2. [Incidentes](#incidentes)
3. [Base de Conhecimento](#base-de-conhecimento)
4. [Busca e IA](#busca-e-ia)
5. [Contas e Permissões](#contas-e-permissões)
6. [Problemas Técnicos](#problemas-técnicos)
7. [Integrações](#integrações)
8. [Performance](#performance)
9. [Segurança](#segurança)
10. [Migração e Atualizações](#migração-e-atualizações)

---

## Uso Geral

### ❓ Como acesso o sistema pela primeira vez?

**R:** Após receber o convite por email:
1. Clique no link de ativação no email
2. Defina sua senha (mínimo 8 caracteres)
3. Configure 2FA se obrigatório na sua organização
4. Faça login com seu email e senha
5. Complete seu perfil se necessário

**📧 Email de convite não chegou?**
- Verifique spam/lixeira
- Aguarde até 10 minutos
- Contate seu administrador para reenvio

### ❓ Esqueci minha senha, como recuperar?

**R:** Na tela de login:
1. Clique em "Esqueci minha senha"
2. Digite seu email cadastrado
3. Verifique o email de recuperação (incluindo spam)
4. Clique no link e defina nova senha
5. Faça login com a nova senha

**⚠️ Link expirado?**
- Links de recuperação expiram em 1 hora
- Solicite novo link se necessário
- Entre em contato com o administrador se persistir

### ❓ Como altero minha senha?

**R:** No sistema:
1. Vá em "Perfil" (ícone do usuário)
2. Clique em "Configurações de Conta"
3. Selecione "Alterar Senha"
4. Digite senha atual e nova senha
5. Confirme a alteração

**🔒 Requisitos de senha:**
- Mínimo 8 caracteres
- Ao menos 1 letra maiúscula
- Ao menos 1 número
- Ao menos 1 caractere especial

### ❓ Como funciona o sistema de notificações?

**R:** O sistema envia notificações via:
- **Email** - Para atualizações importantes
- **Browser** - Notificações push (se habilitadas)
- **In-app** - Notificações dentro do sistema

**🔔 Configurar notificações:**
1. Perfil > Configurações
2. Aba "Notificações"
3. Escolha o que quer receber e como
4. Salve as preferências

### ❓ Posso usar o sistema no celular?

**R:** Sim! O sistema é responsivo e funciona bem em:
- 📱 **Smartphones** - Interface otimizada
- 💻 **Tablets** - Layout adaptativo
- 🖥️ **Desktops** - Interface completa

**📱 Funcionalidades mobile:**
- Visualizar incidentes
- Criar incidentes básicos
- Buscar na base de conhecimento
- Receber notificações
- Comentar em incidentes

---

## Incidentes

### ❓ Como criar um novo incidente?

**R:** Para criar um incidente:
1. Clique no botão "Novo Incidente" (+ verde)
2. Preencha o título descritivo
3. Detalhe o problema na descrição
4. Selecione prioridade e área técnica
5. Adicione tags se necessário
6. Clique em "Criar Incidente"

**💡 Dica:** O sistema sugere automaticamente:
- Categoria baseada na descrição
- Incidentes similares existentes
- Pessoa mais adequada para resolver

### ❓ Como acompanhar o status de um incidente?

**R:** Para acompanhar incidentes:
1. **Lista de Incidentes** - Status colorido
2. **Dashboard** - Visão geral dos seus incidentes
3. **Notificações** - Atualizações automáticas
4. **Detalhes** - Timeline completa de mudanças

**🎯 Status disponíveis:**
- 🆕 **NOVO** - Recém criado
- ⚡ **EM_PROGRESSO** - Sendo trabalhado
- ✅ **RESOLVIDO** - Solução implementada
- 🔒 **FECHADO** - Confirmado como resolvido
- 🔄 **REABERTO** - Problema retornou

### ❓ Posso editar um incidente após criar?

**R:** Sim, dependendo das suas permissões:
- **Próprios incidentes** - Pode editar título, descrição, adicionar comentários
- **Incidentes atribuídos** - Pode atualizar status, resolução, comentários
- **Todos incidentes** - Gestores e admins podem editar qualquer campo

**❌ Não é possível editar:**
- Data de criação
- Histórico de alterações
- UUID do incidente

### ❓ Como funciona o sistema de prioridades?

**R:** As prioridades seguem esta escala:
- 🔴 **CRÍTICA** - Sistema parado, muitos usuários afetados (SLA: 1h)
- 🟠 **ALTA** - Funcionalidade importante indisponível (SLA: 4h)
- 🟡 **MÉDIA** - Problema afeta alguns usuários (SLA: 24h)
- 🟢 **BAIXA** - Melhoria ou problema menor (SLA: 72h)

**⚖️ Fatores considerados:**
- Número de usuários afetados
- Impacto no negócio
- Criticidade do sistema
- Urgência da resolução

### ❓ O que acontece quando marco um incidente como resolvido?

**R:** Quando marca como resolvido:
1. **Automaticamente** vira artigo na base de conhecimento
2. **Notifica** o reportador da resolução
3. **Para** o contador de SLA
4. **Permite** feedback sobre a solução
5. **Fica** disponível para busca

**📚 Base de Conhecimento:**
- Título + solução viram artigo
- Categorizado automaticamente
- Indexado para busca
- Disponível para equipe

---

## Base de Conhecimento

### ❓ Como a base de conhecimento é alimentada?

**R:** A base de conhecimento cresce através de:
- **Automático** - Incidentes resolvidos viram artigos
- **Manual** - Analistas criam artigos específicos
- **IA** - Sistema sugere melhorias nos artigos
- **Colaborativo** - Equipe contribui e melhora conteúdo

**🤖 Processo automático:**
1. Incidente marcado como resolvido
2. IA analisa qualidade da resolução
3. Se boa, vira artigo automaticamente
4. Categorizado e indexado
5. Disponível para busca imediatamente

### ❓ Como encontro artigos relevantes na base de conhecimento?

**R:** Várias formas de buscar:
- **Busca Unificada** - Pesquisa em tudo simultaneamente
- **Filtros** - Por categoria, tags, data
- **Navegação** - Browse por categorias
- **Sugestões IA** - Sistema recomenda baseado no contexto
- **Artigos Relacionados** - Links automáticos entre conteúdos

**🎯 Dicas de busca:**
- Use termos específicos técnicos
- Combine palavras-chave
- Use filtros para refinar
- Verifique sugestões da IA

### ❓ Posso criar artigos manualmente na base de conhecimento?

**R:** Sim, se tiver permissão (Analista ou superior):
1. Vá em "Base de Conhecimento"
2. Clique em "Novo Artigo"
3. Preencha título, conteúdo e categoria
4. Adicione tags relevantes
5. Defina nível de confiança
6. Publique o artigo

**📝 Boas práticas:**
- Título claro e descritivo
- Conteúdo estruturado (problema, solução, verificação)
- Tags específicas
- Exemplos práticos
- Passos verificáveis

### ❓ Como avalio a qualidade de um artigo?

**R:** Você pode avaliar artigos através de:
- **Rating** - 1 a 5 estrelas
- **Útil/Não útil** - Botões de feedback rápido
- **Comentários** - Sugestões de melhoria
- **Uso** - Sistema rastreia quantas vezes foi usado

**⭐ Sistema de qualidade:**
- Artigos com +4 estrelas são destacados
- Artigos com baixo rating são revisados
- Feedback é usado para melhorias
- IA sugere atualizações baseadas no uso

---

## Busca e IA

### ❓ Como funciona a busca unificada?

**R:** A busca unificada pesquisa em:
- **Incidentes** - Título, descrição, resolução, comentários
- **Base de Conhecimento** - Todo o conteúdo dos artigos
- **Contextual** - Considera seu histórico e perfil
- **Semântica** - Entende sinônimos e contexto

**🔍 Tipos de busca:**
- **Textual** - Busca tradicional por palavras
- **Semântica** - IA entende o contexto
- **Híbrida** - Combina textual + semântica (padrão)

### ❓ Como uso a busca semântica?

**R:** A busca semântica entende perguntas naturais:
- "Como resolver lentidão no banco de dados?"
- "Problema de conexão PostgreSQL timeout"
- "Usuários não conseguem fazer login"

**💡 Funciona melhor com:**
- Perguntas completas em linguagem natural
- Descrição do problema, não só palavras-chave
- Contexto específico da sua área

### ❓ O que são as sugestões automáticas da IA?

**R:** O sistema oferece sugestões inteligentes para:
- **Categorização** - Sugere categoria baseada na descrição
- **Atribuição** - Recomenda quem deve resolver
- **Soluções** - Propõe soluções baseadas no histórico
- **Similares** - Mostra incidentes parecidos
- **Próximos Passos** - Sugere ações para investigação

**🎯 Base das sugestões:**
- Histórico de incidentes similares
- Padrões de resolução da equipe
- Base de conhecimento
- Machine learning interno

### ❓ Posso desativar as sugestões de IA?

**R:** Sim, nas configurações do usuário:
1. Perfil > Configurações
2. Aba "Inteligência Artificial"
3. Desative as sugestões que não deseja
4. Salve as preferências

**⚙️ Opções configuráveis:**
- Sugestão de categoria
- Sugestão de atribuição
- Sugestão de soluções
- Detecção de duplicatas
- Busca semântica

---

## Contas e Permissões

### ❓ Quais são os diferentes tipos de usuário?

**R:** O sistema possui 5 níveis:
- 👤 **User** - Pode criar e acompanhar próprios incidentes
- 🔍 **Analyst** - Pode resolver incidentes e criar conhecimento
- 👥 **Manager** - Supervisiona equipes e acessa relatórios
- 🔧 **Admin** - Gerencia usuários e configurações do sistema
- 🛡️ **Super Admin** - Controle total incluindo configurações avançadas

**📊 Matriz de permissões completa disponível no [Guia do Administrador](./ADMIN_GUIDE.md#gestão-de-usuários)**

### ❓ Como solicito acesso a mais funcionalidades?

**R:** Para solicitar permissões adicionais:
1. Entre em contato com seu gestor imediato
2. Ou abra chamado para o administrador do sistema
3. Justifique a necessidade das novas permissões
4. Aguarde aprovação e configuração

**📝 Informações necessárias:**
- Que funcionalidades precisa
- Justificativa de negócio
- Período necessário (permanente/temporário)

### ❓ Posso ver quem tem acesso ao sistema?

**R:** Depende do seu nível:
- **Users/Analysts** - Não têm acesso à lista
- **Managers** - Veem equipe sob supervisão
- **Admins** - Veem todos os usuários

**👥 Para ver colegas:**
- Use @mention nos comentários
- Lista aparece automaticamente
- Mostra usuários ativos da sua área

### ❓ Como funciona o sistema de aprovações?

**R:** Para ações sensíveis, há aprovações:
- **Exclusão de incidentes** - Requer aprovação do gestor
- **Mudanças de permissão** - Aprovação do admin
- **Acesso a dados sensíveis** - Dupla aprovação
- **Integrações externas** - Aprovação técnica + negócio

**⏰ SLA de aprovações:**
- Solicitações normais: 48h
- Urgentes: 4h
- Críticas: 1h

---

## Problemas Técnicos

### ❓ O sistema está lento, o que fazer?

**R:** Verifique na seguinte ordem:
1. **Conectividade** - Teste sua internet
2. **Browser** - Use Chrome/Firefox atualizados
3. **Cache** - Limpe cache do navegador (Ctrl+F5)
4. **Extensões** - Desative extensions temporariamente
5. **Recursos** - Feche outras abas/programas

**🔧 Limpeza de cache:**
- **Chrome:** Ctrl+Shift+Del
- **Firefox:** Ctrl+Shift+Del
- **Safari:** Cmd+Option+E

### ❓ Não consigo fazer login, o que verificar?

**R:** Passos para diagnóstico:
1. **Credenciais** - Verifique email e senha
2. **Caps Lock** - Confirme se não está ativo
3. **2FA** - Use código atual do app autenticador
4. **Browser** - Teste navegador diferente
5. **Rede** - Verifique se não há proxy/firewall

**🔐 Se continuar com problema:**
- Use "Esqueci minha senha"
- Contate o administrador
- Verifique se conta não está bloqueada

### ❓ Perdi dados não salvos, posso recuperar?

**R:** Possibilidades de recuperação:
- **Auto-save** - Sistema salva automaticamente a cada 2 minutos
- **Rascunhos** - Incidentes parciais ficam salvos
- **Histórico** - Mudanças ficam no histórico
- **Browser** - Cache pode ter dados temporários

**💾 Para evitar perda:**
- Salve frequentemente (Ctrl+S)
- Use múltiplas abas com cuidado
- Não feche browser com dados não salvos

### ❓ Como reporto um bug do sistema?

**R:** Para reportar problemas:
1. **Reproduza** o erro se possível
2. **Documente** os passos exatos
3. **Screenshot** da tela com erro
4. **Console** - Abra F12 > Console e copie erros
5. **Contate** suporte técnico com essas informações

**📋 Informações úteis:**
- Browser e versão
- Sistema operacional
- Horário do erro
- O que estava fazendo
- Mensagem de erro completa

---

## Integrações

### ❓ O sistema integra com ferramentas externas?

**R:** Sim! Integrações disponíveis:
- **📧 Email** - Notificações automáticas
- **💬 Slack/Teams** - Alertas em canais
- **📊 Monitoramento** - Prometheus, Grafana
- **🎫 Ticketing** - Jira, ServiceNow
- **🔐 SSO** - Active Directory, LDAP, SAML
- **📈 BI** - Power BI, Tableau

**🔌 Como habilitar:**
1. Contate o administrador
2. Forneça dados de conexão necessários
3. Teste a integração em ambiente de homologação
4. Libere para produção

### ❓ Posso receber incidentes por email?

**R:** Sim, configuração disponível:
1. **Recebimento** - Emails para incident@empresa.com viram incidentes
2. **Classificação** - IA categoriza automaticamente
3. **Notificações** - Confirmação de recebimento
4. **Processamento** - Extraí informações relevantes

**📧 Formato recomendado:**
- Assunto claro e específico
- Descrição detalhada no corpo
- Anexos com screenshots/logs
- Informações de contato

### ❓ Como funciona a integração com monitoramento?

**R:** Integrações de monitoramento:
- **Alertas** - Ferramentas de monitoring criam incidentes automaticamente
- **Métricas** - Dashboard incorpora dados de performance
- **Correlação** - Liga incidentes a métricas específicas
- **Auto-resolução** - Fecha incidentes quando métricas normalizam

**🔗 Ferramentas suportadas:**
- Prometheus + AlertManager
- Grafana
- New Relic
- DataDog
- Nagios
- Zabbix

### ❓ Posso exportar dados do sistema?

**R:** Sim, várias opções de export:
- **Relatórios** - PDF, Excel, CSV
- **API** - Acesso programático a todos os dados
- **Backup** - Dumps completos para administradores
- **Bulk Export** - Exportação em massa

**📊 Formatos disponíveis:**
- CSV para análises
- JSON para integrações
- PDF para documentação
- Excel para gestão

---

## Performance

### ❓ Quantos usuários o sistema suporta simultaneamente?

**R:** Capacidade atual:
- **Usuários simultâneos** - Até 500 usuários ativos
- **Incidentes** - Suporta milhões de registros
- **Conhecimento** - Base ilimitada de artigos
- **Buscas** - 1000+ buscas simultâneas

**📈 Performance esperada:**
- Página carrega em < 2 segundos
- Busca retorna em < 1 segundo
- Criação de incidente < 3 segundos

### ❓ Como melhorar a performance na minha rede?

**R:** Otimizações recomendadas:
1. **Bandwidth** - Mínimo 10Mbps para equipe completa
2. **Latência** - < 100ms para melhor experiência
3. **Proxy** - Configure cache para recursos estáticos
4. **CDN** - Use CDN se usuários geograficamente distribuídos

**⚡ Configurações de rede:**
- Libere portas 80/443
- Whitelist domínio da aplicação
- Configure QoS para aplicações web

### ❓ O sistema funciona offline?

**R:** Funcionalidades offline limitadas:
- **Leitura** - Visualizar incidentes já carregados
- **Cache** - Browser mantém dados temporariamente
- **Sync** - Sincroniza quando volta online

**❌ Não funciona offline:**
- Criar/editar incidentes
- Buscas
- Relatórios em tempo real
- Notificações

**💡 Para ambientes com instabilidade:**
- Configure auto-save frequente
- Use múltiplas abas com cuidado
- Salve trabalho importante localmente

---

## Segurança

### ❓ Os dados ficam seguros no sistema?

**R:** Medidas de segurança implementadas:
- **Criptografia** - TLS 1.3 para transmissão, AES-256 para armazenamento
- **Autenticação** - 2FA obrigatório, tokens seguros
- **Autorização** - Controle granular de permissões
- **Auditoria** - Log completo de todas as ações
- **Backup** - Backups criptografados e testados
- **Compliance** - LGPD, ISO 27001

**🔒 Certificações:**
- Penetration testing semestral
- Vulnerability scanning contínuo
- Code review obrigatório
- Security training para equipe

### ❓ Como funciona o controle de acesso?

**R:** Múltiplas camadas de segurança:
1. **Autenticação** - Email/senha + 2FA
2. **Autorização** - Permissões por papel
3. **Network** - IP whitelisting disponível
4. **Sessão** - Timeout automático
5. **Device** - Registro de dispositivos

**👤 Controle granular:**
- Ver apenas próprios incidentes
- Editar baseado em atribuição
- Administrar conforme papel
- Auditoria de todas as ações

### ❓ Posso configurar IP whitelisting?

**R:** Sim, para organizações que precisam:
1. **Solicite** ao administrador
2. **Forneça** lista de IPs/ranges autorizados
3. **Teste** conectividade após configuração
4. **Mantenha** lista atualizada

**🌐 Cenários comuns:**
- Escritórios fixos
- VPN corporativa
- Home office com IP fixo
- Integrações sistema-a-sistema

### ❓ Como reporto uma vulnerabilidade de segurança?

**R:** Para reportar problemas de segurança:
1. **Email** - security@empresa.com (PGP disponível)
2. **Urgente** - Telefone do CISO
3. **Details** - Máximo de detalhes possível
4. **Responsável** - Disclosure responsável

**🔒 Processo:**
- Confirmação em 24h
- Investigação em 48h
- Fix em 7 dias (crítico) / 30 dias (outros)
- Comunicação contínua sobre progresso

---

## Migração e Atualizações

### ❓ Como migro dados de outro sistema?

**R:** Processo de migração disponível:
1. **Assessment** - Análise do sistema atual
2. **Mapping** - Mapeamento de campos
3. **Extract** - Exportação dos dados atuais
4. **Transform** - Conversão para formato compatível
5. **Load** - Importação para novo sistema
6. **Validation** - Verificação da integridade

**📋 Dados migráveis:**
- Incidentes históricos
- Base de conhecimento
- Usuários e permissões
- Configurações
- Relatórios

### ❓ O sistema terá atualizações?

**R:** Ciclo de atualizações:
- **Patches** - Correções a cada 2 semanas
- **Features** - Novas funcionalidades mensais
- **Major** - Versões grandes a cada 6 meses
- **Security** - Patches de segurança imediatos

**📢 Comunicação:**
- Release notes detalhadas
- Training para funcionalidades novas
- Período de teste em homologação
- Rollback plan para emergências

### ❓ Como fico sabendo das novidades?

**R:** Canais de comunicação:
- **In-app** - Notificações dentro do sistema
- **Email** - Newsletter mensal
- **Portal** - Página de changelog
- **Training** - Sessões para funcionalidades maiores

**📰 Conteúdo das comunicações:**
- Novas funcionalidades
- Correções importantes
- Melhorias de performance
- Mudanças que afetam workflow

### ❓ Posso sugerir melhorias para o sistema?

**R:** Sim! Adoramos feedback:
1. **Portal** - Sistema de sugestões interno
2. **Email** - feedback@empresa.com
3. **Reuniões** - Sessions mensais com usuários
4. **Survey** - Pesquisas periódicas

**💡 Como sugerir:**
- Descreva o problema atual
- Proponha solução específica
- Explique benefícios esperados
- Inclua mockups se possível

**🎯 Priorizamos sugestões por:**
- Número de usuários impactados
- Complexidade de implementação
- Alinhamento com roadmap
- ROI estimado

---

## 🆘 Precisa de Ajuda Adicional?

### Contatos de Suporte

#### Suporte Técnico
- **Email:** suporte@empresa.com
- **Telefone:** +55 11 9999-1111
- **Horário:** Segunda a Sexta, 8h às 18h
- **SLA:** Resposta em 4h úteis

#### Suporte de Emergência
- **Telefone:** +55 11 9999-2222
- **WhatsApp:** +55 11 9999-3333
- **Disponibilidade:** 24x7 para críticos
- **SLA:** Resposta em 1h

#### Recursos de Auto-Ajuda
- **Documentação:** [Guia do Usuário](./USER_MANUAL.md)
- **Vídeos:** Portal de treinamento interno
- **FAQ:** Esta página
- **Community:** Fórum interno de usuários

### Como Abrir Chamado de Suporte

1. **Descreva** o problema claramente
2. **Inclua** screenshots ou videos
3. **Informe** dados do ambiente (browser, OS)
4. **Especifique** urgência/impacto
5. **Forneça** contato para retorno

---

**FAQ - Sistema de Gestão de Incidentes**
**Última Atualização:** 24/09/2024
**Próxima Revisão:** 24/11/2024
**Responsável:** Equipe de Suporte ao Usuário

*Esta FAQ é atualizada regularmente baseada nas dúvidas mais frequentes dos usuários. Sugestões de melhorias são bem-vindas!*