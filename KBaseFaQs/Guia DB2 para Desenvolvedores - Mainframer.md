# Guia DB2 para Desenvolvedores - Melhores Práticas e Procedimentos

## 1. Introdução ao DB2

### 1.1 O que é DB2?
DB2 é um Sistema de Gerenciamento de Banco de Dados Relacional (RDBMS) desenvolvido pela IBM, oferecendo suporte para SQL e NoSQL. É amplamente utilizado em ambientes corporativos para aplicações críticas que exigem alta disponibilidade, escalabilidade e performance.

### 1.2 Versões e Edições
- **DB2 for z/OS**: Para mainframes IBM
- **DB2 for LUW** (Linux, Unix, Windows): Multiplataforma
- **DB2 for i**: Para IBM i (AS/400)
- **Db2 on Cloud**: Versão em nuvem gerenciada

## 2. Conceitos Fundamentais

### 2.1 Arquitetura DB2

#### Componentes Principais:
- **Instance (Instância)**: Ambiente de gerenciamento de banco de dados
- **Database**: Coleção de objetos relacionados (tabelas, índices, views)
- **Tablespace**: Contêiner lógico para armazenamento de dados
- **Buffer Pool**: Área de memória para cache de dados
- **Schema**: Namespace lógico para objetos do banco

### 2.2 Tipos de Dados Principais

```sql
-- Numéricos
SMALLINT, INTEGER, BIGINT
DECIMAL(p,s), NUMERIC(p,s)
REAL, DOUBLE, FLOAT

-- Caracteres
CHAR(n), VARCHAR(n)
CLOB(n) -- Character Large Object

-- Data e Hora
DATE, TIME, TIMESTAMP
TIMESTAMP WITH TIME ZONE

-- Binários
BLOB(n) -- Binary Large Object
VARBINARY(n)

-- XML e JSON (versões mais recentes)
XML
JSON
```

## 3. Melhores Práticas de Design

### 3.1 Modelagem de Dados

#### Normalização
```sql
-- Exemplo de tabela normalizada (3NF)
CREATE TABLE customers (
    customer_id INTEGER NOT NULL PRIMARY KEY,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE orders (
    order_id INTEGER NOT NULL PRIMARY KEY,
    customer_id INTEGER NOT NULL,
    order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    total_amount DECIMAL(10,2),
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
);
```

#### Convenções de Nomenclatura
- Use nomes descritivos e consistentes
- Prefixos para tipos de objetos: `tbl_`, `vw_`, `idx_`, `sp_`, `fn_`
- Snake_case ou CamelCase (mantenha consistência)
- Evite palavras reservadas do SQL

### 3.2 Índices

#### Estratégias de Indexação
```sql
-- Índice simples
CREATE INDEX idx_customers_email 
ON customers(email);

-- Índice composto
CREATE INDEX idx_orders_customer_date 
ON orders(customer_id, order_date DESC);

-- Índice único
CREATE UNIQUE INDEX idx_products_sku 
ON products(sku);

-- Índice com INCLUDE (covering index)
CREATE INDEX idx_orders_summary 
ON orders(customer_id) 
INCLUDE (order_date, total_amount);
```

#### Quando Criar Índices:
- Colunas frequentemente usadas em WHERE
- Colunas de junção (JOIN)
- Colunas usadas em ORDER BY e GROUP BY
- Colunas com alta cardinalidade

### 3.3 Particionamento

```sql
-- Particionamento por range
CREATE TABLE sales (
    sale_id INTEGER NOT NULL,
    sale_date DATE NOT NULL,
    amount DECIMAL(10,2)
) 
PARTITION BY RANGE (sale_date) (
    PARTITION sales_2023 VALUES LESS THAN ('2024-01-01'),
    PARTITION sales_2024 VALUES LESS THAN ('2025-01-01'),
    PARTITION sales_current VALUES LESS THAN (MAXVALUE)
);
```

## 4. Otimização de Performance

### 4.1 Análise de Query

#### EXPLAIN PLAN
```sql
-- Visualizar plano de execução
EXPLAIN PLAN FOR
SELECT c.customer_id, c.first_name, COUNT(o.order_id) as order_count
FROM customers c
LEFT JOIN orders o ON c.customer_id = o.customer_id
WHERE c.created_date >= '2024-01-01'
GROUP BY c.customer_id, c.first_name;

-- Consultar o plano
SELECT * FROM TABLE(EXPLAIN_STATEMENT());
```

### 4.2 Estatísticas

```sql
-- Atualizar estatísticas de tabela
RUNSTATS ON TABLE schema.customers 
WITH DISTRIBUTION AND DETAILED INDEXES ALL;

-- Reorganizar tabela para otimizar storage
REORG TABLE schema.customers;

-- Verificar necessidade de reorganização
SELECT TABNAME, CARD, OVERFLOW, F1, F2, F3 
FROM SYSIBMADM.ADMINTABINFO 
WHERE TABSCHEMA = 'SCHEMA_NAME' 
  AND REORG_PENDING = 'Y';
```

### 4.3 Técnicas de Otimização

#### Uso Eficiente de JOINs
```sql
-- EVITAR: Produto cartesiano
SELECT * FROM table1, table2;

-- PREFERIR: JOIN explícito
SELECT t1.*, t2.column
FROM table1 t1
INNER JOIN table2 t2 ON t1.id = t2.table1_id;
```

#### Paginação Eficiente
```sql
-- Usando ROW_NUMBER() para paginação
WITH numbered_results AS (
    SELECT 
        ROW_NUMBER() OVER (ORDER BY created_date DESC) AS rn,
        customer_id,
        first_name,
        last_name
    FROM customers
    WHERE status = 'ACTIVE'
)
SELECT * FROM numbered_results
WHERE rn BETWEEN 21 AND 40;  -- Página 2, 20 registros por página
```

## 5. Stored Procedures e Functions

### 5.1 Stored Procedures

```sql
CREATE OR REPLACE PROCEDURE calculate_customer_totals(
    IN p_customer_id INTEGER,
    OUT p_total_orders INTEGER,
    OUT p_total_amount DECIMAL(12,2)
)
LANGUAGE SQL
BEGIN
    -- Calcular total de pedidos
    SELECT COUNT(*), COALESCE(SUM(total_amount), 0)
    INTO p_total_orders, p_total_amount
    FROM orders
    WHERE customer_id = p_customer_id;
    
    -- Log da operação
    INSERT INTO audit_log (action, customer_id, timestamp)
    VALUES ('CALCULATE_TOTALS', p_customer_id, CURRENT_TIMESTAMP);
END;
```

### 5.2 User-Defined Functions (UDF)

```sql
-- Função escalar
CREATE OR REPLACE FUNCTION format_phone(phone VARCHAR(20))
RETURNS VARCHAR(20)
LANGUAGE SQL
DETERMINISTIC
NO EXTERNAL ACTION
READS SQL DATA
BEGIN
    DECLARE formatted_phone VARCHAR(20);
    
    SET formatted_phone = REPLACE(REPLACE(REPLACE(phone, '-', ''), '(', ''), ')', '');
    
    IF LENGTH(formatted_phone) = 10 THEN
        RETURN '(' || SUBSTR(formatted_phone, 1, 3) || ') ' ||
               SUBSTR(formatted_phone, 4, 3) || '-' ||
               SUBSTR(formatted_phone, 7, 4);
    ELSE
        RETURN phone;
    END IF;
END;

-- Função de tabela
CREATE OR REPLACE FUNCTION get_customer_orders(p_customer_id INTEGER)
RETURNS TABLE (
    order_id INTEGER,
    order_date TIMESTAMP,
    total_amount DECIMAL(10,2)
)
LANGUAGE SQL
READS SQL DATA
RETURN
    SELECT order_id, order_date, total_amount
    FROM orders
    WHERE customer_id = p_customer_id
    ORDER BY order_date DESC;
```

## 6. Segurança

### 6.1 Controle de Acesso

```sql
-- Criar role
CREATE ROLE app_developer;
CREATE ROLE app_reader;

-- Conceder privilégios
GRANT SELECT, INSERT, UPDATE ON TABLE customers TO ROLE app_developer;
GRANT SELECT ON TABLE customers TO ROLE app_reader;

-- Atribuir role a usuário
GRANT ROLE app_developer TO USER john_doe;

-- Revogar privilégios
REVOKE UPDATE ON TABLE customers FROM ROLE app_developer;
```

### 6.2 Row-Level Security (RLS)

```sql
-- Criar política de segurança
CREATE PERMISSION policy_customer_access ON customers
FOR ROWS WHERE customers.sales_rep_id = SESSION_USER
ENFORCED FOR ALL ACCESS
ENABLE;

-- Ativar RLS na tabela
ALTER TABLE customers ACTIVATE ROW ACCESS CONTROL;
```

### 6.3 Criptografia

```sql
-- Criar tablespace criptografado
CREATE TABLESPACE secure_ts
MANAGED BY DATABASE
USING (FILE '/db2/tablespaces/secure_ts' 10000)
ENCRYPTED;

-- Função para dados sensíveis
CREATE FUNCTION encrypt_ssn(ssn VARCHAR(11))
RETURNS VARCHAR(255)
LANGUAGE SQL
RETURN ENCRYPT(ssn, 'encryption_password');
```

## 7. Backup e Recovery

### 7.1 Estratégias de Backup

```sql
-- Backup completo offline
BACKUP DATABASE dbname TO '/backup/path' COMPRESS;

-- Backup online
BACKUP DATABASE dbname ONLINE TO '/backup/path' 
INCLUDE LOGS;

-- Backup incremental
BACKUP DATABASE dbname INCREMENTAL TO '/backup/path';
```

### 7.2 Recovery

```sql
-- Restore completo
RESTORE DATABASE dbname FROM '/backup/path' TAKEN AT timestamp;

-- Rollforward para point-in-time
ROLLFORWARD DATABASE dbname TO timestamp AND STOP;

-- Verificar status de recovery
LIST HISTORY BACKUP ALL FOR DATABASE dbname;
```

## 8. Monitoramento e Troubleshooting

### 8.1 Queries de Monitoramento

```sql
-- Conexões ativas
SELECT APPLICATION_NAME, CLIENT_USERID, CLIENT_HOSTNAME, 
       CONNECTION_START_TIME, TOTAL_APP_COMMITS
FROM TABLE(MON_GET_CONNECTION(NULL, -2)) AS T
WHERE APPLICATION_NAME IS NOT NULL;

-- Queries em execução
SELECT SUBSTR(STMT_TEXT, 1, 100) AS QUERY,
       NUM_EXECUTIONS,
       TOTAL_CPU_TIME,
       TOTAL_ROWS_READ,
       TOTAL_ROWS_RETURNED
FROM TABLE(MON_GET_PKG_CACHE_STMT(NULL, NULL, NULL, -2)) AS T
WHERE NUM_EXECUTIONS > 0
ORDER BY TOTAL_CPU_TIME DESC
FETCH FIRST 10 ROWS ONLY;

-- Uso de tablespace
SELECT TBSP_NAME,
       TBSP_TOTAL_SIZE_KB/1024 AS TOTAL_MB,
       TBSP_USED_SIZE_KB/1024 AS USED_MB,
       TBSP_FREE_SIZE_KB/1024 AS FREE_MB,
       TBSP_UTILIZATION_PERCENT
FROM TABLE(MON_GET_TABLESPACE(NULL, -2)) AS T;
```

### 8.2 Identificação de Locks

```sql
-- Verificar locks ativos
SELECT 
    LOCK_OBJECT_TYPE,
    LOCK_MODE,
    LOCK_STATUS,
    APPLICATION_HANDLE,
    LOCK_COUNT
FROM TABLE(MON_GET_LOCKS(NULL, -2)) AS T
WHERE LOCK_STATUS = 'WAITING';

-- Identificar deadlocks
SELECT * FROM TABLE(ADMIN_GET_EVENT_MONITOR_STATUS('DEADLOCK_MONITOR')) AS T;
```

## 9. Melhores Práticas de Desenvolvimento

### 9.1 Transações

```sql
-- Uso correto de transações
BEGIN TRANSACTION;
    -- Múltiplas operações
    UPDATE accounts SET balance = balance - 100 WHERE account_id = 1;
    UPDATE accounts SET balance = balance + 100 WHERE account_id = 2;
    
    -- Verificação
    IF (SELECT balance FROM accounts WHERE account_id = 1) < 0 THEN
        ROLLBACK;
    ELSE
        COMMIT;
    END IF;
END;
```

### 9.2 Error Handling

```sql
CREATE PROCEDURE safe_insert_customer(
    IN p_email VARCHAR(100),
    IN p_first_name VARCHAR(50),
    IN p_last_name VARCHAR(50)
)
LANGUAGE SQL
BEGIN
    DECLARE SQLSTATE CHAR(5);
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        -- Log do erro
        INSERT INTO error_log (error_code, error_message, timestamp)
        VALUES (SQLSTATE, 'Error inserting customer', CURRENT_TIMESTAMP);
        
        -- Re-throw do erro
        RESIGNAL;
    END;
    
    INSERT INTO customers (email, first_name, last_name)
    VALUES (p_email, p_first_name, p_last_name);
END;
```

### 9.3 Connection Pooling

```java
// Exemplo de configuração para Java/JDBC
public class DB2ConnectionPool {
    private static final String URL = "jdbc:db2://server:50000/database";
    private static final int MIN_CONNECTIONS = 5;
    private static final int MAX_CONNECTIONS = 20;
    
    public static DataSource getDataSource() {
        DB2SimpleDataSource ds = new DB2SimpleDataSource();
        ds.setServerName("server");
        ds.setPortNumber(50000);
        ds.setDatabaseName("database");
        ds.setDriverType(4);
        
        // Configurações de pool
        ds.setConnectionPoolDataSource(true);
        ds.setMinPoolSize(MIN_CONNECTIONS);
        ds.setMaxPoolSize(MAX_CONNECTIONS);
        ds.setMaxIdleTime(300); // 5 minutos
        
        return ds;
    }
}
```

## 10. Ferramentas e Utilities

### 10.1 Ferramentas de Linha de Comando

```bash
# CLP (Command Line Processor)
db2 connect to database user username
db2 "SELECT * FROM customers FETCH FIRST 10 ROWS ONLY"
db2 terminate

# Export de dados
db2 "EXPORT TO customers.csv OF DEL MODIFIED BY COLDEL, 
     SELECT * FROM customers"

# Import de dados
db2 "IMPORT FROM customers.csv OF DEL MODIFIED BY COLDEL, 
     INSERT INTO customers"

# Load de dados (mais rápido para grandes volumes)
db2 "LOAD FROM large_data.csv OF DEL MODIFIED BY COLDEL, 
     INSERT INTO large_table NONRECOVERABLE"
```

### 10.2 DB2 Data Studio

Funcionalidades principais:
- Design visual de banco de dados
- SQL editor com auto-complete
- Debugging de stored procedures
- Performance tuning advisor
- Visual Explain para análise de queries

### 10.3 Scripts de Manutenção

```sql
-- Script de manutenção semanal
CREATE PROCEDURE weekly_maintenance()
LANGUAGE SQL
BEGIN
    DECLARE v_table_name VARCHAR(128);
    DECLARE v_schema VARCHAR(128);
    DECLARE v_sql VARCHAR(500);
    DECLARE at_end INT DEFAULT 0;
    
    DECLARE cur CURSOR FOR
        SELECT TABSCHEMA, TABNAME 
        FROM SYSCAT.TABLES 
        WHERE TYPE = 'T' 
          AND TABSCHEMA NOT LIKE 'SYS%';
    
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET at_end = 1;
    
    OPEN cur;
    
    fetch_loop: LOOP
        FETCH cur INTO v_schema, v_table_name;
        
        IF at_end = 1 THEN
            LEAVE fetch_loop;
        END IF;
        
        -- RUNSTATS em cada tabela
        SET v_sql = 'RUNSTATS ON TABLE ' || v_schema || '.' || v_table_name;
        EXECUTE IMMEDIATE v_sql;
        
        -- REORG se necessário
        SET v_sql = 'CALL SYSPROC.ADMIN_CMD(''REORG TABLE ' || 
                    v_schema || '.' || v_table_name || ''')';
        EXECUTE IMMEDIATE v_sql;
    END LOOP;
    
    CLOSE cur;
END;
```

## 11. Integração com Aplicações

### 11.1 JDBC (Java)

```java
import java.sql.*;

public class DB2Example {
    public static void main(String[] args) {
        String url = "jdbc:db2://localhost:50000/sample";
        String user = "db2admin";
        String password = "password";
        
        try (Connection conn = DriverManager.getConnection(url, user, password)) {
            // Prepared Statement para evitar SQL Injection
            String sql = "SELECT * FROM customers WHERE email = ?";
            try (PreparedStatement pstmt = conn.prepareStatement(sql)) {
                pstmt.setString(1, "customer@email.com");
                
                try (ResultSet rs = pstmt.executeQuery()) {
                    while (rs.next()) {
                        System.out.println("Customer: " + rs.getString("first_name"));
                    }
                }
            }
            
            // Batch processing
            conn.setAutoCommit(false);
            String insertSQL = "INSERT INTO orders (customer_id, amount) VALUES (?, ?)";
            try (PreparedStatement pstmt = conn.prepareStatement(insertSQL)) {
                for (int i = 0; i < 1000; i++) {
                    pstmt.setInt(1, i);
                    pstmt.setBigDecimal(2, new BigDecimal("99.99"));
                    pstmt.addBatch();
                }
                pstmt.executeBatch();
                conn.commit();
            }
        } catch (SQLException e) {
            e.printStackTrace();
        }
    }
}
```

### 11.2 Python

```python
import ibm_db
import ibm_db_dbi as dbi

# Conexão
conn_str = "DATABASE=sample;HOSTNAME=localhost;PORT=50000;PROTOCOL=TCPIP;UID=user;PWD=password;"
conn = ibm_db.connect(conn_str, "", "")

# Usando cursor
connection = dbi.Connection(conn)
cursor = connection.cursor()

# Query simples
cursor.execute("SELECT * FROM customers WHERE status = ?", ('ACTIVE',))
for row in cursor.fetchall():
    print(f"Customer: {row[1]} {row[2]}")

# Insert com tratamento de erro
try:
    cursor.execute("""
        INSERT INTO customers (first_name, last_name, email) 
        VALUES (?, ?, ?)
    """, ('John', 'Doe', 'john@example.com'))
    connection.commit()
except Exception as e:
    connection.rollback()
    print(f"Error: {e}")

cursor.close()
connection.close()
```

### 11.3 .NET/C#

```csharp
using IBM.Data.DB2;
using System;

public class DB2Example
{
    public static void Main()
    {
        string connStr = "Server=localhost:50000;Database=sample;UID=user;PWD=password;";
        
        using (DB2Connection conn = new DB2Connection(connStr))
        {
            conn.Open();
            
            // Query com parâmetros
            string sql = "SELECT * FROM customers WHERE created_date >= @startDate";
            using (DB2Command cmd = new DB2Command(sql, conn))
            {
                cmd.Parameters.Add("@startDate", DB2Type.Date).Value = DateTime.Now.AddDays(-30);
                
                using (DB2DataReader reader = cmd.ExecuteReader())
                {
                    while (reader.Read())
                    {
                        Console.WriteLine($"Customer: {reader["first_name"]} {reader["last_name"]}");
                    }
                }
            }
            
            // Stored Procedure
            using (DB2Command cmd = new DB2Command("calculate_customer_totals", conn))
            {
                cmd.CommandType = CommandType.StoredProcedure;
                cmd.Parameters.Add("p_customer_id", DB2Type.Integer).Value = 123;
                cmd.Parameters.Add("p_total_orders", DB2Type.Integer).Direction = ParameterDirection.Output;
                cmd.Parameters.Add("p_total_amount", DB2Type.Decimal).Direction = ParameterDirection.Output;
                
                cmd.ExecuteNonQuery();
                
                Console.WriteLine($"Total Orders: {cmd.Parameters["p_total_orders"].Value}");
                Console.WriteLine($"Total Amount: {cmd.Parameters["p_total_amount"].Value}");
            }
        }
    }
}
```

## 12. Checklist de Desenvolvimento

### Antes do Deploy

- [ ] Todas as queries foram testadas com EXPLAIN?
- [ ] Índices apropriados foram criados?
- [ ] Estatísticas estão atualizadas (RUNSTATS)?
- [ ] Constraints de integridade estão implementadas?
- [ ] Backup strategy está definida?
- [ ] Permissões de segurança foram configuradas?
- [ ] Connection pooling está configurado?
- [ ] Error handling está implementado?
- [ ] Logs de auditoria estão configurados?
- [ ] Documentação está completa?

### Durante o Desenvolvimento

- [ ] Usar prepared statements para evitar SQL injection
- [ ] Implementar transações apropriadamente
- [ ] Fechar conexões e recursos adequadamente
- [ ] Usar batch processing para operações em massa
- [ ] Implementar retry logic para transient errors
- [ ] Monitorar performance regularmente
- [ ] Manter scripts de migração versionados

### Após Deploy

- [ ] Monitorar logs de erro
- [ ] Verificar performance de queries
- [ ] Analisar uso de recursos (CPU, memória, I/O)
- [ ] Revisar planos de execução periodicamente
- [ ] Manter estatísticas atualizadas
- [ ] Executar manutenção preventiva regular

## 13. Recursos Adicionais

### Documentação Oficial
- IBM DB2 Knowledge Center
- DB2 SQL Reference
- DB2 Performance Tuning Guide
- DB2 Application Development Guide

### Certificações
- IBM Certified Database Associate - DB2
- IBM Certified Database Administrator - DB2
- IBM Certified Application Developer - DB2

### Comunidade
- IBM Developer Community
- Stack Overflow - tag [db2]
- DB2 User Groups
- IBM Data and AI Community

## 14. Desenvolvimento Mainframe COBOL com DB2

### 14.1 Conceitos Fundamentais COBOL-DB2

#### Arquitetura de Integração
O COBOL em ambiente mainframe (z/OS) interage com DB2 através de:
- **Embedded SQL**: SQL statements incorporados diretamente no código COBOL
- **DB2 Precompiler**: Processa o código antes da compilação
- **DBRM (Database Request Module)**: Contém as SQL statements extraídas
- **Plan/Package**: Executável do DB2 contendo SQL otimizado
- **SQLCA (SQL Communication Area)**: Estrutura para comunicação de status

### 14.2 Estrutura de Programa COBOL-DB2

```cobol
       IDENTIFICATION DIVISION.
       PROGRAM-ID. CUSTMAINT.
       AUTHOR. DEVELOPER.
       
       ENVIRONMENT DIVISION.
       
       DATA DIVISION.
       WORKING-STORAGE SECTION.
      *---------------------------------------------------------
      * SQLCA - SQL Communication Area
      *---------------------------------------------------------
           EXEC SQL
               INCLUDE SQLCA
           END-EXEC.
           
      *---------------------------------------------------------
      * Declaração de Tabelas (DCLGEN)
      *---------------------------------------------------------
           EXEC SQL
               INCLUDE CUSTOMER
           END-EXEC.
           
      *---------------------------------------------------------
      * Host Variables
      *---------------------------------------------------------
       01  WS-CUSTOMER-RECORD.
           05  WS-CUST-ID           PIC S9(9) COMP.
           05  WS-CUST-NAME         PIC X(50).
           05  WS-CUST-EMAIL        PIC X(100).
           05  WS-CUST-PHONE        PIC X(20).
           05  WS-CUST-STATUS       PIC X(10).
           05  WS-CUST-BALANCE      PIC S9(9)V99 COMP-3.
           05  WS-CREATED-DATE      PIC X(26).
           
      *---------------------------------------------------------
      * Null Indicators
      *---------------------------------------------------------
       01  WS-NULL-INDICATORS.
           05  WS-PHONE-IND         PIC S9(4) COMP.
           05  WS-EMAIL-IND         PIC S9(4) COMP.
           
      *---------------------------------------------------------
      * Work Variables
      *---------------------------------------------------------
       01  WS-SQLCODE             PIC S9(9) COMP VALUE ZERO.
       01  WS-ERROR-MSG           PIC X(80).
       01  WS-EOF-FLAG            PIC X VALUE 'N'.
           88  END-OF-DATA        VALUE 'Y'.
```

### 14.3 DCLGEN (Declarations Generator)

#### Gerando DCLGEN
```jcl
//DCLGEN   EXEC PGM=IKJEFT01
//SYSTSPRT DD SYSOUT=*
//SYSTSIN  DD *
  DSN SYSTEM(DB2P)
  DCLGEN TABLE(SCHEMA.CUSTOMERS)
         LIBRARY(YOUR.COBOL.COPYLIB(CUSTOMER))
         LANGUAGE(COBOL)
         NAMES(WS-)
         COLSUFFIX(YES)
         INDVAR(YES)
/*
```

#### Resultado DCLGEN (COPYBOOK)
```cobol
      ******************************************************************
      * DCLGEN TABLE(SCHEMA.CUSTOMERS)                                *
      *        LIBRARY(YOUR.COBOL.COPYLIB(CUSTOMER))                  *
      *        LANGUAGE(COBOL)                                        *
      *        NAMES(WS-)                                             *
      * ... IS THE DCLGEN COMMAND THAT MADE THE FOLLOWING STATEMENTS  *
      ******************************************************************
           EXEC SQL DECLARE SCHEMA.CUSTOMERS TABLE
           ( CUSTOMER_ID            INTEGER NOT NULL,
             FIRST_NAME             VARCHAR(50) NOT NULL,
             LAST_NAME              VARCHAR(50) NOT NULL,
             EMAIL                  VARCHAR(100),
             PHONE                  VARCHAR(20),
             STATUS                 CHAR(10) NOT NULL,
             BALANCE                DECIMAL(11, 2),
             CREATED_DATE           TIMESTAMP NOT NULL
           ) END-EXEC.
      ******************************************************************
      * COBOL DECLARATION FOR TABLE SCHEMA.CUSTOMERS                  *
      ******************************************************************
       01  DCLCUSTOMERS.
           10 WS-CUSTOMER-ID        PIC S9(9) USAGE COMP.
           10 WS-FIRST-NAME.
              49 WS-FIRST-NAME-LEN  PIC S9(4) USAGE COMP.
              49 WS-FIRST-NAME-TEXT PIC X(50).
           10 WS-LAST-NAME.
              49 WS-LAST-NAME-LEN   PIC S9(4) USAGE COMP.
              49 WS-LAST-NAME-TEXT  PIC X(50).
           10 WS-EMAIL.
              49 WS-EMAIL-LEN       PIC S9(4) USAGE COMP.
              49 WS-EMAIL-TEXT      PIC X(100).
           10 WS-PHONE.
              49 WS-PHONE-LEN       PIC S9(4) USAGE COMP.
              49 WS-PHONE-TEXT      PIC X(20).
           10 WS-STATUS            PIC X(10).
           10 WS-BALANCE           PIC S9(9)V9(2) USAGE COMP-3.
           10 WS-CREATED-DATE      PIC X(26).
      ******************************************************************
      * INDICATOR VARIABLE STRUCTURE                                  *
      ******************************************************************
       01  ICUSTOMERS.
           10 INDSTRUC           PIC S9(4) USAGE COMP OCCURS 8 TIMES.
```

### 14.4 Operações CRUD em COBOL

#### SELECT - Consulta Simples
```cobol
       PROCEDURE DIVISION.
       
       1000-SELECT-CUSTOMER.
      *---------------------------------------------------------
      * Select único registro
      *---------------------------------------------------------
           MOVE 12345 TO WS-CUSTOMER-ID
           
           EXEC SQL
               SELECT CUSTOMER_ID,
                      FIRST_NAME,
                      LAST_NAME,
                      EMAIL,
                      PHONE,
                      STATUS,
                      BALANCE,
                      CREATED_DATE
                 INTO :WS-CUSTOMER-ID,
                      :WS-FIRST-NAME,
                      :WS-LAST-NAME,
                      :WS-EMAIL :WS-EMAIL-IND,
                      :WS-PHONE :WS-PHONE-IND,
                      :WS-STATUS,
                      :WS-BALANCE,
                      :WS-CREATED-DATE
                 FROM CUSTOMERS
                WHERE CUSTOMER_ID = :WS-CUSTOMER-ID
           END-EXEC
           
           EVALUATE SQLCODE
               WHEN 0
                   DISPLAY 'Customer found: ' WS-FIRST-NAME
                   PERFORM 1100-CHECK-NULL-VALUES
               WHEN +100
                   DISPLAY 'Customer not found'
               WHEN OTHER
                   PERFORM 9000-SQL-ERROR
           END-EVALUATE.
           
       1100-CHECK-NULL-VALUES.
           IF WS-EMAIL-IND < 0
               DISPLAY 'Email is NULL'
           ELSE
               DISPLAY 'Email: ' WS-EMAIL
           END-IF.
```

#### INSERT - Inserção de Registro
```cobol
       2000-INSERT-CUSTOMER.
      *---------------------------------------------------------
      * Insert novo cliente
      *---------------------------------------------------------
           MOVE 'John'              TO WS-FIRST-NAME
           MOVE 'Doe'               TO WS-LAST-NAME
           MOVE 'john.doe@email.com' TO WS-EMAIL
           MOVE '555-1234'          TO WS-PHONE
           MOVE 'ACTIVE'            TO WS-STATUS
           MOVE 1000.00             TO WS-BALANCE
           
      * Set null indicators (0 = not null, -1 = null)
           MOVE 0 TO WS-EMAIL-IND
           MOVE 0 TO WS-PHONE-IND
           
           EXEC SQL
               INSERT INTO CUSTOMERS
                   (FIRST_NAME,
                    LAST_NAME,
                    EMAIL,
                    PHONE,
                    STATUS,
                    BALANCE)
               VALUES
                   (:WS-FIRST-NAME,
                    :WS-LAST-NAME,
                    :WS-EMAIL :WS-EMAIL-IND,
                    :WS-PHONE :WS-PHONE-IND,
                    :WS-STATUS,
                    :WS-BALANCE)
           END-EXEC
           
           IF SQLCODE = 0
               DISPLAY 'Customer inserted successfully'
               DISPLAY 'Rows affected: ' SQLERRD(3)
           ELSE
               PERFORM 9000-SQL-ERROR
           END-IF.
```

#### UPDATE - Atualização de Registro
```cobol
       3000-UPDATE-CUSTOMER.
      *---------------------------------------------------------
      * Update dados do cliente
      *---------------------------------------------------------
           MOVE 12345 TO WS-CUSTOMER-ID
           MOVE 'INACTIVE' TO WS-STATUS
           MOVE 2500.50 TO WS-BALANCE
           
           EXEC SQL
               UPDATE CUSTOMERS
                  SET STATUS = :WS-STATUS,
                      BALANCE = :WS-BALANCE
                WHERE CUSTOMER_ID = :WS-CUSTOMER-ID
           END-EXEC
           
           EVALUATE SQLCODE
               WHEN 0
                   IF SQLERRD(3) > 0
                       DISPLAY 'Customer updated. Rows: ' SQLERRD(3)
                   ELSE
                       DISPLAY 'No rows updated'
                   END-IF
               WHEN OTHER
                   PERFORM 9000-SQL-ERROR
           END-EVALUATE.
```

#### DELETE - Exclusão de Registro
```cobol
       4000-DELETE-CUSTOMER.
      *---------------------------------------------------------
      * Delete cliente
      *---------------------------------------------------------
           MOVE 12345 TO WS-CUSTOMER-ID
           
           EXEC SQL
               DELETE FROM CUSTOMERS
                WHERE CUSTOMER_ID = :WS-CUSTOMER-ID
           END-EXEC
           
           IF SQLCODE = 0
               DISPLAY 'Customer deleted. Rows: ' SQLERRD(3)
           ELSE
               PERFORM 9000-SQL-ERROR
           END-IF.
```

### 14.5 Cursores em COBOL

#### Declaração e Uso de Cursores
```cobol
       WORKING-STORAGE SECTION.
      *---------------------------------------------------------
      * Declaração de Cursor
      *---------------------------------------------------------
           EXEC SQL
               DECLARE CUST_CURSOR CURSOR FOR
               SELECT CUSTOMER_ID,
                      FIRST_NAME,
                      LAST_NAME,
                      EMAIL,
                      STATUS,
                      BALANCE
                 FROM CUSTOMERS
                WHERE STATUS = :WS-SEARCH-STATUS
                ORDER BY LAST_NAME, FIRST_NAME
           END-EXEC.
           
       PROCEDURE DIVISION.
       
       5000-PROCESS-CUSTOMERS.
      *---------------------------------------------------------
      * Processar múltiplos registros com cursor
      *---------------------------------------------------------
           MOVE 'ACTIVE' TO WS-SEARCH-STATUS
           MOVE 'N' TO WS-EOF-FLAG
           
      * Abrir cursor
           EXEC SQL
               OPEN CUST_CURSOR
           END-EXEC
           
           IF SQLCODE NOT = 0
               PERFORM 9000-SQL-ERROR
           END-IF
           
      * Loop de processamento
           PERFORM UNTIL END-OF-DATA
               EXEC SQL
                   FETCH CUST_CURSOR
                    INTO :WS-CUSTOMER-ID,
                         :WS-FIRST-NAME,
                         :WS-LAST-NAME,
                         :WS-EMAIL :WS-EMAIL-IND,
                         :WS-STATUS,
                         :WS-BALANCE
               END-EXEC
               
               EVALUATE SQLCODE
                   WHEN 0
                       PERFORM 5100-PROCESS-RECORD
                   WHEN +100
                       SET END-OF-DATA TO TRUE
                       DISPLAY 'End of cursor data'
                   WHEN OTHER
                       PERFORM 9000-SQL-ERROR
                       SET END-OF-DATA TO TRUE
               END-EVALUATE
           END-PERFORM
           
      * Fechar cursor
           EXEC SQL
               CLOSE CUST_CURSOR
           END-EXEC.
           
       5100-PROCESS-RECORD.
           DISPLAY 'Processing: ' WS-FIRST-NAME ' ' WS-LAST-NAME
           ADD WS-BALANCE TO WS-TOTAL-BALANCE.
```

#### Cursor com UPDATE (Positioned Update)
```cobol
      *---------------------------------------------------------
      * Cursor para UPDATE
      *---------------------------------------------------------
           EXEC SQL
               DECLARE UPD_CURSOR CURSOR FOR
               SELECT CUSTOMER_ID, BALANCE
                 FROM CUSTOMERS
                WHERE STATUS = 'ACTIVE'
                 FOR UPDATE OF BALANCE
           END-EXEC.
           
       6000-UPDATE-WITH-CURSOR.
           EXEC SQL
               OPEN UPD_CURSOR
           END-EXEC
           
           PERFORM UNTIL END-OF-DATA
               EXEC SQL
                   FETCH UPD_CURSOR
                    INTO :WS-CUSTOMER-ID,
                         :WS-BALANCE
               END-EXEC
               
               IF SQLCODE = 0
                   COMPUTE WS-NEW-BALANCE = WS-BALANCE * 1.05
                   
                   EXEC SQL
                       UPDATE CUSTOMERS
                          SET BALANCE = :WS-NEW-BALANCE
                        WHERE CURRENT OF UPD_CURSOR
                   END-EXEC
                   
                   IF SQLCODE = 0
                       ADD 1 TO WS-UPDATE-COUNT
                   END-IF
               ELSE
                   IF SQLCODE = +100
                       SET END-OF-DATA TO TRUE
                   END-IF
               END-IF
           END-PERFORM
           
           EXEC SQL
               CLOSE UPD_CURSOR
           END-EXEC.
```

### 14.6 Tratamento de Erros e SQLCA

```cobol
       WORKING-STORAGE SECTION.
      *---------------------------------------------------------
      * Error Handling Variables
      *---------------------------------------------------------
       01  WS-ERROR-HANDLING.
           05  WS-SQLCODE-DISPLAY   PIC -ZZZ,ZZZ,ZZ9.
           05  WS-SQLERRM.
               49  WS-SQLERRML      PIC S9(4) COMP.
               49  WS-SQLERRMC      PIC X(70).
           05  WS-DISPLAY-SQLERRMC PIC X(70).
           
       PROCEDURE DIVISION.
       
       9000-SQL-ERROR.
      *---------------------------------------------------------
      * Rotina genérica de tratamento de erro SQL
      *---------------------------------------------------------
           MOVE SQLCODE TO WS-SQLCODE-DISPLAY
           DISPLAY '*** SQL ERROR ***'
           DISPLAY 'SQLCODE: ' WS-SQLCODE-DISPLAY
           
      * Obter mensagem de erro
           CALL 'DSNTIAR' USING SQLCA
                                WS-ERROR-MESSAGE
                                WS-ERROR-TEXT-LEN
           
           DISPLAY 'Error Message: ' WS-ERROR-MESSAGE
           
      * Informações adicionais da SQLCA
           DISPLAY 'Program: ' SQLERRP
           DISPLAY 'SQLERRD(1): ' SQLERRD(1)
           DISPLAY 'SQLERRD(3): ' SQLERRD(3)
           
      * Tratamento específico por código
           EVALUATE SQLCODE
               WHEN -803
                   DISPLAY 'Duplicate key violation'
                   PERFORM 9100-HANDLE-DUPLICATE
               WHEN -911
                   DISPLAY 'Deadlock or timeout'
                   PERFORM 9200-HANDLE-DEADLOCK
               WHEN -904
                   DISPLAY 'Resource unavailable'
                   PERFORM 9300-HANDLE-RESOURCE
               WHEN OTHER
                   DISPLAY 'Unhandled SQL error'
                   PERFORM 9900-ABEND-PROGRAM
           END-EVALUATE.
           
       9100-HANDLE-DUPLICATE.
           DISPLAY 'Attempting to handle duplicate key...'
           MOVE 'E' TO WS-RETURN-CODE.
           
       9200-HANDLE-DEADLOCK.
           DISPLAY 'Retrying after deadlock...'
           ADD 1 TO WS-RETRY-COUNT
           IF WS-RETRY-COUNT < 4
               PERFORM 1000-RETRY-TRANSACTION
           ELSE
               PERFORM 9900-ABEND-PROGRAM
           END-IF.
           
       9900-ABEND-PROGRAM.
           DISPLAY 'Program abending due to SQL error'
           MOVE 16 TO RETURN-CODE
           EXEC SQL
               ROLLBACK
           END-EXEC
           GOBACK.
```

### 14.7 Controle de Transações

```cobol
       PROCEDURE DIVISION.
       
       7000-TRANSACTION-PROCESSING.
      *---------------------------------------------------------
      * Processamento com controle de transação
      *---------------------------------------------------------
           EXEC SQL
               COMMIT
           END-EXEC
           
      * Iniciar unidade de trabalho
           PERFORM 7100-PROCESS-BATCH
           
           IF WS-PROCESS-OK = 'Y'
               EXEC SQL
                   COMMIT
               END-EXEC
               DISPLAY 'Transaction committed successfully'
           ELSE
               EXEC SQL
                   ROLLBACK
               END-EXEC
               DISPLAY 'Transaction rolled back'
           END-IF.
           
       7100-PROCESS-BATCH.
           MOVE 'Y' TO WS-PROCESS-OK
           
      * Processar múltiplas operações
           PERFORM 7110-DEBIT-ACCOUNT
           IF SQLCODE NOT = 0
               MOVE 'N' TO WS-PROCESS-OK
           END-IF
           
           IF WS-PROCESS-OK = 'Y'
               PERFORM 7120-CREDIT-ACCOUNT
               IF SQLCODE NOT = 0
                   MOVE 'N' TO WS-PROCESS-OK
               END-IF
           END-IF
           
           IF WS-PROCESS-OK = 'Y'
               PERFORM 7130-LOG-TRANSACTION
               IF SQLCODE NOT = 0
                   MOVE 'N' TO WS-PROCESS-OK
               END-IF
           END-IF.
           
       7200-SAVEPOINT-EXAMPLE.
      *---------------------------------------------------------
      * Uso de SAVEPOINTs
      *---------------------------------------------------------
           EXEC SQL
               SAVEPOINT SAVE_POINT_1
           END-EXEC
           
           PERFORM 7210-CRITICAL-UPDATE
           
           IF WS-CRITICAL-OK = 'Y'
               EXEC SQL
                   RELEASE SAVEPOINT SAVE_POINT_1
               END-EXEC
           ELSE
               EXEC SQL
                   ROLLBACK TO SAVEPOINT SAVE_POINT_1
               END-EXEC
               DISPLAY 'Rolled back to savepoint'
           END-IF.
```

### 14.8 Performance em COBOL-DB2

#### Multi-Row FETCH
```cobol
       WORKING-STORAGE SECTION.
      *---------------------------------------------------------
      * Arrays para Multi-Row Fetch
      *---------------------------------------------------------
       01  WS-ROWSET-SIZE          PIC S9(4) COMP VALUE 100.
       01  WS-ROWS-FETCHED         PIC S9(4) COMP.
       
       01  WS-CUSTOMER-ARRAYS.
           05  WS-ARR-CUSTOMER-ID   PIC S9(9) COMP
                                    OCCURS 100 TIMES.
           05  WS-ARR-FIRST-NAME    PIC X(50)
                                    OCCURS 100 TIMES.
           05  WS-ARR-LAST-NAME     PIC X(50)
                                    OCCURS 100 TIMES.
           05  WS-ARR-BALANCE       PIC S9(9)V99 COMP-3
                                    OCCURS 100 TIMES.
                                    
       PROCEDURE DIVISION.
       
       8000-MULTI-ROW-FETCH.
      *---------------------------------------------------------
      * Fetch múltiplas linhas de uma vez
      *---------------------------------------------------------
           EXEC SQL
               DECLARE MULTI_CURSOR CURSOR FOR
               SELECT CUSTOMER_ID,
                      FIRST_NAME,
                      LAST_NAME,
                      BALANCE
                 FROM CUSTOMERS
                WHERE STATUS = 'ACTIVE'
           END-EXEC
           
           EXEC SQL
               OPEN MULTI_CURSOR
           END-EXEC
           
           PERFORM UNTIL END-OF-DATA
               EXEC SQL
                   FETCH MULTI_CURSOR
                    FOR :WS-ROWSET-SIZE ROWS
                    INTO :WS-ARR-CUSTOMER-ID,
                         :WS-ARR-FIRST-NAME,
                         :WS-ARR-LAST-NAME,
                         :WS-ARR-BALANCE
               END-EXEC
               
               IF SQLCODE = 0 OR SQLCODE = +100
                   MOVE SQLERRD(3) TO WS-ROWS-FETCHED
                   PERFORM 8100-PROCESS-ROWSET
                   
                   IF SQLCODE = +100
                       SET END-OF-DATA TO TRUE
                   END-IF
               ELSE
                   PERFORM 9000-SQL-ERROR
                   SET END-OF-DATA TO TRUE
               END-IF
           END-PERFORM
           
           EXEC SQL
               CLOSE MULTI_CURSOR
           END-EXEC.
           
       8100-PROCESS-ROWSET.
           PERFORM VARYING WS-IDX FROM 1 BY 1
                   UNTIL WS-IDX > WS-ROWS-FETCHED
               DISPLAY 'Customer: ' WS-ARR-FIRST-NAME(WS-IDX)
                       ' Balance: ' WS-ARR-BALANCE(WS-IDX)
           END-PERFORM.
```

#### Multi-Row INSERT
```cobol
       8200-MULTI-ROW-INSERT.
      *---------------------------------------------------------
      * Insert múltiplas linhas de uma vez
      *---------------------------------------------------------
      * Preparar dados
           PERFORM VARYING WS-IDX FROM 1 BY 1 
                   UNTIL WS-IDX > 50
               MOVE WS-IDX TO WS-ARR-CUSTOMER-ID(WS-IDX)
               STRING 'Customer' WS-IDX 
                      DELIMITED BY SIZE
                      INTO WS-ARR-FIRST-NAME(WS-IDX)
               MOVE 'Smith' TO WS-ARR-LAST-NAME(WS-IDX)
               COMPUTE WS-ARR-BALANCE(WS-IDX) = WS-IDX * 100
           END-PERFORM
           
           MOVE 50 TO WS-ROWSET-SIZE
           
           EXEC SQL
               INSERT INTO CUSTOMERS
                   (CUSTOMER_ID,
                    FIRST_NAME,
                    LAST_NAME,
                    BALANCE)
               VALUES (:WS-ARR-CUSTOMER-ID,
                       :WS-ARR-FIRST-NAME,
                       :WS-ARR-LAST-NAME,
                       :WS-ARR-BALANCE)
               FOR :WS-ROWSET-SIZE ROWS
               NOT ATOMIC CONTINUE ON SQLEXCEPTION
           END-EXEC
           
           DISPLAY 'Rows inserted: ' SQLERRD(3).
```

### 14.9 Stored Procedures em COBOL

#### Criando Stored Procedure COBOL
```cobol
       IDENTIFICATION DIVISION.
       PROGRAM-ID. CALCBAL.
      *---------------------------------------------------------
      * Stored Procedure em COBOL
      *---------------------------------------------------------
       ENVIRONMENT DIVISION.
       
       DATA DIVISION.
       WORKING-STORAGE SECTION.
           EXEC SQL INCLUDE SQLCA END-EXEC.
           
       LINKAGE SECTION.
       01  L-CUSTOMER-ID           PIC S9(9) COMP.
       01  L-TOTAL-BALANCE         PIC S9(11)V99 COMP-3.
       01  L-RETURN-CODE           PIC S9(9) COMP.
       01  L-ERROR-MSG             PIC X(100).
       
       PROCEDURE DIVISION USING L-CUSTOMER-ID
                                L-TOTAL-BALANCE
                                L-RETURN-CODE
                                L-ERROR-MSG.
           
           MOVE ZERO TO L-TOTAL-BALANCE
           MOVE ZERO TO L-RETURN-CODE
           MOVE SPACES TO L-ERROR-MSG
           
           EXEC SQL
               SELECT COALESCE(SUM(BALANCE), 0)
                 INTO :L-TOTAL-BALANCE
                 FROM ACCOUNTS
                WHERE CUSTOMER_ID = :L-CUSTOMER-ID
           END-EXEC
           
           IF SQLCODE = 0
               MOVE 0 TO L-RETURN-CODE
               MOVE 'Success' TO L-ERROR-MSG
           ELSE
               IF SQLCODE = +100
                   MOVE 4 TO L-RETURN-CODE
                   MOVE 'No accounts found' TO L-ERROR-MSG
               ELSE
                   MOVE 8 TO L-RETURN-CODE
                   MOVE 'Database error' TO L-ERROR-MSG
               END-IF
           END-IF
           
           GOBACK.
```

#### Chamando Stored Procedure
```cobol
       9000-CALL-STORED-PROC.
           MOVE 12345 TO WS-CUSTOMER-ID
           
           EXEC SQL
               CALL CALCBAL(:WS-CUSTOMER-ID,
                           :WS-TOTAL-BALANCE,
                           :WS-RETURN-CODE,
                           :WS-ERROR-MSG)
           END-EXEC
           
           IF SQLCODE = 0
               DISPLAY 'Total Balance: ' WS-TOTAL-BALANCE
               DISPLAY 'Return Code: ' WS-RETURN-CODE
               DISPLAY 'Message: ' WS-ERROR-MSG
           ELSE
               PERFORM 9000-SQL-ERROR
           END-IF.
```

### 14.10 JCL para Compilação e Bind

#### JCL de Precompile, Compile, Link e Bind
```jcl
//COMPBIND JOB (ACCT),'DB2 COBOL COMPILE',
//         CLASS=A,MSGCLASS=X,NOTIFY=&SYSUID
//*-------------------------------------------------------
//* STEP 1: DB2 PRECOMPILE
//*-------------------------------------------------------
//PC       EXEC PGM=DSNHPC,
//         PARM='HOST(COB2),SOURCE,XREF,FLAG(I),APOST'
//STEPLIB  DD DSN=DB2.SDSNLOAD,DISP=SHR
//DBRMLIB  DD DSN=YOUR.DBRM.LIBRARY(PROGNAME),DISP=SHR
//SYSCIN   DD DSN=YOUR.COBOL.PRECOMP(PROGNAME),DISP=SHR
//SYSPRINT DD SYSOUT=*
//SYSTERM  DD SYSOUT=*
//SYSUDUMP DD SYSOUT=*
//SYSUT1   DD SPACE=(800,(500,500),,,ROUND),UNIT=SYSDA
//SYSUT2   DD SPACE=(800,(500,500),,,ROUND),UNIT=SYSDA
//SYSIN    DD DSN=YOUR.COBOL.SOURCE(PROGNAME),DISP=SHR
//*
//*-------------------------------------------------------
//* STEP 2: COBOL COMPILE
//*-------------------------------------------------------
//COB      EXEC PGM=IGYCRCTL,
//         PARM='LIB,APOST,XREF,MAP,OFFSET,RENT'
//STEPLIB  DD DSN=IGY.SIGYCOMP,DISP=SHR
//SYSLIB   DD DSN=YOUR.COBOL.COPYLIB,DISP=SHR
//         DD DSN=DB2.SDSNMACS,DISP=SHR
//SYSLIN   DD DSN=YOUR.OBJ.LIBRARY(PROGNAME),DISP=SHR
//SYSPRINT DD SYSOUT=*
//SYSTERM  DD SYSOUT=*
//SYSUDUMP DD SYSOUT=*
//SYSIN    DD DSN=YOUR.COBOL.PRECOMP(PROGNAME),DISP=SHR
//*
//*-------------------------------------------------------
//* STEP 3: LINK-EDIT
//*-------------------------------------------------------
//LKED     EXEC PGM=IEWL,
//         PARM='AMODE=31,RMODE=ANY,XREF,RENT'
//SYSLIB   DD DSN=CEE.SCEELKED,DISP=SHR
//         DD DSN=DB2.SDSNLOAD,DISP=SHR
//SYSLIN   DD DSN=YOUR.OBJ.LIBRARY(PROGNAME),DISP=SHR
//         DD DDNAME=SYSIN
//SYSLMOD  DD DSN=YOUR.LOAD.LIBRARY(PROGNAME),DISP=SHR
//SYSPRINT DD SYSOUT=*
//SYSTERM  DD SYSOUT=*
//SYSUDUMP DD SYSOUT=*
//SYSIN    DD *
  INCLUDE SYSLIB(DSNELI)
  INCLUDE SYSLIB(DSNALI)
/*
//*
//*-------------------------------------------------------
//* STEP 4: DB2 BIND
//*-------------------------------------------------------
//BIND     EXEC PGM=IKJEFT01
//STEPLIB  DD DSN=DB2.SDSNLOAD,DISP=SHR
//DBRMLIB  DD DSN=YOUR.DBRM.LIBRARY,DISP=SHR
//SYSTSPRT DD SYSOUT=*
//SYSPRINT DD SYSOUT=*
//SYSTSIN  DD *
  DSN SYSTEM(DB2P)
  BIND PLAN(PLANNAME) -
       MEMBER(PROGNAME) -
       ACTION(REPLACE) -
       ISOLATION(CS) -
       ACQUIRE(USE) -
       RELEASE(COMMIT) -
       VALIDATE(BIND) -
       EXPLAIN(YES) -
       OWNER(OWNER_ID) -
       QUALIFIER(SCHEMA)
  END
/*
//
```

### 14.11 CICS com DB2 e COBOL

#### Programa CICS-DB2
```cobol
       IDENTIFICATION DIVISION.
       PROGRAM-ID. CICSPROG.
       
       DATA DIVISION.
       WORKING-STORAGE SECTION.
           EXEC SQL INCLUDE SQLCA END-EXEC.
           EXEC SQL INCLUDE CUSTOMER END-EXEC.
           
       01  WS-COMMAREA.
           05  WS-FUNCTION         PIC X(8).
           05  WS-CUSTOMER-ID      PIC S9(9) COMP.
           05  WS-RETURN-DATA.
               10  WS-CUST-NAME    PIC X(100).
               10  WS-CUST-BALANCE PIC S9(9)V99 COMP-3.
               10  WS-RETURN-CODE  PIC S9(4) COMP.
               
       LINKAGE SECTION.
       01  DFHCOMMAREA            PIC X(120).
       
       PROCEDURE DIVISION.
       
       0000-MAIN.
           EXEC CICS HANDLE CONDITION
                ERROR(9999-ERROR)
                NOTFND(9998-NOTFOUND)
           END-EXEC
           
           MOVE DFHCOMMAREA TO WS-COMMAREA
           
           EVALUATE WS-FUNCTION
               WHEN 'INQUIRY'
                   PERFORM 1000-INQUIRY
               WHEN 'UPDATE'
                   PERFORM 2000-UPDATE
               WHEN OTHER
                   MOVE 8 TO WS-RETURN-CODE
           END-EVALUATE
           
           MOVE WS-COMMAREA TO DFHCOMMAREA
           
           EXEC CICS RETURN END-EXEC.
           
       1000-INQUIRY.
           EXEC SQL
               SELECT FIRST_NAME || ' ' || LAST_NAME,
                      BALANCE
                 INTO :WS-CUST-NAME,
                      :WS-CUST-BALANCE
                 FROM CUSTOMERS
                WHERE CUSTOMER_ID = :WS-CUSTOMER-ID
           END-EXEC
           
           IF SQLCODE = 0
               MOVE 0 TO WS-RETURN-CODE
           ELSE
               IF SQLCODE = +100
                   MOVE 4 TO WS-RETURN-CODE
               ELSE
                   MOVE 8 TO WS-RETURN-CODE
               END-IF
           END-IF.
           
       2000-UPDATE.
           EXEC SQL
               UPDATE CUSTOMERS
                  SET BALANCE = :WS-CUST-BALANCE
                WHERE CUSTOMER_ID = :WS-CUSTOMER-ID
           END-EXEC
           
           IF SQLCODE = 0
               EXEC CICS SYNCPOINT END-EXEC
               MOVE 0 TO WS-RETURN-CODE
           ELSE
               EXEC CICS SYNCPOINT ROLLBACK END-EXEC
               MOVE 8 TO WS-RETURN-CODE
           END-IF.
           
       9998-NOTFOUND.
           MOVE 4 TO WS-RETURN-CODE
           EXEC CICS RETURN END-EXEC.
           
       9999-ERROR.
           MOVE 8 TO WS-RETURN-CODE
           EXEC CICS RETURN END-EXEC.
```

### 14.12 Batch Processing Best Practices

#### Programa Batch com Restart Logic
```cobol
       IDENTIFICATION DIVISION.
       PROGRAM-ID. BATCHPROG.
       
       ENVIRONMENT DIVISION.
       INPUT-OUTPUT SECTION.
       FILE-CONTROL.
           SELECT CHECKPOINT-FILE ASSIGN TO CHKPOINT
                  ORGANIZATION IS SEQUENTIAL
                  FILE STATUS IS WS-FILE-STATUS.
                  
       DATA DIVISION.
       FILE SECTION.
       FD  CHECKPOINT-FILE.
       01  CHECKPOINT-RECORD.
           05  CHK-LAST-KEY        PIC S9(9) COMP.
           05  CHK-RECORDS-PROCESSED PIC S9(9) COMP.
           05  CHK-COMMIT-COUNT    PIC S9(9) COMP.
           
       WORKING-STORAGE SECTION.
           EXEC SQL INCLUDE SQLCA END-EXEC.
           
       01  WS-CHECKPOINT.
           05  WS-LAST-KEY         PIC S9(9) COMP VALUE ZERO.
           05  WS-RECORD-COUNT     PIC S9(9) COMP VALUE ZERO.
           05  WS-COMMIT-COUNT     PIC S9(9) COMP VALUE ZERO.
           05  WS-COMMIT-FREQUENCY PIC S9(4) COMP VALUE 1000.
           
       01  WS-FILE-STATUS          PIC XX.
       
           EXEC SQL
               DECLARE BATCH_CURSOR CURSOR FOR
               SELECT CUSTOMER_ID,
                      BALANCE
                 FROM CUSTOMERS
                WHERE CUSTOMER_ID > :WS-LAST-KEY
                  AND STATUS = 'ACTIVE'
                ORDER BY CUSTOMER_ID
                 FOR UPDATE OF BALANCE
           END-EXEC.
           
       PROCEDURE DIVISION.
       
       0000-MAIN.
           PERFORM 1000-INITIALIZATION
           PERFORM 2000-PROCESS-BATCH
           PERFORM 9000-FINALIZATION
           GOBACK.
           
       1000-INITIALIZATION.
      * Check for restart
           OPEN INPUT CHECKPOINT-FILE
           IF WS-FILE-STATUS = '00'
               READ CHECKPOINT-FILE
               MOVE CHK-LAST-KEY TO WS-LAST-KEY
               MOVE CHK-RECORDS-PROCESSED TO WS-RECORD-COUNT
               MOVE CHK-COMMIT-COUNT TO WS-COMMIT-COUNT
               DISPLAY 'Restarting from Customer: ' WS-LAST-KEY
               DISPLAY 'Records already processed: ' WS-RECORD-COUNT
               CLOSE CHECKPOINT-FILE
           END-IF
           
           EXEC SQL
               OPEN BATCH_CURSOR
           END-EXEC.
           
       2000-PROCESS-BATCH.
           PERFORM UNTIL END-OF-DATA
               EXEC SQL
                   FETCH BATCH_CURSOR
                    INTO :WS-CUSTOMER-ID,
                         :WS-BALANCE
               END-EXEC
               
               IF SQLCODE = 0
                   PERFORM 2100-PROCESS-RECORD
                   ADD 1 TO WS-RECORD-COUNT
                   
      * Commit checkpoint logic
                   IF FUNCTION MOD(WS-RECORD-COUNT, 
                                  WS-COMMIT-FREQUENCY) = 0
                       PERFORM 2200-CHECKPOINT
                   END-IF
               ELSE
                   IF SQLCODE = +100
                       SET END-OF-DATA TO TRUE
                   ELSE
                       PERFORM 9000-SQL-ERROR
                       SET END-OF-DATA TO TRUE
                   END-IF
               END-IF
           END-PERFORM.
           
       2100-PROCESS-RECORD.
      * Business logic here
           COMPUTE WS-NEW-BALANCE = WS-BALANCE * 1.02
           
           EXEC SQL
               UPDATE CUSTOMERS
                  SET BALANCE = :WS-NEW-BALANCE,
                      LAST_UPDATE = CURRENT TIMESTAMP
                WHERE CURRENT OF BATCH_CURSOR
           END-EXEC.
           
       2200-CHECKPOINT.
           EXEC SQL
               COMMIT
           END-EXEC
           
           ADD 1 TO WS-COMMIT-COUNT
           MOVE WS-CUSTOMER-ID TO WS-LAST-KEY
           
      * Save checkpoint
           OPEN OUTPUT CHECKPOINT-FILE
           MOVE WS-LAST-KEY TO CHK-LAST-KEY
           MOVE WS-RECORD-COUNT TO CHK-RECORDS-PROCESSED
           MOVE WS-COMMIT-COUNT TO CHK-COMMIT-COUNT
           WRITE CHECKPOINT-RECORD
           CLOSE CHECKPOINT-FILE
           
           DISPLAY 'Checkpoint at record: ' WS-RECORD-COUNT.
           
       9000-FINALIZATION.
           EXEC SQL
               CLOSE BATCH_CURSOR
           END-EXEC
           
           EXEC SQL
               COMMIT
           END-EXEC
           
           DISPLAY 'Batch processing completed'
           DISPLAY 'Total records processed: ' WS-RECORD-COUNT
           DISPLAY 'Total commits: ' WS-COMMIT-COUNT.
```

### 14.13 Melhores Práticas COBOL-DB2

#### 1. Padrões de Codificação
```cobol
      *---------------------------------------------------------
      * SEMPRE use comentários estruturados
      *---------------------------------------------------------
      * SEMPRE declare SQLCA
           EXEC SQL INCLUDE SQLCA END-EXEC.
           
      * SEMPRE verifique SQLCODE após cada SQL
           IF SQLCODE NOT = 0 AND SQLCODE NOT = +100
               PERFORM ERROR-ROUTINE
           END-IF.
           
      * USE nomes significativos com prefixos
       01  WS-CUSTOMER-FIELDS.
           05  WS-CUST-ID          PIC S9(9) COMP.
           05  WS-CUST-NAME        PIC X(50).
           
      * EVITE SELECT * - especifique colunas
           EXEC SQL
               SELECT COL1, COL2, COL3  -- Específico
                 INTO :HOST1, :HOST2, :HOST3
                 FROM TABLE
           END-EXEC.
```

#### 2. Performance Guidelines
```cobol
      * USE Multi-row operations quando possível
      * MINIMIZE network traffic com FETCH apropriado
      * USE índices efetivamente
      * EVITE conversões desnecessárias
      
      * BOM: Tipo de dado correto
       01  WS-DECIMAL-FIELD    PIC S9(9)V99 COMP-3.
       
      * RUIM: Conversão implícita
       01  WS-CHAR-FIELD       PIC X(12).
       
      * USE bind variables sempre
           EXEC SQL
               SELECT * FROM CUSTOMERS
                WHERE CUSTOMER_ID = :WS-CUST-ID  -- Bind variable
           END-EXEC.
```

#### 3. Segurança
```cobol
      * NUNCA concatene strings para formar SQL
      * SEMPRE use bind variables
      * IMPLEMENTE audit trails
           
       01  WS-AUDIT-LOG.
           05  WS-AUDIT-USER       PIC X(8).
           05  WS-AUDIT-ACTION     PIC X(10).
           05  WS-AUDIT-TIMESTAMP  PIC X(26).
           
           EXEC SQL
               INSERT INTO AUDIT_LOG
                   (USER_ID, ACTION, TIMESTAMP, DETAILS)
               VALUES
                   (:WS-AUDIT-USER,
                    :WS-AUDIT-ACTION,
                    CURRENT TIMESTAMP,
                    :WS-AUDIT-DETAILS)
           END-EXEC.
```

### 14.14 Troubleshooting Common Issues

#### Diagnóstico de Problemas
```cobol
       01  WS-DIAGNOSTIC-FIELDS.
           05  WS-DISPLAY-SQLCODE  PIC -999999999.
           05  WS-DEADLOCK-COUNT   PIC S9(4) COMP VALUE 0.
           05  WS-MAX-RETRIES      PIC S9(4) COMP VALUE 3.
           
       ERROR-DIAGNOSIS.
           MOVE SQLCODE TO WS-DISPLAY-SQLCODE
           
           EVALUATE TRUE
               WHEN SQLCODE = -104
                   DISPLAY 'SQL SYNTAX ERROR'
                   DISPLAY 'Check SQL statement syntax'
                   
               WHEN SQLCODE = -180 OR -181
                   DISPLAY 'DATE/TIME FORMAT ERROR'
                   DISPLAY 'Check date/time values'
                   
               WHEN SQLCODE = -305
                   DISPLAY 'NULL VALUE ERROR'
                   DISPLAY 'Missing null indicator'
                   
               WHEN SQLCODE = -501
                   DISPLAY 'CURSOR NOT OPEN'
                   DISPLAY 'Open cursor before fetch'
                   
               WHEN SQLCODE = -502
                   DISPLAY 'CURSOR ALREADY OPEN'
                   
               WHEN SQLCODE = -803
                   DISPLAY 'DUPLICATE KEY'
                   
               WHEN SQLCODE = -811
                   DISPLAY 'MULTIPLE ROWS RETURNED'
                   DISPLAY 'Expected single row'
                   
               WHEN SQLCODE = -904 OR -911 OR -913
                   DISPLAY 'RESOURCE/DEADLOCK'
                   ADD 1 TO WS-DEADLOCK-COUNT
                   IF WS-DEADLOCK-COUNT <= WS-MAX-RETRIES
                       DISPLAY 'Retrying...'
                       PERFORM RETRY-LOGIC
                   END-IF
                   
               WHEN OTHER
                   DISPLAY 'SQLCODE: ' WS-DISPLAY-SQLCODE
           END-EVALUATE.
```

## 15. Conclusão

Este guia fornece uma base sólida para desenvolvedores trabalhando com DB2. ## 15. Resumo de Integração Mainframe

### Principais Componentes da Arquitetura DB2-COBOL

1. **Precompiler DB2**: Processa embedded SQL e gera DBRM
2. **DBRM (Database Request Module)**: Contém SQL extraído
3. **Plan/Package**: SQL otimizado e executável
4. **SQLCA**: Comunicação entre programa e DB2
5. **Host Variables**: Variáveis COBOL para troca de dados

### Fluxo de Desenvolvimento

```
Código COBOL com SQL → Precompile → Compile → Link-Edit → Bind → Execute
```

### Checklist Mainframe COBOL-DB2

#### Desenvolvimento
- [ ] DCLGEN gerado e atualizado
- [ ] SQLCA incluído
- [ ] Null indicators declarados quando necessário
- [ ] Host variables com tipos corretos
- [ ] SQLCODE verificado após cada SQL
- [ ] Cursores declarados para múltiplas linhas
- [ ] Error handling implementado
- [ ] Commit frequency definida para batch

#### Compilação e Deploy
- [ ] JCL de compile/bind testado
- [ ] DBRM library configurada
- [ ] Plan/Package bind executado
- [ ] Autorizações concedidas
- [ ] Isolation level apropriado
- [ ] EXPLAIN executado para queries críticas

#### Performance
- [ ] Multi-row operations onde aplicável
- [ ] Índices apropriados criados
- [ ] RUNSTATS executado
- [ ] Bind com REOPT quando necessário
- [ ] Buffer pools otimizados
- [ ] Lock contention minimizada

#### Produção
- [ ] Restart logic para batch jobs
- [ ] Checkpoint/restart implementado
- [ ] Monitoring configurado
- [ ] Procedures de backup alinhadas
- [ ] Documentação CICS/Batch atualizada

## 16. Conclusão

Este guia fornece uma base sólida para desenvolvedores trabalhando com DB2, tanto em ambientes modernos quanto em sistemas legados Mainframe com COBOL. As práticas aqui descritas devem ser adaptadas conforme as necessidades específicas de cada projeto, sempre priorizando:

1. **Performance**: Otimização contínua de queries e estruturas
2. **Segurança**: Proteção adequada de dados sensíveis
3. **Manutenibilidade**: Código limpo e bem documentado
4. **Escalabilidade**: Design preparado para crescimento
5. **Confiabilidade**: Estratégias robustas de backup e recovery
6. **Integração**: Compatibilidade entre sistemas modernos e legados

Para ambientes Mainframe com COBOL, é essencial:
- Manter padrões consistentes de codificação
- Implementar tratamento robusto de erros
- Usar técnicas apropriadas de performance (multi-row operations)
- Garantir restart capability para batch processing
- Coordenar adequadamente com CICS para aplicações online

Lembre-se de que o DB2 é uma ferramenta poderosa que, quando bem utilizada, pode fornecer excelente performance e confiabilidade tanto para aplicações corporativas modernas quanto para sistemas legados críticos.

---
*Documento atualizado em: Janeiro 2025*
*Versão: 2.0 - Incluindo desenvolvimento Mainframe COBOL*