# UrbanGeist - Mini Projeto em Azure

Este repositório contém um mini projeto desenvolvido em Azure que cria automaticamente toda a infraestrutura necessária através de scripts shell.

## Instruções para execução (∩^o^)⊃━☆

1. Aceder ao Azure Cloud Shell

2. Clonar este repositório:
   ```bash
   git clone https://github.com/Teresa-ipcb/urbangeist
   cd urbangeist
   ```

3. Mudar para a branch `master`:
   ```bash
   git checkout master
   ```

4. Tornar o script executável e executar o mesmo:
   ```bash
   chmod +x infraestrutura.sh
   ./infraestrutura.sh
   ```

5. Aproveite a aplicação! (｡･∀･)ﾉﾞ

---

## Estrutura do Projeto (>'-'<)

- `infraestrutura.sh` – Script principal para criar os recursos no Azure
- `scripts/` – Scripts auxiliares para povoar base de dados, etc...
- `backend/` – Funções Azure Functions (Node.js)
- `frontend/` – Página web simples com integração de Azure Maps

## Requisitos （︶^︶）

- Conta Azure ativa
- Permissões suficientes para criar recursos (Storage, CosmosDB, Function App, etc.)

---

Criado por Teresa, Juliana, José 👻👻👻
