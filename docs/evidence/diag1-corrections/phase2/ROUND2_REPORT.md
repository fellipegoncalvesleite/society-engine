# DIAG-1 Fase 2 — rodada de correção após rework

Esta rodada corrige os dois pontos importantes encontrados na revisão supervisora da Fase 2. A implementação continua candidata: não há autoaceitação, congelamento, início da Fase 3 ou retomada do Task 12.

1. **Base:** a rodada começou no candidato publicado `bf5807e75bb650872d9c81cf95dce5dc1df6a509`; a correção de produção está em `13c685ac4fb123f69a8693d2e5728260b379cfa8`.
2. **Arquivos de produção:** `src/sim/agents/nutritionExposure.ts`, `src/sim/agents/seasonalSurvival.ts`, `src/sim/agents/types.ts` e `src/sim/agents/bandChronicle.ts`.
3. **Important 1 — RED:** `validation-round2-coverage-red-original-v4.json` reexecuta o audit sobre os bytes exatos do candidato original e registra o comportamento extrapolado, incluindo a nota sobre controles positivos antigos que não eram discriminantes.
4. **Cobertura:** consultas agora distinguem dias pedidos, body-time conhecido e fração de cobertura. O desconhecido não vira fome, conforto, recovery, excedente, pressão de movimento ou pressão demográfica.
5. **Fome parcial:** 25% conhecido faminto produz estresse atual/anual 0,25 e pressões coverage-safe; a leitura anual a day 360 não extrapola os 270 dias sem medida.
6. **Conforto/excedente parcial:** 25% conhecido confortável produz recovery 0,25 e excedente 0,06. Razão 10 continua limitada a 0,06, e a mistura 0,99 fica bounded. Cobertura completa mantém a ponderação agregada por demanda; legacy completo mantém a média conhecida.
7. **Demografia real:** `deriveFoodDemographyRateTerms` recebe diretamente os estados anuais parciais de fome e conforto; os termos literais de estresse, mortalidade e bônus de fertilidade são verificados no audit GREEN.
8. **Important 2 — RED:** o replay original classifica 1 e 89 dias como maduros, enquanto a correção e o mutant guard diferenciam o erro.
9. **Limiar corrigido:** `seasonalRecoveryStreak >= 1` significa 90 dias físicos qualificantes para `recovery_after_crisis`. Uma lacuna desconhecida e um intervalo medido não recuperador reiniciam a sequência.
10. **Recuperação imediata:** inner-fission continua aceitando `seasonal_pulse_recovery`; o limiar de 90 dias só governa a classificação madura.
11. **Inventário:** `validation-round2/THRESHOLD_CONVERSION_AUDIT.json` separa comparações físicas, o limiar corrigido e os leitores que usam duração de forma intencional.
12. **Merge histórico:** o controle usa demandas e populações históricas diferentes, depois troca os cabeçalhos sobreviventes. `supportUnits`/`demandUnits` permanecem iguais; o estresse agregado muda com os sobreviventes. A simplificação é aceita como agregação, sem inventar uma vida individual.
13. **Mutantes:** `unknown_coverage`, `recovery_duration` e `surplus_coverage` foram carregados, executados, detectados e restaurados. Evidências: `validation-round2-unknown-coverage-mutant-v5.json`, `validation-round2-recovery-duration-mutant-v5.json` e `validation-round2-surplus-coverage-mutant-v3.json`.
14. **GREEN focado:** 30/30 em `validation-round2-coverage-green-v13.json`.
15. **Regressões:** units/exposure 39/39, fatigue 31/31, migration 7/7, rounding 66/66, demography 18/18, annual crossing 13/13, failed return 7/7; conservação Phase1 e mutants, caches Phase1B e mutants, cross-world cache, SCALE-1 traversal, import boundary e graph também passaram. TypeScript app/Node e build passam; o aviso existente de bundle grande permanece.
16. **Natural:** os seis pares naturais de 30 anos anteriores permanecem evidência histórica; a nova semântica só é exercitada por controles de cobertura parcial/inherited merge, e nenhuma aceitação natural ou de crescimento populacional é declarada nesta rodada.
17. **Revisão independente:** pendente neste documento até a revisão somente leitura pós-push do intervalo `369362c5b51757407e34493d9f9dcbeae86abdac..HEAD`.
18. **Git/Task12:** somente `fix/diag1-human-support`; o checkout Task12 continua em `809f7ed8f8582f4a6d9b6754bf216f47a6e39fc4`, com os três arquivos sujos e hashes preservados em `PRESERVATION_FINAL.json`. `PHASE 3 NOT STARTED.` `WORLD-M0 TASK 12 NOT RESUMED.`
