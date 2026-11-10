# GDD - Khristós

## Visão geral

**Khristós** é um card game estratégico de disputa de influência espiritual e controle territorial.

Ninguém vence por dano ou destruição. Vence quem reúne mais Fé, e a Fé só conta para quem domina a maioria das zonas.

### Mecânicas principais
- controle da maioria das zonas
- geração de Fé
- Fraqueza como segundo eixo: quem a expõe, quem a cobra e quem a transforma em Fé
- posicionamento e adjacência numa grade 2 × 2
- evolução de cartas por cima das anteriores
- ofícios da hierarquia conquistados em campo
- combos: Sacramentos e Fervor

### O jogo não é
- um simulador de guerra religiosa
- um jogo de combate físico
- um clone de TCG tradicional

---

## Estrutura da partida

### Objetivo
Chegar a **100 de Fé** antes do oponente. A vitória é conferida no fim de cada rodada. Se os dois passam da meta na mesma rodada, vence quem tem mais Fé; empate mantém a partida.

> O valor mora em `cards.json`, em `RULES.feToWin`.

### Rodada final
A partir da rodada 25 vence quem tiver mais Fé, mesmo abaixo da meta. Com totais iguais, vence quem domina mais zonas. Se ainda assim houver igualdade três rodadas depois, a partida termina empatada. A regra existe para um tabuleiro travado não durar para sempre.

### Condição alternativa: Jesus Cristo
Vitória imediata, rara e cinematográfica. **Não implementada.**

### Preparação
- Cada jogador começa com 5 cartas e pode trocar quantas quiser uma única vez.
- Quem começa é sorteado. Quem joga em segundo tem 1 de Sabedoria a mais nas 5 primeiras rodadas, porque o primeiro sempre conta a Fé com um turno de vantagem.
- Compra 1 carta no início de cada turno. A mão comporta 10 cartas; a carta comprada além disso vai para o Retiro.

---

## Tabuleiro

24 espaços, 12 por jogador, em confronto vertical: as cartas do oponente em cima, as suas embaixo.

Cada zona é uma grade de **2 colunas por 2 fileiras** para cada jogador: a **frente**, junto ao oponente, e o **fundo**.

| Zona | Espaços por jogador |
| --- | --- |
| Zona 1 | 4 (2 na frente, 2 no fundo) |
| Zona Central | 4 |
| Zona 3 | 4 |

- **Adjacência:** são vizinhas as cartas lado a lado e as que estão uma atrás da outra, sempre dentro da mesma zona. Diagonal não conta.
- **Domínio:** domina a zona quem tem mais Fé nela. Zona vazia não é de ninguém.
- **Monumentos:** cada jogador pode ter 2 por zona. Cada Bispo ou Cardeal na zona abre espaço para mais 1.

> A forma das zonas mora em `RULES.zoneCols`. `[2, 1, 2]` deixa a Central com 2 espaços, um atrás do outro.

### Zona Central, a coringa
- **Desempata:** uma zona lateral empatada fica com quem domina a Central.
- **Santos:** um Santo na Central alcança as três zonas. A passiva de Joana e o ativo de São Tomás, que valem "nesta zona", passam a valer em todas.

---

## Recursos

### Sabedoria
Paga as cartas. No seu turno você tem Sabedoria igual ao número da rodada, até 10. Ela recarrega todo turno e o que sobra não acumula.

### Fé
Influência espiritual. Cada carta em campo gera Fé na sua zona; a Fé global é o placar.

### Fraqueza
Cada unidade e cada Santo têm a sua; a Fraqueza de uma zona é a soma das cartas do jogador nela. Monumentos não têm Fraqueza. Ela decide três coisas:

- **Quem pode ser alvo.** Várias Heresias só alcançam unidades com 6 ou mais de Fraqueza, ou zonas acima de um total.
- **Quanto a Heresia cobra.** A Apostasia tira Fé igual à Fraqueza do alvo; a Propaganda Pagã, 1 de Fé a cada 4 de Fraqueza na zona; o Pregador Itinerante cresce com a Fraqueza do oponente.
- **Quem está exposto.** Com 8 ou mais a unidade está exposta: o Inquisidor tira 2 de Fé dela e a Inquisição pode destruí-la.

Dá para aumentar a Fraqueza do oponente (Tentação, Escândalo, Interrogar), proteger a sua (São Tomás, Mártir, Batismo, Armadura) ou transformá-la em Fé (Unção dos Enfermos, Graça na Fraqueza).

---

## Turno e Contagem

Uma rodada é um turno de cada jogador. Quando um jogador encerra o turno acontece a **Contagem** dele:

1. Se ele domina **2 ou mais zonas**, ganha a diferença de Fé de cada zona que domina.
2. Com as 3 zonas é **Hegemonia**: mais 6 de Fé.
3. Sem a maioria, a Fé dele não conta.

Depois da Contagem de quem jogou em segundo, a meta de Fé é conferida.

### Durações
- **Até o fim do seu turno:** o domínio tomado por Joana. Vale para a Contagem dela.
- **Até o seu próximo turno:** Fé temporária, a doutrina de São Tomás, Cisma, Manto. Vale na sua Contagem e na do oponente.
- **Por N rodadas:** Heresias que silenciam, impedem de gerar Fé ou drenam. O contador desce no fim do turno de quem sofre a Heresia, depois da Contagem dele.

---

## Tipos de carta

1. **Santos:** lendários, um por baralho. Têm passiva e habilidade ativa. Não são alvo de Heresias de unidade.
2. **Monumentos:** templos e casas religiosas. Fé estável e efeitos na zona.
3. **Unidades:** clero e leigos. Ocupam, sobem na hierarquia e sustentam as zonas.
4. **Relíquias:** ficam presas a uma carta. O campo `slots` diz quantas relíquias a carta comporta.
5. **Bênçãos:** efeito imediato a favor do próprio lado. Depois vão para o Retiro.
6. **Heresias:** efeito imediato contra o oponente, quase sempre ligado à Fraqueza. Depois vão para o Retiro.

---

## Combos

### Sacramentos
Bênçãos que pedem um **ministro** e, às vezes, um **lugar** seus em campo, em qualquer zona. Grau superior também serve: um Bispo ministra o que pede Padre, uma Basílica vale por Igreja. O ministro nunca é o próprio alvo.

| Sacramento | Ministro e lugar | Efeito |
| --- | --- | --- |
| Batismo (2) | Diácono e Capela | a unidade ganha +1 de Fé e perde 3 de Fraqueza |
| Confissão (2) | Padre e Igreja | remove todas as Heresias da unidade e ela ganha +2 de Fé |
| Unção dos Enfermos (3) | Padre | a unidade perde toda a Fraqueza que tem e ganha +1 de Fé a cada 3 removidas |
| Crisma (4) | Bispo e Capela | suas unidades na zona ganham +2 de Fé e perdem 2 de Fraqueza |
| Eucaristia (4) | Padre, e um Monumento com o Cálice Sagrado na zona | esse Monumento ganha +10 de Fé até o seu próximo turno |

O **Catecúmeno** ganha +2 de Fé a cada Sacramento celebrado na zona dele. O ativo de São Tomás barateia os Sacramentos do turno.

A Ordenação continua uma Bênção comum, para a escada poder começar antes do Bispo.

### Fervor
Uma carta com Fervor ganha um bônus quando não é a primeira carta que você joga no turno. Unidades, Monumentos, evoluções, Relíquias, Bênçãos e Heresias contam; habilidades ativas não.

| Carta | Com Fervor |
| --- | --- |
| Tentação | +5 de Fraqueza em vez de +3, e você compra 1 carta |
| Louvor | +3 de Fé em vez de +2 |
| Cruzada | +3 de Fé em vez de +2 |
| Cavaleiro Templário | entra com −2 de Fraqueza |
| Te Deum | +1 de Fé a mais para cada carta já jogada no turno |

### Adjacência
Na grade 2 × 2 toda carta tem dois vizinhos. Usam isso: o Padre (vira Pároco ao lado de um Monumento), o Seminarista, o Devoto, o Cardeal, o Ícone Sagrado, o Mártir (protege os vizinhos das Heresias) e o Escândalo (aumenta a Fraqueza dos vizinhos do alvo).

---

## Permanência e Retiro

- Cartas em campo não morrem. O inimigo só as enfraquece.
- **Exceções:** Inquisição destrói uma unidade exposta e Profanação do Altar destrói um Monumento. Nenhuma das duas atinge uma carta no topo da sua linha (Cardeal, Frei, Catedral) nem um Santo.
- **Substituição:** em zona cheia, uma carta de base pode entrar no lugar de uma carta sua.
- **Retiro:** é para onde vão as cartas usadas, substituídas ou destruídas, com tudo o que estava por baixo e com as relíquias.

---

## Evolução

Segue o modelo do Pokémon TCG.

- A carta do degrau seguinte precisa estar na mão e entra **por cima** da anterior, no mesmo espaço. Ela não entra em campo de outro jeito.
- Um degrau por turno: a carta não evolui no turno em que entrou.
- O custo é a **diferença** entre o custo da carta nova e o da carta que ela cobre.
- Relíquias, modificadores e Heresias da carta de baixo passam para a de cima.
- **Vocação:** Acólito, Seminarista e Diácono, ao entrar em campo, buscam no baralho a carta do degrau seguinte. O Monge Copista busca um Acólito.

| Linha | Degraus (custo impresso) | Requisito para entrar |
| --- | --- | --- |
| Clero | Acólito (1) | base |
|  | Seminarista (2) | nenhum |
|  | Diácono (3) | 3 de Fé na zona |
|  | Padre (4) | 5 de Fé na zona |
|  | Bispo (6) | 8 de Fé na zona e domínio |
|  | Cardeal (8) | 12 de Fé na zona e domínio |
| Templos | Capela (2) | base |
|  | Igreja (4) | 4 de Fé na zona |
|  | Basílica (6) | 8 de Fé na zona e domínio |
|  | Catedral (8) | 12 de Fé na zona e domínio |
| Ordens | Cavaleiro Templário (2) | base |
|  | Frei (5) | 4 de Fé na zona |

---

## Hierarquia e ofícios

Mudar de **ordem** pede uma carta nova. Dentro da mesma ordem, o **ofício** é conferido pelo que acontece na zona, sem carta nenhuma.

| Degrau | Ordem | Como se chega | Bônus |
| --- | --- | --- | --- |
| Acólito | Formação | carta | Vocação |
| Seminarista | Formação | carta | Vocação |
| Diácono | Diaconato | carta | Vocação |
| Vigário Paroquial | Presbitério | carta Padre | |
| Pároco | Presbitério | Padre ao lado de um Monumento seu | −3 Fraqueza |
| Decano | Presbitério | Pároco com 3 unidades suas na zona | +1 Fé |
| Vigário Episcopal | Presbitério | Decano com um Bispo ou Cardeal seu em campo | +2 Fé |
| Vigário Geral | Presbitério | Vigário Episcopal dominando a zona | +3 Fé |
| Bispo Auxiliar | Episcopado | carta Bispo | |
| Bispo Diocesano | Episcopado | Bispo dominando a zona | +1 Fé |
| Arcebispo Metropolitano | Episcopado | Bispo Diocesano com 2 zonas dominadas | +2 Fé |
| Cardeal | Episcopado | carta | não pode ser destruído |
| Papa | | ainda não existe | |

Cada ofício exige o anterior e o bônus de Fé mostrado é o total daquele ofício. Um ofício se perde quando a condição deixa de valer.

Para evitar referência circular, as condições de ofício e o "10 de Fé na zona" do Jovem de Fé olham a Fé antes das passivas condicionais. A Fraqueza de uma zona é sempre o número mostrado na tela.

---

## Baralhos

30 cartas cada. Unidades têm no máximo 2 cópias e o Santo, 1.

### São Tomás de Aquino: hierarquia e Sacramentos
São Tomás de Aquino; Acólito ×2, Seminarista ×2, Diácono ×2, Padre ×2, Bispo ×2, Cardeal; Monge Copista ×2, Catecúmeno, Mártir, Inquisidor; Capela ×2, Igreja ×2, Scriptorium; Cálice Sagrado; Batismo, Confissão, Unção dos Enfermos, Crisma, Eucaristia, Ordenação; Inquisição.

Começa devagar, sobe a escada e termina dominante. O Mártir segura as Heresias, o Inquisidor expõe as unidades do oponente.

### Joana D'Arc: Fervor e Heresias
Joana D'Arc; Devoto ×2, Missionário, Cavaleiro Templário ×2, Frei ×2, Jovem de Fé ×2, Pregador Itinerante; Capela ×2, Igreja; Cruz de Joana, Estandarte de Orléans, Armadura, Ícone Sagrado; Louvor ×2, Cruzada, Te Deum, Graça na Fraqueza; Tentação ×2, Escândalo, Cisma, Apostasia, Acusação de Bruxaria, Propaganda Pagã.

Toma as zonas cedo, conta Fé antes do oponente e usa a Fraqueza dele contra ele. Perde fôlego se a partida se alonga.

Fora dos dois baralhos, mas implementadas e testadas: Eremita, Basílica, Catedral, Mosteiro Beneditino, Convento das Clarissas, Manto Protetor, Suma Teológica, Relicário, Oração das Vésperas, Revelação Divina, Pentecostes, Consagração, Debate Filosófico, Exposição de Heresia, Simonia, Heresia Albigense, Iconoclastia, Profanação do Altar.

Na simulação de 400 partidas entre duas IAs: São Tomás vence 53% e Joana 47%; quem começa vence 51%. A partida dura 11 rodadas na mediana (de 8 a 14 em 80% dos casos). 53% das Contagens dão Fé e a maioria troca de mãos 8 vezes por partida, na mediana. Por partida, em média, saem 2,8 Sacramentos, 3,7 bônus de Fervor e 4,2 Heresias. O Cardeal aparece em 42% das partidas de São Tomás.

---

## Filosofia visual e sonora

- **Retábulo:** as três zonas são os painéis de um tríptico dourado, com arco, cruz e dobradiças. A Central leva a cruz maior.
- **Auréola como placar:** o retrato do Santo de cada jogador ganha uma auréola que se completa com a Fé.
- **Velas como Sabedoria:** cada ponto é uma vela acesa.
- **Selos da maioria:** três selos mostram quem domina cada zona e quanto de Fé a Contagem vai dar.
- **Santinhos:** as cartas usam pinturas clássicas; cartas sem pintura recebem um emblema.
- **Luz que muda de lado:** quente e de baixo no seu turno, vermelha e de cima no turno do oponente.
- **Som de catedral:** órgão, coro, tímpanos e sinos, tudo sintetizado. Jogar uma carta é um golpe curto; tomar a maioria, a Hegemonia, a entrada do Santo e a vitória são os momentos mais longos e mais fortes. A trilha de fundo cresce conforme alguém se aproxima da meta.
- **Tipografia:** Texturina nos títulos e EB Garamond no texto.

---

## Em aberto

- Condição de vitória Jesus Cristo.
- Papa e os degraus que hoje são só ofício, caso virem cartas.
- Hierarquia própria para o baralho da Joana, que hoje só tem a linha Cavaleiro Templário → Frei.
- Montagem de baralho, partida entre duas pessoas e níveis de dificuldade da IA.
- Pinturas para as cartas que hoje usam emblema.
- Jogar só pelo teclado.
