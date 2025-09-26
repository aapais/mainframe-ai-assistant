# GitHub Spec Kit Commands for Claude Code

## Como usar os comandos do Spec Kit

Como os comandos slash não são reconhecidos nativamente pelo Claude Code, use os comandos diretamente através do Python:

### 1. Constitution - Definir Princípios do Projeto
```bash
python3 .specify/scripts/constitution.py
```
Define os princípios orientadores e diretrizes de desenvolvimento do projeto.

### 2. Specify - Criar Especificações
```bash
python3 .specify/scripts/specify.py "[descrição da funcionalidade]"
```
Cria especificações detalhadas para uma nova funcionalidade.

### 3. Plan - Plano Técnico
```bash
python3 .specify/scripts/plan.py
```
Gera o plano técnico de implementação baseado nas especificações.

### 4. Tasks - Gerar Tarefas
```bash
python3 .specify/scripts/tasks.py
```
Quebra o plano em tarefas executáveis e mensuráveis.

### 5. Implement - Implementar Código
```bash
python3 .specify/scripts/implement.py
```
Executa a implementação baseada nas tarefas definidas.

## Fluxo de Trabalho Recomendado

1. **Iniciar com Constitution**: Define os princípios base
2. **Especificar funcionalidade**: Use specify com descrição clara
3. **Criar plano técnico**: Execute plan após ter a especificação
4. **Gerar tarefas**: Use tasks para quebrar em partes menores
5. **Implementar**: Execute implement para gerar o código

## Atalhos Bash (Opcional)

Se preferir usar comandos mais curtos, execute primeiro:
```bash
source .specify/aliases.sh
```

Depois pode usar:
- `specify` ao invés de `python3 .specify/scripts/specify.py`
- `plan` ao invés de `python3 .specify/scripts/plan.py`
- `tasks` ao invés de `python3 .specify/scripts/tasks.py`
- `constitution` ao invés de `python3 .specify/scripts/constitution.py`
- `implement` ao invés de `python3 .specify/scripts/implement.py`

## Estrutura de Diretórios Gerada

```
mainframe-ai-assistant/
├── .specify/           # Scripts e configurações do Spec Kit
├── memory/            # Princípios e contexto do projeto
├── specs/             # Especificações de funcionalidades
│   └── 001-feature/  # Cada feature numerada
│       ├── spec.md   # Especificação
│       ├── plan.md   # Plano técnico
│       └── tasks.md  # Lista de tarefas
└── src/              # Código implementado
```