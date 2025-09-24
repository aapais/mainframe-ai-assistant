# Padrões de Desenvolvimento COBOL - Guia Completo

## Índice
1. [Introdução](#introdução)
2. [Convenções de Nomenclatura](#convenções-de-nomenclatura)
3. [Estrutura de Programas](#estrutura-de-programas)
4. [Padrões de Codificação](#padrões-de-codificação)
5. [Tratamento de Erros](#tratamento-de-erros)
6. [Performance e Otimização](#performance-e-otimização)
7. [Documentação](#documentação)
8. [Testes e Validação](#testes-e-validação)
9. [Manutenção e Versionamento](#manutenção-e-versionamento)
10. [Exemplos Práticos](#exemplos-práticos)

---

## 1. Introdução

### 1.1 Objetivo
Este documento estabelece os padrões e diretrizes para desenvolvimento de programas COBOL, visando garantir consistência, manutenibilidade e qualidade do código em toda a organização.

### 1.2 Escopo
Aplicável a todos os desenvolvedores COBOL, incluindo:
- Novos desenvolvimentos
- Manutenção de sistemas legados
- Integração com sistemas modernos
- Programas batch e online (CICS)

### 1.3 Benefícios
- Padronização do código
- Facilita manutenção e debugging
- Reduz tempo de desenvolvimento
- Melhora a documentação
- Aumenta a produtividade da equipe

---

## 2. Convenções de Nomenclatura

### 2.1 Nomes de Programas

#### Estrutura: AABBCCCD
- **AA**: Sistema (2 caracteres)
- **BB**: Módulo (2 caracteres)
- **CCC**: Função (3 caracteres)
- **D**: Tipo de programa (1 caractere)

#### Tipos de Programa:
- **B**: Batch
- **O**: Online
- **S**: Subrotina
- **C**: Copy
- **M**: Map (BMS)

**Exemplos:**
```
FIGL001B - Sistema Financeiro, Módulo GL, Função 001, Batch
RHFO002O - Sistema RH, Módulo Folha, Função 002, Online
UTCV001S - Utilitário, Conversão, Função 001, Subrotina
```

### 2.2 Variáveis e Campos

#### Working-Storage Section
```cobol
01  WS-VARIAVEIS-TRABALHO.
    05  WS-CONTADORES.
        10  WS-CONT-REGISTROS      PIC 9(09) VALUE ZEROS.
        10  WS-CONT-ERROS          PIC 9(09) VALUE ZEROS.
    05  WS-INDICADORES.
        10  WS-FIM-ARQUIVO         PIC X(01) VALUE 'N'.
            88  FIM-ARQUIVO         VALUE 'S'.
            88  NAO-FIM-ARQUIVO     VALUE 'N'.
    05  WS-AREAS-TRABALHO.
        10  WS-DATA-SISTEMA         PIC X(10).
        10  WS-HORA-SISTEMA         PIC X(08).
```

#### Linkage Section
```cobol
01  LK-PARAMETROS.
    05  LK-CODIGO-RETORNO          PIC S9(04) COMP.
    05  LK-MENSAGEM-ERRO           PIC X(80).
    05  LK-DADOS-ENTRADA.
        10  LK-CODIGO-CLIENTE       PIC 9(10).
        10  LK-TIPO-PROCESSAMENTO   PIC X(01).
```

### 2.3 Parágrafos e Seções

#### Formato: NNNN-VERBO-DESCRICAO
```cobol
0000-PRINCIPAL.
1000-INICIALIZAR.
2000-PROCESSAR-ARQUIVO.
3000-FINALIZAR.
9000-TRATAR-ERRO.
9999-ROTINA-ERRO-GERAL.
```

### 2.4 Copybooks

#### Estrutura: TTMMFFF
- **TT**: Tipo (2 caracteres)
- **MM**: Módulo (2 caracteres)  
- **FFF**: Função (3 caracteres)

**Tipos:**
- **WS**: Working-Storage
- **FD**: File Description
- **LK**: Linkage
- **PR**: Procedure

**Exemplo:**
```cobol
COPY WSGL001.  *> Working-Storage do GL função 001
COPY FDCL002.  *> File Description Cliente função 002
COPY LKRH003.  *> Linkage RH função 003
```

---

## 3. Estrutura de Programas

### 3.1 Estrutura Padrão

```cobol
      ******************************************************************
      * PROGRAMA: SSMMFFFP
      * AUTOR   : Nome do Desenvolvedor
      * DATA    : DD/MM/AAAA
      * OBJETIVO: Descrição clara do objetivo do programa
      ******************************************************************
       IDENTIFICATION DIVISION.
       PROGRAM-ID. SSMMFFFP.
       AUTHOR. NOME-DESENVOLVEDOR.
       DATE-WRITTEN. DD/MM/AAAA.
       DATE-COMPILED.
      *
      ******************************************************************
      * HISTORICO DE MANUTENCAO
      * DATA       AUTOR          DESCRICAO
      * ---------- -------------- -------------------------------------
      * DD/MM/AAAA Nome           Descricao da alteracao
      ******************************************************************
      *
       ENVIRONMENT DIVISION.
       CONFIGURATION SECTION.
       SOURCE-COMPUTER. IBM-ZOS.
       OBJECT-COMPUTER. IBM-ZOS.
       SPECIAL-NAMES.
           DECIMAL-POINT IS COMMA.
      *
       INPUT-OUTPUT SECTION.
       FILE-CONTROL.
      *    Definições de arquivos
      *
       DATA DIVISION.
       FILE SECTION.
      *    Descrição de arquivos
      *
       WORKING-STORAGE SECTION.
      *
      * --- CONSTANTES DO PROGRAMA ---
       01  WS-CONSTANTES.
           05  WS-PROGRAMA             PIC X(08) VALUE 'SSMMFFFP'.
           05  WS-VERSAO               PIC X(08) VALUE '01.00.00'.
      *
      * --- AREAS DE TRABALHO ---
       COPY WSMMFFF.
      *
      * --- DEFINICAO DE ARQUIVOS ---
       COPY FDMMFFF.
      *
       LINKAGE SECTION.
       COPY LKMMFFF.
      *
       PROCEDURE DIVISION.
      *
      ******************************************************************
      * PARAGRAFO PRINCIPAL - CONTROLA O FLUXO DO PROGRAMA
      ******************************************************************
       0000-PRINCIPAL SECTION.
      *
           PERFORM 1000-INICIALIZAR
      *
           PERFORM 2000-PROCESSAR
                   UNTIL WS-FIM-PROCESSAMENTO
      *
           PERFORM 3000-FINALIZAR
      *
           STOP RUN
           .
      *
      ******************************************************************
      * INICIALIZACAO DO PROGRAMA
      ******************************************************************
       1000-INICIALIZAR SECTION.
      *
           INITIALIZE WS-AREAS-TRABALHO
                      WS-CONTADORES
      *
           PERFORM 1100-ABRIR-ARQUIVOS
      *
           PERFORM 1200-OBTER-DATA-HORA
           .
      *
      ******************************************************************
      * PROCESSAMENTO PRINCIPAL
      ******************************************************************
       2000-PROCESSAR SECTION.
      *
           PERFORM 2100-LER-ARQUIVO
      *
           IF NOT FIM-ARQUIVO
              PERFORM 2200-VALIDAR-DADOS
              IF WS-DADOS-VALIDOS
                 PERFORM 2300-PROCESSAR-REGISTRO
              ELSE
                 PERFORM 9000-TRATAR-ERRO
              END-IF
           END-IF
           .
      *
      ******************************************************************
      * FINALIZACAO DO PROGRAMA
      ******************************************************************
       3000-FINALIZAR SECTION.
      *
           PERFORM 3100-FECHAR-ARQUIVOS
      *
           PERFORM 3200-EXIBIR-ESTATISTICAS
           .
```

### 3.2 Organização de Seções

#### Ordem Recomendada:
1. **0000-PRINCIPAL**: Controle principal do fluxo
2. **1000-INICIALIZAR**: Inicialização de variáveis e abertura de arquivos
3. **2000-PROCESSAR**: Lógica principal de negócio
4. **3000-FINALIZAR**: Fechamento de arquivos e estatísticas
5. **9000-9999**: Tratamento de erros e rotinas auxiliares

---

## 4. Padrões de Codificação

### 4.1 Formatação e Indentação

#### Colunas COBOL:
```cobol
      * Coluna 1-6  : Numeração de linha (opcional)
      * Coluna 7    : Indicador (* para comentário, - para continuação)
      * Coluna 8-11 : Área A (divisões, seções, parágrafos, 01)
      * Coluna 12-72: Área B (comandos, continuação de comandos)
      * Coluna 73-80: Identificação (opcional)
```

#### Indentação:
```cobol
       IF WS-CODIGO-RETORNO = ZEROS
          PERFORM 2100-PROCESSAR-SUCESSO
          ADD 1 TO WS-CONT-SUCESSO
       ELSE
          IF WS-CODIGO-RETORNO = 4
             PERFORM 2200-PROCESSAR-AVISO
             ADD 1 TO WS-CONT-AVISOS
          ELSE
             PERFORM 9000-TRATAR-ERRO
             ADD 1 TO WS-CONT-ERROS
          END-IF
       END-IF
```

### 4.2 Comandos e Estruturas

#### EVALUATE (preferível a IF aninhados):
```cobol
       EVALUATE WS-TIPO-MOVIMENTO
           WHEN 'D'
               PERFORM 2100-PROCESSAR-DEBITO
           WHEN 'C'
               PERFORM 2200-PROCESSAR-CREDITO
           WHEN 'T'
               PERFORM 2300-PROCESSAR-TRANSFERENCIA
           WHEN OTHER
               MOVE 'TIPO DE MOVIMENTO INVALIDO' TO WS-MENSAGEM-ERRO
               PERFORM 9000-TRATAR-ERRO
       END-EVALUATE
```

#### PERFORM com TEST:
```cobol
      * Use WITH TEST AFTER para garantir execução mínima
       PERFORM WITH TEST AFTER
               VARYING WS-INDICE FROM 1 BY 1
               UNTIL WS-INDICE > WS-LIMITE
           
           PERFORM 2100-PROCESSAR-ITEM
           
       END-PERFORM
```

#### Tratamento de Arquivos:
```cobol
       READ ARQUIVO-ENTRADA
           AT END
               SET FIM-ARQUIVO TO TRUE
           NOT AT END
               ADD 1 TO WS-CONT-LIDOS
               PERFORM 2100-PROCESSAR-REGISTRO
       END-READ
```

### 4.3 Declaração de Variáveis

#### Agrupamento Lógico:
```cobol
       01  WS-AREAS-ARQUIVO.
           05  WS-STATUS-ARQUIVO.
               10  WS-FS-ENTRADA       PIC X(02).
                   88  ENTRADA-OK      VALUE '00'.
                   88  ENTRADA-EOF     VALUE '10'.
               10  WS-FS-SAIDA         PIC X(02).
                   88  SAIDA-OK        VALUE '00'.
           
           05  WS-CONTADORES-ARQUIVO.
               10  WS-LIDOS            PIC 9(09) COMP-3 VALUE ZEROS.
               10  WS-GRAVADOS         PIC 9(09) COMP-3 VALUE ZEROS.
               10  WS-REJEITADOS       PIC 9(09) COMP-3 VALUE ZEROS.
```

#### Uso de 88 Levels:
```cobol
       01  WS-CODIGO-RETORNO           PIC S9(04) COMP.
           88  PROCESSAMENTO-OK        VALUE ZERO.
           88  AVISO-PROCESSAMENTO     VALUE +0004.
           88  ERRO-PROCESSAMENTO      VALUE +0008.
           88  ERRO-GRAVE              VALUE +0012 +0016 +0020.
```

### 4.4 Uso de COPY

#### Estrutura de COPY:
```cobol
      ******************************************************************
      * COPY: WSGL001
      * DESCRICAO: AREAS DE TRABALHO - MODULO GENERAL LEDGER
      ******************************************************************
       01  WS-AREAS-GL.
           05  WS-CONTA-CONTABIL.
               10  WS-EMPRESA          PIC 9(04).
               10  WS-FILIAL           PIC 9(04).
               10  WS-CONTA            PIC 9(10).
               10  WS-SUBCONTA         PIC 9(04).
```

#### Utilização:
```cobol
       WORKING-STORAGE SECTION.
      *
      * COPY DE AREAS COMUNS
           COPY WSCOMUM.
      *
      * COPY ESPECIFICO DO MODULO
           COPY WSGL001 REPLACING ==:PRF:== BY ==WS==.
```

---

## 5. Tratamento de Erros

### 5.1 Estrutura de Tratamento

```cobol
      ******************************************************************
      * TRATAMENTO PADRAO DE ERROS
      ******************************************************************
       9000-TRATAR-ERRO SECTION.
      *
           ADD 1 TO WS-CONT-ERROS
      *
           MOVE WS-PROGRAMA TO ERR-PROGRAMA
           MOVE WS-PARAGRAFO TO ERR-PARAGRAFO
           
           EVALUATE TRUE
               WHEN ERRO-ARQUIVO
                   PERFORM 9100-ERRO-ARQUIVO
               WHEN ERRO-VALIDACAO
                   PERFORM 9200-ERRO-VALIDACAO
               WHEN ERRO-CALCULO
                   PERFORM 9300-ERRO-CALCULO
               WHEN OTHER
                   PERFORM 9900-ERRO-GERAL
           END-EVALUATE
      *
           IF WS-CONT-ERROS > WS-LIMITE-ERROS
              DISPLAY 'LIMITE DE ERROS EXCEDIDO'
              PERFORM 3000-FINALIZAR
              MOVE 16 TO RETURN-CODE
              STOP RUN
           END-IF
           .
```

### 5.2 Códigos de Retorno

| Código | Significado | Ação |
|--------|------------|------|
| 0 | Sucesso | Continuar processamento |
| 4 | Aviso | Registrar e continuar |
| 8 | Erro | Tratar e tentar recuperar |
| 12 | Erro Grave | Finalizar com erro |
| 16 | Erro Fatal | Abortar imediatamente |

### 5.3 Log de Erros

```cobol
       9100-GRAVAR-LOG-ERRO SECTION.
      *
           INITIALIZE REG-LOG-ERRO
      *
           MOVE WS-PROGRAMA        TO LOG-PROGRAMA
           MOVE WS-DATA-SISTEMA    TO LOG-DATA
           MOVE WS-HORA-SISTEMA    TO LOG-HORA
           MOVE WS-CODIGO-ERRO     TO LOG-CODIGO-ERRO
           MOVE WS-MENSAGEM-ERRO   TO LOG-MENSAGEM
           MOVE WS-PARAGRAFO       TO LOG-PARAGRAFO
           MOVE WS-REGISTRO-ATUAL  TO LOG-REGISTRO
      *
           WRITE REG-LOG-ERRO
      *
           IF NOT LOG-GRAVACAO-OK
              DISPLAY 'ERRO GRAVANDO LOG: ' WS-FS-LOG
              PERFORM 9999-ABORTAR
           END-IF
           .
```

---

## 6. Performance e Otimização

### 6.1 Diretrizes de Performance

#### Uso Eficiente de Memória:
```cobol
      * EVITAR: Variáveis grandes desnecessárias
       01  WS-TABELA-GRANDE.
           05  WS-ITEM OCCURS 10000 TIMES.
               10  WS-CAMPO-1      PIC X(100).
               10  WS-CAMPO-2      PIC X(200).
      
      * PREFERIR: Dimensionamento adequado
       01  WS-TABELA-OTIMIZADA.
           05  WS-ITEM OCCURS 1000 TIMES
                       DEPENDING ON WS-QTDE-ITENS.
               10  WS-CAMPO-1      PIC X(30).
               10  WS-CAMPO-2      PIC X(50).
```

#### Otimização de Loops:
```cobol
      * EVITAR: Loops desnecessários
       PERFORM VARYING WS-I FROM 1 BY 1
               UNTIL WS-I > 1000
           PERFORM VARYING WS-J FROM 1 BY 1
                   UNTIL WS-J > 1000
               PERFORM 2100-PROCESSAR
           END-PERFORM
       END-PERFORM
      
      * PREFERIR: Minimizar iterações
       PERFORM VARYING WS-I FROM 1 BY 1
               UNTIL WS-I > WS-LIMITE-REAL
           IF WS-ITEM(WS-I) NOT = SPACES
              PERFORM 2100-PROCESSAR-ITEM
           END-IF
       END-PERFORM
```

### 6.2 Acesso a Banco de Dados

#### Batch Processing:
```cobol
      * Usar COMMIT periodicamente
       ADD 1 TO WS-CONT-PROCESSADOS
      *
       IF WS-CONT-PROCESSADOS = WS-COMMIT-FREQUENCY
          EXEC SQL
               COMMIT WORK
          END-EXEC
          MOVE ZEROS TO WS-CONT-PROCESSADOS
       END-IF
```

#### Otimização SQL:
```cobol
      * EVITAR: SELECT sem WHERE
       EXEC SQL
           SELECT * FROM TABELA
       END-EXEC
      
      * PREFERIR: Critérios específicos e campos necessários
       EXEC SQL
           SELECT CAMPO1, CAMPO2, CAMPO3
           INTO :WS-CAMPO1, :WS-CAMPO2, :WS-CAMPO3
           FROM TABELA
           WHERE CHAVE = :WS-CHAVE
             AND STATUS = 'A'
       END-EXEC
```

### 6.3 I/O Otimizado

```cobol
      * Usar buffers apropriados
       SELECT ARQUIVO-ENTRADA
              ASSIGN TO DD-ENTRADA
              ORGANIZATION IS SEQUENTIAL
              ACCESS MODE IS SEQUENTIAL
              FILE STATUS IS WS-FS-ENTRADA
              RESERVE 10 AREAS.
      
      * Bloco de registros para melhor performance
       FD  ARQUIVO-ENTRADA
           RECORDING MODE IS F
           BLOCK CONTAINS 0 RECORDS
           RECORD CONTAINS 250 CHARACTERS.
```

---

## 7. Documentação

### 7.1 Cabeçalho de Programa

```cobol
      ******************************************************************
      * SISTEMA    : NOME DO SISTEMA
      * PROGRAMA   : SSMMFFFP
      * AUTOR      : Nome Completo do Desenvolvedor
      * DATA       : DD/MM/AAAA
      * OBJETIVO   : Descrição detalhada do objetivo do programa
      * 
      * ARQUIVOS:
      *   ENTRADA  : DD-ENTRADA  - Descrição do arquivo de entrada
      *   SAIDA    : DD-SAIDA    - Descrição do arquivo de saída
      *   
      * TABELAS DB2:
      *   TABELA1  : Descrição e uso da tabela
      *   TABELA2  : Descrição e uso da tabela
      *
      * PROGRAMAS CHAMADOS:
      *   PROGRAMA1: Descrição da funcionalidade
      *   PROGRAMA2: Descrição da funcionalidade
      *
      * OBSERVACOES:
      *   - Observação importante 1
      *   - Observação importante 2
      ******************************************************************
```

### 7.2 Documentação Inline

```cobol
      ******************************************************************
      * CALCULO DO DIGITO VERIFICADOR - MODULO 11
      * ENTRADA: WS-NUMERO-CONTA
      * SAIDA  : WS-DIGITO-VERIFICADOR
      * FORMULA: DV = 11 - (SOMA DOS PRODUTOS % 11)
      ******************************************************************
       2100-CALCULAR-DV SECTION.
      *
      * Inicializar variáveis de cálculo
           MOVE ZEROS TO WS-SOMA
           MOVE 2     TO WS-MULTIPLICADOR
      *
      * Processar cada dígito da direita para esquerda
           PERFORM VARYING WS-POSICAO FROM LENGTH OF WS-NUMERO-CONTA
                                       BY -1
                   UNTIL WS-POSICAO < 1
      *        
      *        Multiplicar dígito pelo peso
               COMPUTE WS-PRODUTO = WS-NUMERO-CONTA(WS-POSICAO:1) 
                                  * WS-MULTIPLICADOR
      *
      *        Acumular soma
               ADD WS-PRODUTO TO WS-SOMA
      *
      *        Incrementar multiplicador (máximo 9)
               ADD 1 TO WS-MULTIPLICADOR
               IF WS-MULTIPLICADOR > 9
                  MOVE 2 TO WS-MULTIPLICADOR
               END-IF
           END-PERFORM
      *
      * Calcular dígito verificador
           COMPUTE WS-RESTO = FUNCTION MOD(WS-SOMA, 11)
           COMPUTE WS-DIGITO-VERIFICADOR = 11 - WS-RESTO
      *
      * Ajustar casos especiais
           IF WS-DIGITO-VERIFICADOR = 10 OR 11
              MOVE ZERO TO WS-DIGITO-VERIFICADOR
           END-IF
           .
```

### 7.3 Documentação de Manutenção

```cobol
      ******************************************************************
      * HISTORICO DE MANUTENCAO
      * ------------------------
      * DATA       AUTOR          CHAMADO  DESCRICAO
      * ---------- -------------- -------- ----------------------------
      * 15/01/2024 João Silva     CHM001   Implementação inicial
      * 22/02/2024 Maria Santos   CHM023   Correção cálculo de juros
      * 10/03/2024 Pedro Costa    CHM045   Inclusão validação CPF/CNPJ
      * 05/04/2024 Ana Lima       INC001   Novo campo data nascimento
      ******************************************************************
```

---

## 8. Testes e Validação

### 8.1 Estrutura de Testes

```cobol
      ******************************************************************
      * PROGRAMA DE TESTE UNITARIO
      ******************************************************************
       IDENTIFICATION DIVISION.
       PROGRAM-ID. TESTSSMMFFFP.
      *
       DATA DIVISION.
       WORKING-STORAGE SECTION.
      *
       01  WS-CASOS-TESTE.
           05  WS-TESTE-01.
               10  WS-ENTRADA-01       PIC X(50) VALUE 'DADOS ENTRADA'.
               10  WS-ESPERADO-01      PIC X(50) VALUE 'RESULTADO'.
           05  WS-TESTE-02.
               10  WS-ENTRADA-02       PIC X(50) VALUE 'DADOS ENTRADA'.
               10  WS-ESPERADO-02      PIC X(50) VALUE 'RESULTADO'.
      *
       01  WS-RESULTADO-TESTES.
           05  WS-TOTAL-TESTES         PIC 9(03) VALUE ZEROS.
           05  WS-TESTES-OK            PIC 9(03) VALUE ZEROS.
           05  WS-TESTES-ERRO          PIC 9(03) VALUE ZEROS.
      *
       PROCEDURE DIVISION.
      *
       0000-PRINCIPAL.
           PERFORM 1000-TESTE-CALCULO
           PERFORM 2000-TESTE-VALIDACAO
           PERFORM 3000-TESTE-FORMATACAO
           PERFORM 9000-EXIBIR-RESULTADO
           STOP RUN
           .
```

### 8.2 Validações Padrão

```cobol
      ******************************************************************
      * ROTINAS DE VALIDACAO
      ******************************************************************
       2000-VALIDAR-DADOS SECTION.
      *
           SET DADOS-VALIDOS TO TRUE
      *
      * Validar campos obrigatórios
           IF WS-CODIGO-CLIENTE = ZEROS OR SPACES
              MOVE 'CODIGO CLIENTE OBRIGATORIO' TO WS-MENSAGEM-ERRO
              SET DADOS-INVALIDOS TO TRUE
           END-IF
      *
      * Validar CPF/CNPJ
           IF DADOS-VALIDOS
              IF WS-TIPO-PESSOA = 'F'
                 PERFORM 2100-VALIDAR-CPF
              ELSE
                 IF WS-TIPO-PESSOA = 'J'
                    PERFORM 2200-VALIDAR-CNPJ
                 END-IF
              END-IF
           END-IF
      *
      * Validar datas
           IF DADOS-VALIDOS
              PERFORM 2300-VALIDAR-DATA
           END-IF
      *
      * Validar valores
           IF DADOS-VALIDOS
              IF WS-VALOR-OPERACAO NOT NUMERIC OR
                 WS-VALOR-OPERACAO <= ZEROS
                 MOVE 'VALOR INVALIDO' TO WS-MENSAGEM-ERRO
                 SET DADOS-INVALIDOS TO TRUE
              END-IF
           END-IF
           .
```

### 8.3 Checklist de Testes

#### Testes Obrigatórios:
- [ ] Processamento com arquivo vazio
- [ ] Processamento com 1 registro
- [ ] Processamento com volume normal
- [ ] Processamento com volume máximo
- [ ] Validação de campos obrigatórios
- [ ] Validação de tipos de dados
- [ ] Validação de ranges de valores
- [ ] Tratamento de erros de I/O
- [ ] Tratamento de erros de DB2
- [ ] Verificação de COMMIT/ROLLBACK
- [ ] Teste de restart/recovery
- [ ] Validação de totalizadores

---

## 9. Manutenção e Versionamento

### 9.1 Controle de Versão

#### Formato: VV.RR.PP
- **VV**: Versão maior (mudanças significativas)
- **RR**: Release (novas funcionalidades)
- **PP**: Patch (correções)

```cobol
       01  WS-VERSAO-PROGRAMA.
           05  WS-VERSAO               PIC X(08) VALUE '01.00.00'.
           05  WS-DATA-VERSAO          PIC X(10) VALUE '2024-01-15'.
           05  WS-DESCRICAO-VERSAO     PIC X(50) 
               VALUE 'VERSAO INICIAL - PRODUCAO'.
```

### 9.2 Processo de Manutenção

#### Antes da Manutenção:
1. Identificar e documentar o problema/requisito
2. Analisar impacto em outros programas
3. Fazer backup do código atual
4. Criar ambiente de teste isolado

#### Durante a Manutenção:
1. Atualizar histórico de manutenção
2. Comentar alterações complexas
3. Manter padrões estabelecidos
4. Não remover código antigo (comentar se necessário)

#### Após a Manutenção:
1. Executar testes unitários
2. Executar testes integrados
3. Atualizar documentação
4. Realizar code review

### 9.3 Boas Práticas de Manutenção

```cobol
      * INICIO ALTERACAO - CHM123 - 15/01/2024 - João Silva
      * Descrição: Incluída validação adicional para contas tipo 'X'
      *
           IF WS-TIPO-CONTA = 'X'
              PERFORM 2150-VALIDAR-CONTA-ESPECIAL
           END-IF
      *
      * FIM ALTERACAO - CHM123
      
      * CODIGO ANTIGO COMENTADO - CHM123 - 15/01/2024
      *    IF WS-TIPO-CONTA = 'A' OR 'B'
      *       PERFORM 2100-VALIDAR-CONTA-NORMAL
      *    END-IF
```

---

## 10. Exemplos Práticos

### 10.1 Programa Batch Completo

```cobol
      ******************************************************************
      * PROGRAMA: FIGL001B
      * OBJETIVO: PROCESSAR LANCAMENTOS CONTABEIS BATCH
      ******************************************************************
       IDENTIFICATION DIVISION.
       PROGRAM-ID. FIGL001B.
      *
       ENVIRONMENT DIVISION.
       INPUT-OUTPUT SECTION.
       FILE-CONTROL.
           SELECT ARQUIVO-ENTRADA ASSIGN TO ENTRADA
                  FILE STATUS IS WS-FS-ENTRADA.
           SELECT ARQUIVO-SAIDA ASSIGN TO SAIDA
                  FILE STATUS IS WS-FS-SAIDA.
           SELECT ARQUIVO-ERRO ASSIGN TO ERRO
                  FILE STATUS IS WS-FS-ERRO.
      *
       DATA DIVISION.
       FILE SECTION.
       FD  ARQUIVO-ENTRADA.
       01  REG-ENTRADA                 PIC X(250).
      *
       FD  ARQUIVO-SAIDA.
       01  REG-SAIDA                   PIC X(300).
      *
       FD  ARQUIVO-ERRO.
       01  REG-ERRO                    PIC X(350).
      *
       WORKING-STORAGE SECTION.
      *
       01  WS-AREAS-ARQUIVO.
           05  WS-FS-ENTRADA           PIC X(02).
               88  ENTRADA-OK          VALUE '00'.
               88  ENTRADA-EOF         VALUE '10'.
           05  WS-FS-SAIDA             PIC X(02).
               88  SAIDA-OK            VALUE '00'.
           05  WS-FS-ERRO              PIC X(02).
               88  ERRO-OK             VALUE '00'.
      *
       01  WS-REGISTRO-ENTRADA.
           05  WS-TIPO-REGISTRO        PIC X(02).
               88  HEADER              VALUE 'HD'.
               88  DETALHE             VALUE 'DT'.
               88  TRAILER             VALUE 'TR'.
           05  WS-DADOS-DETALHE.
               10  WS-CONTA-DEBITO     PIC 9(10).
               10  WS-CONTA-CREDITO    PIC 9(10).
               10  WS-VALOR            PIC 9(13)V99.
               10  WS-HISTORICO        PIC X(50).
               10  WS-DATA-LANCAMENTO  PIC X(10).
      *
       01  WS-CONTADORES.
           05  WS-CONT-LIDOS           PIC 9(09) VALUE ZEROS.
           05  WS-CONT-PROCESSADOS     PIC 9(09) VALUE ZEROS.
           05  WS-CONT-REJEITADOS      PIC 9(09) VALUE ZEROS.
      *
       01  WS-TOTALIZADORES.
           05  WS-TOTAL-DEBITOS        PIC 9(15)V99 VALUE ZEROS.
           05  WS-TOTAL-CREDITOS       PIC 9(15)V99 VALUE ZEROS.
      *
       PROCEDURE DIVISION.
      *
       0000-PRINCIPAL.
           PERFORM 1000-INICIALIZAR
           PERFORM 2000-PROCESSAR UNTIL ENTRADA-EOF
           PERFORM 3000-FINALIZAR
           STOP RUN
           .
      *
       1000-INICIALIZAR.
           OPEN INPUT  ARQUIVO-ENTRADA
                OUTPUT ARQUIVO-SAIDA
                       ARQUIVO-ERRO
           
           IF NOT ENTRADA-OK
              DISPLAY 'ERRO ABRINDO ENTRADA: ' WS-FS-ENTRADA
              MOVE 16 TO RETURN-CODE
              STOP RUN
           END-IF
           
           PERFORM 1100-LER-ENTRADA
           .
      *
       1100-LER-ENTRADA.
           READ ARQUIVO-ENTRADA INTO WS-REGISTRO-ENTRADA
           ADD 1 TO WS-CONT-LIDOS
           .
      *
       2000-PROCESSAR.
           EVALUATE TRUE
               WHEN HEADER
                   PERFORM 2100-PROCESSAR-HEADER
               WHEN DETALHE
                   PERFORM 2200-PROCESSAR-DETALHE
               WHEN TRAILER
                   PERFORM 2300-PROCESSAR-TRAILER
               WHEN OTHER
                   PERFORM 9000-REGISTRO-INVALIDO
           END-EVALUATE
           
           PERFORM 1100-LER-ENTRADA
           .
      *
       2200-PROCESSAR-DETALHE.
           PERFORM 2210-VALIDAR-LANCAMENTO
           
           IF WS-LANCAMENTO-VALIDO
              PERFORM 2220-GRAVAR-LANCAMENTO
              ADD WS-VALOR TO WS-TOTAL-DEBITOS
              ADD WS-VALOR TO WS-TOTAL-CREDITOS
              ADD 1 TO WS-CONT-PROCESSADOS
           ELSE
              PERFORM 2230-GRAVAR-ERRO
              ADD 1 TO WS-CONT-REJEITADOS
           END-IF
           .
      *
       3000-FINALIZAR.
           DISPLAY '================================'
           DISPLAY 'ESTATISTICAS DO PROCESSAMENTO:'
           DISPLAY '--------------------------------'
           DISPLAY 'REGISTROS LIDOS     : ' WS-CONT-LIDOS
           DISPLAY 'REGISTROS PROCESSADOS: ' WS-CONT-PROCESSADOS
           DISPLAY 'REGISTROS REJEITADOS: ' WS-CONT-REJEITADOS
           DISPLAY 'TOTAL DEBITOS       : ' WS-TOTAL-DEBITOS
           DISPLAY 'TOTAL CREDITOS      : ' WS-TOTAL-CREDITOS
           DISPLAY '================================'
           
           CLOSE ARQUIVO-ENTRADA
                 ARQUIVO-SAIDA
                 ARQUIVO-ERRO
           
           IF WS-CONT-REJEITADOS > 0
              MOVE 4 TO RETURN-CODE
           ELSE
              MOVE 0 TO RETURN-CODE
           END-IF
           .
```

### 10.2 Subrotina Reutilizável

```cobol
      ******************************************************************
      * PROGRAMA: UTCV001S
      * OBJETIVO: SUBROTINA VALIDACAO CPF/CNPJ
      ******************************************************************
       IDENTIFICATION DIVISION.
       PROGRAM-ID. UTCV001S.
      *
       DATA DIVISION.
       WORKING-STORAGE SECTION.
       01  WS-AREAS-CALCULO.
           05  WS-SOMA                 PIC 9(05).
           05  WS-RESTO                PIC 9(02).
           05  WS-DIGITO               PIC 9(02).
           05  WS-INDICE               PIC 9(02).
           05  WS-MULTIPLICADOR        PIC 9(02).
      *
       LINKAGE SECTION.
       01  LK-PARAMETROS.
           05  LK-TIPO-DOCUMENTO       PIC X(01).
               88  DOC-CPF             VALUE 'F'.
               88  DOC-CNPJ            VALUE 'J'.
           05  LK-NUMERO-DOCUMENTO     PIC X(14).
           05  LK-CODIGO-RETORNO       PIC S9(04) COMP.
               88  DOCUMENTO-VALIDO    VALUE ZERO.
               88  DOCUMENTO-INVALIDO  VALUE +8.
           05  LK-MENSAGEM             PIC X(80).
      *
       PROCEDURE DIVISION USING LK-PARAMETROS.
      *
       0000-PRINCIPAL.
           INITIALIZE LK-CODIGO-RETORNO LK-MENSAGEM
           
           EVALUATE TRUE
               WHEN DOC-CPF
                   PERFORM 1000-VALIDAR-CPF
               WHEN DOC-CNPJ
                   PERFORM 2000-VALIDAR-CNPJ
               WHEN OTHER
                   SET DOCUMENTO-INVALIDO TO TRUE
                   STRING 'TIPO DOCUMENTO INVALIDO: ' 
                          LK-TIPO-DOCUMENTO
                     INTO LK-MENSAGEM
           END-EVALUATE
           
           GOBACK
           .
      *
       1000-VALIDAR-CPF.
      * Implementação da validação de CPF
           IF LK-NUMERO-DOCUMENTO(1:11) NOT NUMERIC
              SET DOCUMENTO-INVALIDO TO TRUE
              MOVE 'CPF DEVE CONTER APENAS NUMEROS' TO LK-MENSAGEM
              EXIT PARAGRAPH
           END-IF
           
      * Verificar CPFs conhecidos como inválidos
           IF LK-NUMERO-DOCUMENTO(1:11) = '00000000000' OR
              LK-NUMERO-DOCUMENTO(1:11) = '11111111111' OR
              LK-NUMERO-DOCUMENTO(1:11) = '22222222222' OR
              LK-NUMERO-DOCUMENTO(1:11) = '33333333333' OR
              LK-NUMERO-DOCUMENTO(1:11) = '44444444444' OR
              LK-NUMERO-DOCUMENTO(1:11) = '55555555555' OR
              LK-NUMERO-DOCUMENTO(1:11) = '66666666666' OR
              LK-NUMERO-DOCUMENTO(1:11) = '77777777777' OR
              LK-NUMERO-DOCUMENTO(1:11) = '88888888888' OR
              LK-NUMERO-DOCUMENTO(1:11) = '99999999999'
              SET DOCUMENTO-INVALIDO TO TRUE
              MOVE 'CPF INVALIDO' TO LK-MENSAGEM
              EXIT PARAGRAPH
           END-IF
           
      * Calcular primeiro dígito verificador
           MOVE ZEROS TO WS-SOMA
           PERFORM VARYING WS-INDICE FROM 1 BY 1
                   UNTIL WS-INDICE > 9
               COMPUTE WS-MULTIPLICADOR = 11 - WS-INDICE
               COMPUTE WS-SOMA = WS-SOMA + 
                   (FUNCTION NUMVAL(LK-NUMERO-DOCUMENTO(WS-INDICE:1))
                    * WS-MULTIPLICADOR)
           END-PERFORM
           
           COMPUTE WS-RESTO = FUNCTION MOD(WS-SOMA, 11)
           IF WS-RESTO < 2
              MOVE 0 TO WS-DIGITO
           ELSE
              COMPUTE WS-DIGITO = 11 - WS-RESTO
           END-IF
           
           IF WS-DIGITO NOT = 
              FUNCTION NUMVAL(LK-NUMERO-DOCUMENTO(10:1))
              SET DOCUMENTO-INVALIDO TO TRUE
              MOVE 'CPF INVALIDO - DIGITO 1' TO LK-MENSAGEM
              EXIT PARAGRAPH
           END-IF
           
      * Calcular segundo dígito verificador
           MOVE ZEROS TO WS-SOMA
           PERFORM VARYING WS-INDICE FROM 1 BY 1
                   UNTIL WS-INDICE > 10
               COMPUTE WS-MULTIPLICADOR = 12 - WS-INDICE
               COMPUTE WS-SOMA = WS-SOMA + 
                   (FUNCTION NUMVAL(LK-NUMERO-DOCUMENTO(WS-INDICE:1))
                    * WS-MULTIPLICADOR)
           END-PERFORM
           
           COMPUTE WS-RESTO = FUNCTION MOD(WS-SOMA, 11)
           IF WS-RESTO < 2
              MOVE 0 TO WS-DIGITO
           ELSE
              COMPUTE WS-DIGITO = 11 - WS-RESTO
           END-IF
           
           IF WS-DIGITO NOT = 
              FUNCTION NUMVAL(LK-NUMERO-DOCUMENTO(11:1))
              SET DOCUMENTO-INVALIDO TO TRUE
              MOVE 'CPF INVALIDO - DIGITO 2' TO LK-MENSAGEM
           ELSE
              SET DOCUMENTO-VALIDO TO TRUE
              MOVE 'CPF VALIDO' TO LK-MENSAGEM
           END-IF
           .
      *
       2000-VALIDAR-CNPJ.
      * Implementação similar para CNPJ
           SET DOCUMENTO-VALIDO TO TRUE
           MOVE 'VALIDACAO CNPJ NAO IMPLEMENTADA' TO LK-MENSAGEM
           .
```

### 10.3 Programa CICS Online

```cobol
      ******************************************************************
      * PROGRAMA: RHFO001O
      * OBJETIVO: CONSULTA ONLINE DE FUNCIONARIOS
      ******************************************************************
       IDENTIFICATION DIVISION.
       PROGRAM-ID. RHFO001O.
      *
       DATA DIVISION.
       WORKING-STORAGE SECTION.
       01  WS-COMMAREA.
           05  WS-PROGRAMA             PIC X(08) VALUE 'RHFO001O'.
           05  WS-FUNCAO               PIC X(01).
               88  FUNCAO-CONSULTA     VALUE 'C'.
               88  FUNCAO-INCLUSAO     VALUE 'I'.
               88  FUNCAO-ALTERACAO    VALUE 'A'.
               88  FUNCAO-EXCLUSAO     VALUE 'E'.
           05  WS-MATRICULA            PIC 9(08).
           05  WS-NOME-FUNCIONARIO     PIC X(50).
           05  WS-DEPARTAMENTO         PIC X(30).
           05  WS-CARGO                PIC X(30).
           05  WS-SALARIO              PIC 9(07)V99.
           05  WS-MENSAGEM             PIC X(79).
      *
       01  WS-AREAS-CICS.
           05  WS-RESP                PIC S9(08) COMP.
           05  WS-RESP2               PIC S9(08) COMP.
           05  WS-LENGTH              PIC S9(04) COMP VALUE 300.
      *
           COPY DFHAID.
           COPY DFHBMSCA.
      *
       LINKAGE SECTION.
       01  DFHCOMMAREA                PIC X(300).
      *
       PROCEDURE DIVISION.
      *
       0000-PRINCIPAL.
           IF EIBCALEN = ZERO
              PERFORM 1000-PRIMEIRA-EXECUCAO
           ELSE
              MOVE DFHCOMMAREA TO WS-COMMAREA
              PERFORM 2000-PROCESSAR-FUNCAO
           END-IF
           
           EXEC CICS RETURN
                TRANSID('RH01')
                COMMAREA(WS-COMMAREA)
                LENGTH(WS-LENGTH)
           END-EXEC
           .
      *
       1000-PRIMEIRA-EXECUCAO.
           MOVE LOW-VALUES TO WS-COMMAREA
           MOVE 'INFORME MATRICULA E FUNCAO' TO WS-MENSAGEM
           PERFORM 9000-ENVIAR-MAPA
           .
      *
       2000-PROCESSAR-FUNCAO.
           EVALUATE TRUE
               WHEN FUNCAO-CONSULTA
                   PERFORM 2100-CONSULTAR-FUNCIONARIO
               WHEN FUNCAO-INCLUSAO
                   PERFORM 2200-INCLUIR-FUNCIONARIO
               WHEN FUNCAO-ALTERACAO
                   PERFORM 2300-ALTERAR-FUNCIONARIO
               WHEN FUNCAO-EXCLUSAO
                   PERFORM 2400-EXCLUIR-FUNCIONARIO
               WHEN OTHER
                   MOVE 'FUNCAO INVALIDA' TO WS-MENSAGEM
                   PERFORM 9000-ENVIAR-MAPA
           END-EVALUATE
           .
      *
       2100-CONSULTAR-FUNCIONARIO.
           EXEC SQL
               SELECT NOME, DEPARTAMENTO, CARGO, SALARIO
                 INTO :WS-NOME-FUNCIONARIO,
                      :WS-DEPARTAMENTO,
                      :WS-CARGO,
                      :WS-SALARIO
                 FROM FUNCIONARIOS
                WHERE MATRICULA = :WS-MATRICULA
           END-EXEC
           
           EVALUATE SQLCODE
               WHEN ZERO
                   MOVE 'CONSULTA REALIZADA COM SUCESSO' 
                     TO WS-MENSAGEM
                   PERFORM 9000-ENVIAR-MAPA
               WHEN +100
                   MOVE 'FUNCIONARIO NAO ENCONTRADO' 
                     TO WS-MENSAGEM
                   PERFORM 9000-ENVIAR-MAPA
               WHEN OTHER
                   STRING 'ERRO SQL: ' SQLCODE
                     INTO WS-MENSAGEM
                   PERFORM 9900-ERRO-SQL
           END-EVALUATE
           .
      *
       9000-ENVIAR-MAPA.
           EXEC CICS SEND
                MAP('MAPFUNC')
                MAPSET('RHFO001')
                FROM(WS-COMMAREA)
                ERASE
                FREEKB
           END-EXEC
           .
      *
       9900-ERRO-SQL.
           EXEC CICS SYNCPOINT ROLLBACK END-EXEC
           PERFORM 9000-ENVIAR-MAPA
           EXEC CICS RETURN END-EXEC
           .
```

---

## Conclusão

Este documento estabelece os padrões fundamentais para desenvolvimento COBOL em nossa organização. O cumprimento destas diretrizes garante:

- **Qualidade**: Código robusto e confiável
- **Manutenibilidade**: Facilita correções e evoluções
- **Padronização**: Uniformidade em toda a base de código
- **Produtividade**: Reduz tempo de desenvolvimento e manutenção
- **Documentação**: Facilita transferência de conhecimento

### Revisão e Atualização

Este documento deve ser revisado semestralmente e atualizado conforme necessário para refletir:
- Mudanças tecnológicas
- Lições aprendidas
- Melhores práticas emergentes
- Feedback da equipe de desenvolvimento

### Contato e Suporte

Para dúvidas, sugestões ou esclarecimentos sobre estes padrões:
- **Email**: arquitetura@empresa.com
- **Wiki**: http://wiki.empresa.com/cobol-standards
- **Fórum**: http://forum.empresa.com/cobol

---

**Versão do Documento**: 1.0.0  
**Data**: Janeiro 2024  
**Próxima Revisão**: Julho 2024  
**Aprovado por**: Arquitetura de Software