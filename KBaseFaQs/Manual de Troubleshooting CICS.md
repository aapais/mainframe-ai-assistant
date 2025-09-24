# Manual de Troubleshooting CICS para Desenvolvimento em Mainframes IBM

## Índice

1. [Introdução ao CICS](#introdução-ao-cics)
2. [Conceitos Fundamentais](#conceitos-fundamentais)
3. [Ferramentas de Diagnóstico](#ferramentas-de-diagnóstico)
4. [Comandos CICS Essenciais](#comandos-cics-essenciais)
5. [Análise de Logs e Traces](#análise-de-logs-e-traces)
6. [Códigos de Erro Comuns e Soluções](#códigos-de-erro-comuns-e-soluções)
7. [Problemas de Performance](#problemas-de-performance)
8. [Debugging de Programas CICS](#debugging-de-programas-cics)
9. [Problemas de Conectividade](#problemas-de-conectividade)
10. [Melhores Práticas](#melhores-práticas)

## 1. Introdução ao CICS

### O que é CICS?
CICS (Customer Information Control System) é um servidor de transações da IBM que fornece serviços online de processamento de transações e gerenciamento de transações para aplicações empresariais críticas em mainframes z/OS.

### Arquitetura CICS
O CICS opera como um subsistema do z/OS, gerenciando:
- Programas de aplicação
- Recursos (arquivos, bases de dados, filas)
- Comunicações entre sistemas
- Segurança e controle de acesso
- Recuperação e integridade transacional

## 2. Conceitos Fundamentais

### Transações CICS
Uma transação CICS é identificada por um código de 4 caracteres (TRANID) e consiste em:
- **Programa Principal**: Executado quando a transação é iniciada
- **Recursos Associados**: Ficheiros, bases de dados, terminais
- **Definições de Segurança**: Níveis de acesso e autorização

### Tarefas (Tasks)
Cada execução de uma transação cria uma task, que é a unidade básica de trabalho no CICS.

### Regiões CICS
- **AOR (Application Owning Region)**: Onde as aplicações executam
- **TOR (Terminal Owning Region)**: Gerencia conexões de terminal
- **FOR (File Owning Region)**: Gerencia acesso a ficheiros
- **WOR (Web Owning Region)**: Gerencia serviços web

## 3. Ferramentas de Diagnóstico

### CEDF (CICS Execution Diagnostic Facility)
Ferramenta interativa para debugging de programas CICS em tempo real.

**Ativação:**
```
CEDF ON
```

**Funcionalidades:**
- Intercepção de comandos CICS
- Visualização de áreas de trabalho
- Modificação de variáveis em runtime
- Step-by-step execution

### CEMT (CICS Master Terminal)
Interface de comando para monitorização e controle de recursos CICS.

**Comandos Úteis:**
```
CEMT INQ TRANSACTION(tranid)    - Consultar estado da transação
CEMT SET TRANSACTION(tranid) ENABLED - Habilitar transação
CEMT INQ PROGRAM(progname)      - Verificar estado do programa
CEMT SET PROGRAM(progname) NEWCOPY - Carregar nova cópia do programa
```

### CECI (Command Interpreter)
Permite executar comandos CICS interativamente para teste.

```
CECI INQUIRE FILE(filename)
CECI LINK PROGRAM(progname) COMMAREA(&data)
```

## 4. Comandos CICS Essenciais

### Comandos de Controle de Programa
```cobol
EXEC CICS LINK
    PROGRAM(program-name)
    COMMAREA(data-area)
    LENGTH(data-length)
END-EXEC

EXEC CICS XCTL
    PROGRAM(program-name)
    COMMAREA(data-area)
    LENGTH(data-length)
END-EXEC

EXEC CICS RETURN
    TRANSID(transaction-id)
    COMMAREA(data-area)
    LENGTH(data-length)
END-EXEC
```

### Comandos de Manipulação de Ficheiros
```cobol
EXEC CICS READ
    FILE(filename)
    INTO(data-area)
    RIDFLD(key-field)
    RESP(response-code)
END-EXEC

EXEC CICS WRITE
    FILE(filename)
    FROM(data-area)
    RIDFLD(key-field)
    RESP(response-code)
END-EXEC
```

### Comandos de Gestão de Erros
```cobol
EXEC CICS HANDLE CONDITION
    ERROR(error-routine)
    NOTFND(notfound-routine)
END-EXEC

EXEC CICS HANDLE ABEND
    LABEL(abend-routine)
END-EXEC
```

## 5. Análise de Logs e Traces

### System Log (MSGUSR)
Contém mensagens do sistema CICS e informações de diagnóstico.

**Mensagens Importantes:**
- **DFHxxnnnn**: Formato padrão das mensagens CICS
  - xx: Componente (ex: SM para Storage Manager)
  - nnnn: Número da mensagem

### Trace Facilities

#### Auxiliary Trace
Grava informações detalhadas em datasets auxiliares.
```
CEMT SET AUXTRACE ON
CEMT SET AUXTRACE SWITCH
```

#### Internal Trace
Mantém trace em memória (mais rápido, mas limitado).
```
CEMT SET INTRACE ON
```

### Transaction Dump
Para análise post-mortem de problemas.

**Forçar dump:**
```cobol
EXEC CICS DUMP
    TRANSACTION
    DUMPCODE('MYDU')
END-EXEC
```

## 6. Códigos de Erro Comuns e Soluções

### ASRA (0C1, 0C4, 0C7)
**Descrição**: Abend de programa por violação de storage ou dados inválidos

**Diagnóstico:**
1. Verificar dump da transação
2. Localizar PSW e registros no momento do abend
3. Identificar instrução problemática

**Soluções Comuns:**
- 0C1: Instrução inválida - verificar branch para área de dados
- 0C4: Protection exception - verificar acessos a memória
- 0C7: Data exception - verificar campos numéricos não inicializados

### AEI0 (Program Not Found)
**Descrição**: Programa não encontrado no PPT (Program Processing Table)

**Diagnóstico:**
```
CEMT INQ PROGRAM(progname)
```

**Solução:**
1. Verificar se programa está definido no CSD
2. Instalar programa: `CEDA INSTALL PROGRAM(progname)`
3. Verificar DFHRPL concatenation

### AICA (Runaway Task)
**Descrição**: Task excedeu limite de CPU (RUNAWAY)

**Diagnóstico:**
1. Verificar valor RUNAWAY no SIT
2. Analisar loops infinitos no código

**Solução:**
```
CEMT SET TRANSACTION(tranid) RUNAWAY(value)
```

### AFCF (File Not Open)
**Descrição**: Tentativa de acesso a ficheiro não aberto

**Diagnóstico:**
```
CEMT INQ FILE(filename)
```

**Solução:**
```
CEMT SET FILE(filename) OPEN ENABLED
```

### NOTAUTH (Not Authorized)
**Descrição**: Usuário sem autorização para recurso

**Diagnóstico:**
1. Verificar definições de segurança RACF/ACF2/Top Secret
2. Consultar CICS security definitions

**Solução:**
- Atualizar perfis de segurança
- Verificar RESSEC e CMDSEC nas definições de transação

## 7. Problemas de Performance

### Análise de Performance

#### Monitoring Facility (CMF)
Coleta estatísticas de performance.

**Ativação:**
```
CEMT SET MONITOR ON
```

#### Statistics Domain
Fornece estatísticas do sistema.

**Comandos:**
```
CEMT PERFORM STATISTICS RECORD
```

### Problemas Comuns de Performance

#### Contenção de Recursos
**Sintomas:**
- Tasks em wait
- Response time elevado

**Diagnóstico:**
```
CEMT INQ TASK
CEMT INQ ENQ
```

**Soluções:**
- Implementar técnicas de locking otimizadas
- Usar VSAM RLS (Record Level Sharing)
- Revisar sequência de acesso a recursos

#### Storage Shortage
**Sintomas:**
- SOS (Short on Storage) conditions
- Abends relacionados a storage

**Diagnóstico:**
```
CEMT INQ DSAS
CEMT INQ EDSA
```

**Soluções:**
- Aumentar DSA sizes no SIT
- Implementar storage protection
- Revisar aplicações com memory leaks

#### Problemas de DB2
**Sintomas:**
- Timeouts em SQL
- Deadlocks frequentes

**Diagnóstico:**
- Analisar DB2 thread status
- Verificar DSNC transaction

**Soluções:**
- Otimizar queries SQL
- Ajustar DB2CONN parameters
- Implementar commit frequency adequado

## 8. Debugging de Programas CICS

### Técnicas de Debugging

#### Usando CEDF
1. Ativar CEDF para terminal: `CEDF ON`
2. Executar transação
3. Analisar comandos CICS interceptados
4. Verificar COMMAREA e EIB

#### Usando Displays/Writes
```cobol
EXEC CICS SEND TEXT
    FROM(debug-message)
    LENGTH(message-length)
    ERASE
END-EXEC
```

#### Usando CICS Trace
```cobol
EXEC CICS ENTER
    TRACEID(nn)
    FROM(trace-data)
    RESOURCE(resource-name)
END-EXEC
```

### Análise de EIB (Execute Interface Block)

Campos importantes do EIB:
- **EIBCALEN**: Comprimento da COMMAREA
- **EIBRESP**: Código de resposta do último comando
- **EIBRESP2**: Código de resposta adicional
- **EIBFN**: Código da função executada
- **EIBRCODE**: Código de retorno

### Handle Conditions vs RESP
**Handle Condition (método tradicional):**
```cobol
EXEC CICS HANDLE CONDITION
    NOTFND(not-found-routine)
    DUPREC(duplicate-routine)
END-EXEC
```

**RESP (método recomendado):**
```cobol
EXEC CICS READ
    FILE(filename)
    INTO(record)
    RIDFLD(key)
    RESP(ws-resp)
END-EXEC

EVALUATE ws-resp
    WHEN DFHRESP(NORMAL)
        PERFORM process-record
    WHEN DFHRESP(NOTFND)
        PERFORM record-not-found
    WHEN OTHER
        PERFORM error-routine
END-EVALUATE
```

## 9. Problemas de Conectividade

### ISC (Intersystem Communication)
**Problemas Comuns:**
- Connection out of service
- Session allocation failures

**Diagnóstico:**
```
CEMT INQ CONNECTION(connid)
CEMT INQ SESSIONS(connid)
```

**Soluções:**
```
CEMT SET CONNECTION(connid) INSERVICE
CEMT SET CONNECTION(connid) ACQUIRED
```

### MRO (Multi-Region Operation)
**Problemas Comuns:**
- SYSIDERR - System ID error
- Transaction routing failures

**Diagnóstico:**
- Verificar definições de CONNECTION
- Validar SYSIDNT parameters

### TCP/IP Connectivity
**Problemas Comuns:**
- TCPIPSERVICE não ativo
- Porta já em uso

**Diagnóstico:**
```
CEMT INQ TCPIPSERVICE
```

**Soluções:**
```
CEMT SET TCPIPSERVICE(name) OPEN
```

## 10. Melhores Práticas

### Desenvolvimento

#### Gestão de Erros
1. **Sempre verificar RESP codes**
   - Não assumir sucesso em operações
   - Implementar tratamento específico para cada erro

2. **Usar RESP em vez de HANDLE CONDITION**
   - Mais eficiente e estruturado
   - Facilita manutenção

3. **Implementar logging adequado**
   - Registar erros em TD queues ou logs
   - Incluir informação contextual

#### Gestão de Recursos
1. **Libertar recursos explicitamente**
   ```cobol
   EXEC CICS UNLOCK
       FILE(filename)
   END-EXEC
   ```

2. **Usar ENQ/DEQ para serialização**
   ```cobol
   EXEC CICS ENQ
       RESOURCE(resource-name)
       LENGTH(resource-length)
   END-EXEC
   ```

3. **Implementar timeouts apropriados**
   ```cobol
   EXEC CICS START
       TRANSID(tranid)
       INTERVAL(hhmmss)
   END-EXEC
   ```

### Monitorização

#### Implementar Health Checks
1. Criar transações de monitoring
2. Verificar disponibilidade de recursos críticos
3. Alertar para condições anormais

#### Usar Statistics e Monitoring
1. Coletar métricas regularmente
2. Estabelecer baselines de performance
3. Identificar trends e anomalias

### Segurança

#### Princípios de Segurança
1. **Principle of Least Privilege**
   - Conceder apenas permissões necessárias
   - Usar RESSEC=YES para recursos sensíveis

2. **Audit Trail**
   - Ativar auditoria para transações críticas
   - Manter logs de acesso

3. **Validação de Input**
   - Validar todos os dados de entrada
   - Prevenir injection attacks

### Manutenção

#### Gestão de Mudanças
1. **Usar NEWCOPY com cuidado**
   - Verificar tasks ativas antes
   - Considerar PHASEIN para mudanças graduais

2. **Backup de definições**
   - Exportar CSD regularmente
   - Documentar configurações customizadas

3. **Testes em ambiente isolado**
   - Usar região de teste dedicada
   - Simular carga de produção

#### Documentação
1. **Manter documentação atualizada**
   - Fluxos de transações
   - Dependências entre programas
   - Configurações especiais

2. **Documentar problemas conhecidos**
   - Criar knowledge base
   - Registar soluções aplicadas

## Anexos

### A. Códigos RESP Comuns

| Código | Constante | Descrição |
|--------|-----------|-----------|
| 00 | DFHRESP(NORMAL) | Operação bem-sucedida |
| 01 | DFHRESP(ERROR) | Erro não especificado |
| 12 | DFHRESP(FILENOTFOUND) | Ficheiro não encontrado |
| 13 | DFHRESP(NOTFND) | Registro não encontrado |
| 14 | DFHRESP(DUPREC) | Registro duplicado |
| 15 | DFHRESP(DUPKEY) | Chave duplicada |
| 16 | DFHRESP(INVREQ) | Pedido inválido |
| 17 | DFHRESP(IOERR) | Erro de I/O |
| 18 | DFHRESP(NOSPACE) | Sem espaço disponível |
| 19 | DFHRESP(NOTOPEN) | Recurso não aberto |
| 20 | DFHRESP(ENDFILE) | Fim de ficheiro |
| 21 | DFHRESP(ILLOGIC) | Erro de lógica VSAM |
| 22 | DFHRESP(LENGERR) | Erro de comprimento |

### B. Comandos CEMT Frequentes

#### Gestão de Transações
```
CEMT INQ TRANSACTION(*)         - Listar todas as transações
CEMT SET TRANSACTION(xxxx) DISABLED - Desabilitar transação
CEMT SET TRANSACTION(xxxx) ENABLED  - Habilitar transação
CEMT SET TRANSACTION(xxxx) PURGE    - Purgar transação
```

#### Gestão de Programas
```
CEMT INQ PROGRAM(*)              - Listar todos os programas
CEMT SET PROGRAM(xxxx) NEWCOPY   - Carregar nova cópia
CEMT SET PROGRAM(xxxx) PHASEIN   - Phase in nova cópia
CEMT SET PROGRAM(xxxx) DISABLED  - Desabilitar programa
```

#### Gestão de Ficheiros
```
CEMT INQ FILE(*)                 - Listar todos os ficheiros
CEMT SET FILE(xxxx) OPEN         - Abrir ficheiro
CEMT SET FILE(xxxx) CLOSED       - Fechar ficheiro
CEMT SET FILE(xxxx) DISABLED     - Desabilitar ficheiro
```

#### Gestão de Sistema
```
CEMT INQ SYSTEM                  - Status do sistema
CEMT PERFORM SHUTDOWN            - Shutdown do CICS
CEMT PERFORM STATISTICS          - Coletar estatísticas
CEMT SET DUMP OPEN               - Abrir dump dataset
```

### C. Mensagens de Erro Frequentes

#### DFH0001 - DFH0099 (Sistema)
- **DFH0001I**: CICS initialization complete
- **DFH0002E**: CICS abnormal termination
- **DFH0003W**: Storage shortage warning

#### DFH2200 - DFH2299 (File Control)
- **DFH2201E**: File not found in FCT
- **DFH2206I**: File opened successfully
- **DFH2208E**: File open failed

#### DFH3500 - DFH3599 (Terminal Control)
- **DFH3501I**: Terminal attached
- **DFH3502I**: Terminal detached
- **DFH3506E**: Terminal I/O error

### D. Scripts Úteis

#### Script para Verificação de Saúde do CICS
```rexx
/* REXX - CICS Health Check */
ADDRESS CICS
'EXEC CICS INQUIRE SYSTEM CICSSTATUS(status)'
Say 'CICS Status:' status

'EXEC CICS INQUIRE STATISTICS LASTRESET(lastreset)'
Say 'Last Statistics Reset:' lastreset

/* Check critical files */
files = 'CUSTOMER ORDERS INVENTORY'
Do i = 1 to Words(files)
  file = Word(files,i)
  'EXEC CICS INQUIRE FILE('file') OPENSTATUS(status)'
  Say 'File' file 'status:' status
End
```

#### Procedimento para Análise de Dump
```jcl
//DUMPANL  JOB  (ACCT),'CICS DUMP ANALYSIS'
//STEP01   EXEC PGM=DFHDU670
//STEPLIB  DD   DISP=SHR,DSN=CICSTS.CICS.SDFHLOAD
//DFHDMPA  DD   DISP=SHR,DSN=CICS.DUMP.DATASET
//DFHDMPB  DD   DISP=SHR,DSN=CICS.DUMPB.DATASET
//SYSDUMP  DD   SYSOUT=*
//SYSPRINT DD   SYSOUT=*
//SYSIN    DD   *
  SELECT TRANSACTION=xxxx
  PRINT SUMMARY
  PRINT TRACE
  PRINT KERNEL
/*
```

## Conclusão

Este manual fornece uma base sólida para troubleshooting em CICS. A experiência prática e o conhecimento contínuo das especificidades do seu ambiente são fundamentais para resolver problemas complexos eficientemente.

### Recursos Adicionais
- **IBM Knowledge Center**: Documentação oficial CICS
- **CICS-L Listserv**: Comunidade de profissionais CICS
- **IBM Redbooks**: Guias técnicos detalhados
- **SHARE User Group**: Conferências e recursos

### Contatos Importantes
- Suporte IBM: Manter contrato de suporte atualizado
- Equipa de Sistema: Coordenar com administradores z/OS
- DBA Team: Para questões relacionadas com DB2/IMS

---
*Versão 1.0 - Manual de Troubleshooting CICS*
*Última atualização: 2025*