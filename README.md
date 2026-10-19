#  Discord Embed Creator Bot

Bot administrativo para Discord com apenas duas áreas principais:

- ⚙️ **Config Bot**
- 🎨 **Criador de Embeds**


## Config Bot

- Avatar por URL ou anexo
- Banner por URL ou anexo
- Status: online / idle / dnd / invisible
- Presença: playing / watching / listening / competing / streaming
- Status rotativo persistente
- Intervalo configurável
- Adicionar, editar, remover e reorganizar atividades
- Proprietário principal
- Usuários autorizados
- Cargos autorizados
- Toda interação administrativa revalida a permissão

## Criador

### Mensagem Normal

- Conteúdo Markdown
- Botões
- Select menus
- Preview privado
- Desfazer
- Limpar com confirmação
- Selecionar canal e confirmar envio

### Embed Normal

- Título + URL
- Descrição
- Cor HEX
- Autor
- Thumbnail
- Imagem
- Fields
- Footer
- Timestamp
- Botões
- Select menus
- Preview privado

### Components V2

- Título usando Text Display Markdown
- Texto
- Section
- Thumbnail como acessório de Section (estrutura oficial)
- Imagem / Media Gallery
- Separator
- Container + accent color
- File V2 por URL de origem, baixado e reenviado como `attachment://`
- Botões em Action Row
- Select Menu em Action Row
- Estrutura ordenada
- Remover último bloco real
- Editar / mover / duplicar / excluir blocos
- Limite de 40 componentes validado
- Flag `IS_COMPONENTS_V2`


## Requisitos

- Node.js **22.12.0 ou superior**
- Um **BOT oficial** criado no Discord Developer Portal
- Intent **Message Content** habilitada para o comando `!painel`

## Instalação

1. Execute `npm install`.
2. Cole o **token do BOT** e seu ID de usuário do Discord.
3. Execute `node index.js`.
4. No seu servidor, use exatamente:

```text
!painel
```


## Segurança

O token fica no `.env`, que já está ignorado pelo Git. O bot não mostra o token em mensagens ou logs e não solicita token de conta pessoal.
