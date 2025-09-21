* O ecrã de incidentes deve ter a fila de incidentes em aberto (não fechados ou resolvidos)
* Deve ter uma forma de inserir um novo incidente (a janela de inserção de incidentes já existe e é acedida por outras tabs da aplicação como fast action)
* A janela de inserção de incidentes deve ter um modo de carregamento de incidentes em bulk (servirá para a migração da kb de incidentes - permite carregar vários ficheiros em conjunto, pdf, woed, excel, txt), bem como um modo de carregamento único (um a um)
* Assim que um incidente é inserido, fica num estado (em revisão se carregado em bulk ou modo aberto, se carregado manualmente - modo único)
* Um incidente também pode ser inserido de forma automática por via de integração (API ou custom) com as ferramentas de ticketing existentes. Neste caso também fica no estado em revisão.
* Na fila de incidentes deve existir uma opção de edição para possibilitar a edição do incidente e efetuar a revisão, colocando incidente no estado aberto.
* Todos incidentes inseridos e em estados não fechados ficam na fila de incidentes. 
* Devem existir filtros para a fila de incidentes e por default são apresentados por nível de criticidade descendente.
* Deve existir na fila de incidentes, apenas para os incidentes no estado aberto, uma opção de tratamento do incidente.
* Assim que um incidente é adicionado à fila no estado aberto deve ser efetuada uma busca inteligente, mas sem IA (como se a opção de busca com IA estivesse desabilitada) de acidentes relacionados e no estado resolvido (estes incidentes relacionados apenas serão mostrados ao utilizador na área de tratamento do incidente (limitados a 5 por nível de semelhança)
* Deve ser permitido ao utilizador ver os detalhes dos incidentes relacionados.(logar a ação efetuada pelo utilizador)
* Deve ser permitido ao utilizador prosseguir com análise inteligente (via IA - ML e LLM) (logar a ação efetuada pelo utilizador)
* Ao proceder com a análise inteligente deve ser passado ao LLM o contexto do incidente a tratar (resolver), para alargamento semântico do contexto técnico ou funcional do incidente para permitir uma busca mais abrangente. (não carece de autorização do utilizador. Deve ser logado como ação efetuada pelo LLM - Gemini ou outro que esteja parametrizado
* Deve ser feita a pesquisa de incidentes relacionados com o alargamento semântico devolvido pelo LLM. (Logar como ação do sistema - procura de relacionados)
* Deve ser enviado ao sistema LLM configurado, (Gemini ou outro) as informações relativas aos incidentes relacionados e deve ser instruído o Gemini, com base nesse contexto de incidentes, a redação de uma proposta de solução ao utilizador, fazendo referencia aos incidentes onde foi obtida a informação. (Logar como ação do LLM - Analise de solução)
* O utilizador deve classificar a solução proposta, podendo aceitar ou rejeitar a mesma. (Logar como ação do utilizador)
* O utilizador deve poder incluir um comentário (fica no estado ativo) na solução para que seja incluída no contexto do incidente. (Logar como ação do utilizador)
* Ao rejeitar a solução, deve ser questionado o utilizador se pretende uma nova análise. Em caso afirmativo o incidente será injetado de novo no fluxo de tratamento inteligente, incluindo no contexto todos os comentários ativos incluídos pelo utilizador. (logar como ação do utilizador)
* Os comentários de um utilizador devem poder ser apagados pelo mesmo o que inclui a inativação no log de tratamento da ação original relativa à inclusão no incidente do comentário inativado.
* O log de tratamento dos incidentes deve ser associado ao incidente e passível de ser visto na janela de detalhe de incidentes.





